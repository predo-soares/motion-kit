import { LitElement, css, html } from "lit";
import { render as renderTemplate } from "lit/html.js";
import { customElement, property } from "lit/decorators.js";
import { gsap } from "gsap";
import {
  Camera,
  Mesh,
  Program,
  Renderer,
  Texture,
  Transform,
  Triangle,
  Vec2,
  Vec3,
} from "ogl";
import { toLinearRgb, type ColorRepresentation } from "@/lib/helpers/color";

export interface GlobeMarker {
  location: [number, number];
  size?: number;
  color?: string;
  label?: string;
}

export interface GlobeMarkerTooltipContext {
  marker: GlobeMarker;
  index: number;
  visibility: number;
}

interface FresnelConfig {
  color?: ColorRepresentation;
  rimColor?: ColorRepresentation;
  rimPower?: number;
  rimIntensity?: number;
}

interface AtmosphereConfig {
  color?: ColorRepresentation;
  scale?: number;
  power?: number;
  coefficient?: number;
  intensity?: number;
}

interface ProjectedMarker {
  marker: GlobeMarker;
  index: number;
  screenX: number;
  screenY: number;
  visibility: number;
}

interface UniformUpdaterState {
  radius: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  pointCount: number;
  pointSize: number;
  landPointColor: ColorRepresentation;
  fresnelConfig: Required<FresnelConfig>;
  atmosphereConfig: Required<AtmosphereConfig>;
}

const PI = Math.PI;
const DEG2RAD = PI / 180;
const EPSILON = 1e-6;
const COBE_GLOBE_RADIUS = 0.8;
const DEFAULT_RADIUS = 2.15;
const DEFAULT_GLOBE_SCALE = 1;
const AUTO_ROTATE_SPEED = (2 * PI) / 30;
const ROTATE_SENSITIVITY = 0.005;
const SMOOTHING_STRENGTH = 14;
const LOCKED_POLAR_ANGLE = 1.5;
const LOCKED_THETA = Math.asin(Math.cos(LOCKED_POLAR_ANGLE));
const MIN_THETA = -PI * 0.5 + 0.001;
const MAX_THETA = PI * 0.5 - 0.001;
const VISIBILITY_MIN_DOT = 0.24;
const VISIBILITY_MAX_DOT = 0.48;
const MAX_SHADER_MARKERS = 128;
const SHADER_MARKER_SIZE_SCALE = 0.5;
const MIN_SHADER_MARKER_SIZE = 0.003;
const MAX_SHADER_MARKER_SIZE = 0.06;
const MAX_TOOLTIP_BLUR = 8;
const LAND_TEXTURE_URL = "/motion-kit/globe/land-texture.png";

const defaultFresnelConfig: Required<FresnelConfig> = {
  color: "#0F3161",
  rimColor: "#6FD3FF",
  rimPower: 12,
  rimIntensity: 0.95,
};

const defaultAtmosphereConfig: Required<AtmosphereConfig> = {
  color: "#5AC8FA",
  scale: 1.22,
  power: 19.5,
  coefficient: 1.05,
  intensity: 0.72,
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const clampTheta = (value: number, lockPolar: boolean) =>
  lockPolar ? LOCKED_THETA : clamp(value, MIN_THETA, MAX_THETA);

const smoothstep = (value: number, edge0: number, edge1: number) => {
  if (Math.abs(edge1 - edge0) <= EPSILON) {
    return value >= edge1 ? 1 : 0;
  }

  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

const toPointRadius = (pointSize: number) => Math.max(0.001, pointSize * 0.16);
const radiusToScale = (radius: number) =>
  DEFAULT_GLOBE_SCALE * Math.max(EPSILON, radius / DEFAULT_RADIUS);

const normalizeAngle = (value: number) => {
  const wrapped = (((value + PI) % (2 * PI)) + 2 * PI) % (2 * PI);
  return wrapped - PI;
};

const shortestAngleTarget = (current: number, next: number) =>
  current + normalizeAngle(next - current);

const lonLatToCartesian = (lon: number, lat: number, radius: number) => {
  const lonRad = lon * DEG2RAD;
  const latRad = lat * DEG2RAD;

  const y = radius * Math.sin(latRad);
  const radiusXZ = radius * Math.cos(latRad);
  const x = radiusXZ * Math.sin(lonRad);
  const z = radiusXZ * Math.cos(lonRad);

  return { x, y, z };
};

const cartesianToRotation = (x: number, y: number, z: number) => {
  const length = Math.hypot(x, y, z);
  if (length <= EPSILON) {
    return { phi: 0, theta: 0 };
  }

  const nx = x / length;
  const ny = y / length;
  const nz = z / length;

  return {
    phi: Math.atan2(-nx, nz),
    theta: Math.asin(clamp(ny, -1, 1)),
  };
};

const applyRotation = (
  x: number,
  y: number,
  z: number,
  phi: number,
  theta: number,
) => {
  const cx = Math.cos(theta);
  const cy = Math.cos(phi);
  const sx = Math.sin(theta);
  const sy = Math.sin(phi);

  return {
    rx: cy * x + sy * z,
    ry: sy * sx * x + cx * y - cy * sx * z,
    rz: -sy * cx * x + sx * y + cy * cx * z,
  };
};

const cubicBezierAt = (
  t: number,
  p0: number,
  p1: number,
  p2: number,
  p3: number,
) => {
  const u = 1 - t;
  return (
    u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
  );
};

const cubicBezierDerivativeAt = (
  t: number,
  p0: number,
  p1: number,
  p2: number,
  p3: number,
) => {
  const u = 1 - t;
  return 3 * u * u * (p1 - p0) + 6 * u * t * (p2 - p1) + 3 * t * t * (p3 - p2);
};

const dynamicEase = (value: number) => {
  const clamped = clamp(value, 0, 1);
  let t = clamped;
  for (let index = 0; index < 5; index += 1) {
    const x = cubicBezierAt(t, 0, 0.625, 0, 1);
    const dx = cubicBezierDerivativeAt(t, 0, 0.625, 0, 1);
    if (Math.abs(dx) < 1e-6) break;
    t = clamp(t - (x - clamped) / dx, 0, 1);
  }
  return cubicBezierAt(t, 0, 0.05, 1, 1);
};

@customElement("motion-globe")
export class MotionGlobe extends LitElement {
  static override styles = css`
    :host {
      display: block;
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    canvas,
    .markers {
      position: absolute;
      inset: 0;
      display: block;
      width: 100%;
      height: 100%;
    }

    canvas {
      touch-action: none;
    }

    .markers {
      pointer-events: none;
      overflow: hidden;
    }

    .marker-root {
      position: absolute;
      pointer-events: none;
      transform: translate(-50%, -50%);
    }

    .marker-tooltip {
      position: absolute;
      top: 0;
      left: 50%;
      display: inline-flex;
      transform: translate(-50%, -2rem);
      flex-direction: column;
      align-items: center;
      transition:
        opacity 200ms ease-out,
        filter 200ms ease-out;
      will-change: transform;
    }

    .default-tooltip {
      position: relative;
      border-radius: 0.25rem;
      background: rgba(248, 250, 252, 0.96);
      padding: 0.1875rem 0.375rem;
      color: rgba(15, 23, 42, 0.98);
      font-family:
        "IBM Plex Mono", "SFMono-Regular", ui-monospace, "Cascadia Code",
        "Source Code Pro", Menlo, Consolas, "DejaVu Sans Mono", monospace;
      font-size: 10px;
      font-weight: 600;
      line-height: 1;
      letter-spacing: 0.08em;
      white-space: nowrap;
      text-transform: uppercase;
    }

    .default-tooltip::after {
      content: "";
      position: absolute;
      top: calc(100% - 1px);
      left: 50%;
      width: 0;
      height: 0;
      transform: translateX(-50%);
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-top: 5px solid rgba(248, 250, 252, 0.96);
    }
  `;

  @property({ type: Number }) radius = DEFAULT_RADIUS;
  @property({ type: Number }) scale = 1;
  @property({ type: Number, attribute: "offset-x" }) offsetX = 0;
  @property({ type: Number, attribute: "offset-y" }) offsetY = 0;
  @property({ type: Number }) rotation = 0;
  @property({ type: Object, attribute: "fresnel-config" })
  fresnelConfig: FresnelConfig = {
    rimIntensity: 1,
    color: "#ffffff",
    rimColor: "#ffffff",
    rimPower: 1,
  };
  @property({ type: Object, attribute: "atmosphere-config" })
  atmosphereConfig: AtmosphereConfig = {};
  @property({ type: Number, attribute: "point-count" }) pointCount = 21500;
  @property({ type: String, attribute: "land-point-color" })
  landPointColor: ColorRepresentation = "#f77114";
  @property({ type: Number, attribute: "point-size" }) pointSize = 0.06;
  @property({ type: Boolean, attribute: "auto-rotate" }) autoRotate = true;
  @property({ type: Boolean, attribute: "locked-polar-angle" })
  lockedPolarAngle = true;
  @property({ type: Array }) markers: GlobeMarker[] = [];
  @property({ type: Array, attribute: "focus-on" }) focusOn:
    | [number, number]
    | null = null;
  @property({ attribute: false })
  markerTooltip?: (context: GlobeMarkerTooltipContext) => unknown;

  private _cleanup?: () => void;
  private _updateUniforms?: (state: UniformUpdaterState) => void;
  private _syncFocusTarget?: (target: [number, number] | null) => void;
  private _markerRoots: HTMLDivElement[] = [];

  override firstUpdated() {
    const canvas = this.shadowRoot?.querySelector("canvas");
    const markers = this.shadowRoot?.querySelector(".markers");
    if (
      canvas instanceof HTMLCanvasElement &&
      markers instanceof HTMLDivElement
    ) {
      this._init(canvas, markers);
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._cleanup?.();
    this._cleanup = undefined;
  }

  override updated(changed: Map<string, unknown>) {
    if (
      changed.has("radius") ||
      changed.has("scale") ||
      changed.has("offsetX") ||
      changed.has("offsetY") ||
      changed.has("rotation") ||
      changed.has("fresnelConfig") ||
      changed.has("atmosphereConfig") ||
      changed.has("pointCount") ||
      changed.has("pointSize") ||
      changed.has("landPointColor")
    ) {
      this._updateUniforms?.(this._uniformState());
    }

    if (changed.has("focusOn")) {
      this._syncFocusTarget?.(this.focusOn);
    }
  }

  replay() {
    this._cleanup?.();
    this._cleanup = undefined;
    const canvas = this.shadowRoot?.querySelector("canvas");
    const markers = this.shadowRoot?.querySelector(".markers");
    if (
      canvas instanceof HTMLCanvasElement &&
      markers instanceof HTMLDivElement
    ) {
      this._init(canvas, markers);
    }
  }

  private _resolvedFresnelConfig(): Required<FresnelConfig> {
    const nextConfig = this.fresnelConfig ?? {};
    return {
      color: nextConfig.color ?? defaultFresnelConfig.color,
      rimColor: nextConfig.rimColor ?? defaultFresnelConfig.rimColor,
      rimPower: isFiniteNumber(nextConfig.rimPower)
        ? nextConfig.rimPower
        : defaultFresnelConfig.rimPower,
      rimIntensity: isFiniteNumber(nextConfig.rimIntensity)
        ? nextConfig.rimIntensity
        : defaultFresnelConfig.rimIntensity,
    };
  }

  private _resolvedAtmosphereConfig(): Required<AtmosphereConfig> {
    const nextConfig = this.atmosphereConfig ?? {};
    return {
      color: nextConfig.color ?? defaultAtmosphereConfig.color,
      scale: isFiniteNumber(nextConfig.scale)
        ? nextConfig.scale
        : defaultAtmosphereConfig.scale,
      power: isFiniteNumber(nextConfig.power)
        ? nextConfig.power
        : defaultAtmosphereConfig.power,
      coefficient: isFiniteNumber(nextConfig.coefficient)
        ? nextConfig.coefficient
        : defaultAtmosphereConfig.coefficient,
      intensity: isFiniteNumber(nextConfig.intensity)
        ? nextConfig.intensity
        : defaultAtmosphereConfig.intensity,
    };
  }

  private _uniformState(): UniformUpdaterState {
    return {
      radius: this.radius,
      scale: this.scale,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
      rotation: this.rotation,
      pointCount: this.pointCount,
      pointSize: this.pointSize,
      landPointColor: this.landPointColor,
      fresnelConfig: this._resolvedFresnelConfig(),
      atmosphereConfig: this._resolvedAtmosphereConfig(),
    };
  }

  private _ensureMarkerNodes(container: HTMLDivElement, count: number) {
    while (this._markerRoots.length < count) {
      const root = document.createElement("div");
      root.className = "marker-root";
      const tooltip = document.createElement("div");
      tooltip.className = "marker-tooltip";
      root.appendChild(tooltip);
      container.appendChild(root);
      this._markerRoots.push(root);
    }

    while (this._markerRoots.length > count) {
      const root = this._markerRoots.pop();
      root?.remove();
    }
  }

  private _renderMarkerTooltip(
    tooltip: HTMLDivElement,
    projected: ProjectedMarker,
  ) {
    if (this.markerTooltip) {
      const result = this.markerTooltip({
        marker: projected.marker,
        index: projected.index,
        visibility: projected.visibility,
      });
      if (result instanceof Node) {
        tooltip.replaceChildren(result);
      } else {
        renderTemplate(result as any, tooltip);
      }
      return;
    }

    renderTemplate(
      projected.marker.label
        ? html`<div class="default-tooltip">${projected.marker.label}</div>`
        : html``,
      tooltip,
    );
  }

  private _updateMarkerOverlay(
    container: HTMLDivElement,
    projectedMarkers: ProjectedMarker[],
  ) {
    this._ensureMarkerNodes(container, projectedMarkers.length);

    for (let index = 0; index < projectedMarkers.length; index += 1) {
      const projected = projectedMarkers[index];
      const root = this._markerRoots[index];
      const tooltip = root?.firstElementChild;

      if (!root || !(tooltip instanceof HTMLDivElement)) continue;

      root.style.left = `${projected.screenX * 100}%`;
      root.style.top = `${projected.screenY * 100}%`;

      if (this.markerTooltip || projected.marker.label) {
        tooltip.hidden = false;
        tooltip.style.opacity = `${projected.visibility}`;
        tooltip.style.filter = `blur(${(1 - projected.visibility) * MAX_TOOLTIP_BLUR}px)`;
        this._renderMarkerTooltip(tooltip, projected);
      } else {
        tooltip.hidden = true;
        tooltip.replaceChildren();
      }
    }
  }

  private _init(canvas: HTMLCanvasElement, markerOverlay: HTMLDivElement) {
    this._cleanup?.();
    this._markerRoots = [];
    markerOverlay.replaceChildren();

    const renderer = new Renderer({
      canvas,
      alpha: true,
      antialias: true,
      dpr: typeof window !== "undefined" ? window.devicePixelRatio : 1,
    });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);

    canvas.style.width = "100%";
    canvas.style.height = "100%";

    const camera = new Camera(gl);
    camera.position.z = 1;

    const globeScene = new Transform();
    const atmosphereScene = new Transform();
    const geometry = new Triangle(gl);
    const markerData = new Array<number>(MAX_SHADER_MARKERS * 4).fill(0);
    const markerColorData = new Array<number>(MAX_SHADER_MARKERS * 3).fill(0);
    const landTexture = new Texture(gl, {
      image: new Uint8Array([0, 0, 0, 255]),
      width: 1,
      height: 1,
      format: gl.RGBA,
      type: gl.UNSIGNED_BYTE,
      minFilter: gl.NEAREST,
      magFilter: gl.NEAREST,
      generateMipmaps: false,
      wrapS: gl.REPEAT,
      wrapT: gl.REPEAT,
    });

    const resolvedFresnelConfig = this._resolvedFresnelConfig();
    const resolvedAtmosphereConfig = this._resolvedAtmosphereConfig();
    const createColorUniform = (
      value: ColorRepresentation,
      fallback: [number, number, number],
    ) => {
      const [r, g, b] = toLinearRgb(value, fallback);
      return new Vec3(r, g, b);
    };

    console.log(resolvedFresnelConfig);

    const uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new Vec2(1, 1) },
      uRotation: { value: new Vec2(0, clampTheta(0, this.lockedPolarAngle)) },
      uScale: { value: radiusToScale(this.radius) },
      uDisplayScale: { value: this.scale },
      uDisplayOffset: { value: new Vec2(this.offsetX, this.offsetY) },
      uDisplayRotation: { value: this.rotation },
      uDots: { value: Math.max(1, Math.floor(this.pointCount)) },
      uPointRadius: { value: toPointRadius(this.pointSize) },
      // Seed the first frame with the resolved colors so the globe does not
      // depend on a later control update to leave the all-black placeholder state.
      uBaseColor: {
        value: createColorUniform(resolvedFresnelConfig.color, [
          17 / 255,
          17 / 255,
          19 / 255,
        ]),
      },
      uRimColor: {
        value: createColorUniform(resolvedFresnelConfig.rimColor, [
          1,
          105 / 255,
          0,
        ]),
      },
      uRimPower: { value: resolvedFresnelConfig.rimPower },
      uRimIntensity: { value: resolvedFresnelConfig.rimIntensity },
      uAtmosphereColor: {
        value: createColorUniform(resolvedAtmosphereConfig.color, [
          1,
          105 / 255,
          0,
        ]),
      },
      uAtmosphereScale: { value: resolvedAtmosphereConfig.scale },
      uAtmospherePower: { value: resolvedAtmosphereConfig.power },
      uAtmosphereCoefficient: { value: resolvedAtmosphereConfig.coefficient },
      uAtmosphereIntensity: { value: resolvedAtmosphereConfig.intensity },
      uLandPointColor: {
        value: createColorUniform(this.landPointColor, [
          247 / 255,
          113 / 255,
          20 / 255,
        ]),
      },
      uLandTexture: { value: landTexture },
      uMarkerCount: { value: 0 },
      uMarkerData: { value: markerData },
      uMarkerColor: { value: markerColorData },
    };

    const globeProgram = new Program(gl, {
      vertex: `
        attribute vec2 uv;
        attribute vec2 position;
        varying vec2 vUv;

        void main() {
          vUv = uv;
          gl_Position = vec4(position, 0.0, 1.0);
        }
      `,
      fragment: `
        precision highp float;

        varying vec2 vUv;

        uniform float uTime;
        uniform vec2 uResolution;
        uniform vec2 uRotation;
        uniform float uScale;
        uniform float uDisplayScale;
        uniform vec2 uDisplayOffset;
        uniform float uDisplayRotation;
        uniform float uDots;
        uniform float uPointRadius;
        uniform vec3 uBaseColor;
        uniform vec3 uRimColor;
        uniform float uRimPower;
        uniform float uRimIntensity;
        uniform vec3 uLandPointColor;
        uniform sampler2D uLandTexture;
        uniform float uMarkerCount;
        uniform vec4 uMarkerData[${MAX_SHADER_MARKERS}];
        uniform vec3 uMarkerColor[${MAX_SHADER_MARKERS}];

        const float kPi = 3.141592653589793;
        const float kTau = 6.283185307179586;
        const float kPhi = 1.618033988749895;
        const float kSqrt5 = 2.23606797749979;
        const float kSphereRadius = 0.8;
        const int kMaxMarkers = ${MAX_SHADER_MARKERS};

        float byDots;

        vec2 rotate2(vec2 p, float angle) {
          float c = cos(angle);
          float s = sin(angle);
          return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
        }

        vec2 transformUv(vec2 uv) {
          float aspect = uResolution.x / max(1.0, uResolution.y);
          vec2 centered = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
          vec2 transformed = rotate2(
            centered - vec2(uDisplayOffset.x * aspect, uDisplayOffset.y),
            -radians(uDisplayRotation)
          ) / max(uDisplayScale, 0.001);
          return vec2(transformed.x / aspect + 0.5, transformed.y + 0.5);
        }

        mat3 rotate(float theta, float phi) {
          float cx = cos(theta);
          float cy = cos(phi);
          float sx = sin(theta);
          float sy = sin(phi);
          return mat3(
            cy, sy * sx, -sy * cx,
            0.0, cx, sx,
            sy, cy * -sx, cy * cx
          );
        }

        vec3 nearestFibonacciLattice(vec3 p, out float m) {
          p = p.xzy;

          float k = max(2.0, floor(log2(kSqrt5 * uDots * kPi * (1.0 - p.z * p.z)) * 0.72021));
          vec2 f = floor(pow(kPhi, k) / kSqrt5 * vec2(1.0, kPhi) + 0.5);
          vec2 br1 = fract((f + 1.0) * (kPhi - 1.0)) * kTau - 3.883222;
          vec2 br2 = -2.0 * f;
          vec2 sp = vec2(atan(p.y, p.x), p.z - 1.0);
          vec2 c = floor(vec2(
            br2.y * sp.x - br1.y * (sp.y * uDots + 1.0),
            -br2.x * sp.x + br1.x * (sp.y * uDots + 1.0)
          ) / (br1.x * br2.y - br2.x * br1.y));

          float mindist = kPi;
          vec3 minip = vec3(0.0, 0.0, 1.0);

          for (float s = 0.0; s < 4.0; s += 1.0) {
            vec2 o = vec2(mod(s, 2.0), floor(s * 0.5));
            float idx = dot(f, c + o);
            if (idx > uDots) continue;

            float a = idx;
            float b = 0.0;
            if (a >= 16384.0) a -= 16384.0, b += 0.868872;
            if (a >= 8192.0) a -= 8192.0, b += 0.934436;
            if (a >= 4096.0) a -= 4096.0, b += 0.467218;
            if (a >= 2048.0) a -= 2048.0, b += 0.733609;
            if (a >= 1024.0) a -= 1024.0, b += 0.866804;
            if (a >= 512.0) a -= 512.0, b += 0.433402;
            if (a >= 256.0) a -= 256.0, b += 0.216701;
            if (a >= 128.0) a -= 128.0, b += 0.108351;
            if (a >= 64.0) a -= 64.0, b += 0.554175;
            if (a >= 32.0) a -= 32.0, b += 0.777088;
            if (a >= 16.0) a -= 16.0, b += 0.888544;
            if (a >= 8.0) a -= 8.0, b += 0.944272;
            if (a >= 4.0) a -= 4.0, b += 0.472136;
            if (a >= 2.0) a -= 2.0, b += 0.236068;
            if (a >= 1.0) a -= 1.0, b += 0.618034;

            float theta = fract(b) * kTau;
            float cosphi = 1.0 - 2.0 * idx * byDots;
            float sinphi = sqrt(max(0.0, 1.0 - cosphi * cosphi));
            vec3 samplePoint = vec3(cos(theta) * sinphi, sin(theta) * sinphi, cosphi);

            float dist = length(p - samplePoint);
            if (dist < mindist) {
              mindist = dist;
              minip = samplePoint;
            }
          }

          m = mindist;
          return minip.xzy;
        }

        vec2 pointToMaskUV(vec3 p) {
          float lengthP = length(p);
          if (lengthP <= 0.0) {
            return vec2(0.0, 0.0);
          }

          vec3 n = p / lengthP;

          float nx = n.z;
          float ny = n.y;
          float nz = -n.x;

          float gPhi = asin(clamp(ny, -1.0, 1.0));
          float cosPhi = cos(gPhi);

          float gTheta = 0.0;
          if (abs(cosPhi) > 1e-6) {
            float thetaInput = clamp(-nx / cosPhi, -1.0, 1.0);
            gTheta = acos(thetaInput);
            if (nz < 0.0) {
              gTheta = -gTheta;
            }
          }

          return vec2(
            fract((gTheta * 0.5) / kPi),
            fract(gPhi / kPi + 0.5)
          );
        }

        vec3 linearToSrgb(vec3 color) {
          vec3 safe = max(color, vec3(0.0));
          vec3 low = safe * 12.92;
          vec3 high = 1.055 * pow(safe, vec3(1.0 / 2.4)) - 0.055;
          vec3 cutoff = step(vec3(0.0031308), safe);
          return mix(low, high, cutoff);
        }

        void main() {
          byDots = 1.0 / max(1.0, uDots);

          vec2 uv = transformUv(vUv) * 2.0 - 1.0;
          uv.x *= uResolution.x / max(1.0, uResolution.y);
          uv /= max(0.0001, uScale);

          float l = dot(uv, uv);
          float globeR2 = kSphereRadius * kSphereRadius;

          vec3 color = vec3(0.0);
          float alpha = 0.0;

          if (l <= globeR2) {
            float dis;
            vec3 p = normalize(vec3(uv, sqrt(max(0.0, globeR2 - l))));
            mat3 rot = rotate(uRotation.y, uRotation.x);
            vec3 globePoint = p * rot;
            vec3 samplePoint = nearestFibonacciLattice(globePoint, dis);
            vec2 mapUv = pointToMaskUV(samplePoint);
            float land = texture2D(uLandTexture, mapUv).r;

            float landDots = step(0.5, land) * smoothstep(uPointRadius, 0.0, dis);

            float dotNV = clamp(p.z / kSphereRadius, 0.0, 1.0);
            float rim = pow(1.0 - dotNV, max(0.0001, uRimPower)) * uRimIntensity;
            float dotFade = smoothstep(0.04, 0.28, dotNV);
            landDots *= dotFade;

            vec3 markerColor = vec3(0.0);
            float markerMask = 0.0;
            float markerWeightSum = 0.0;
            for (int i = 0; i < kMaxMarkers; i++) {
              if (float(i) >= uMarkerCount) {
                break;
              }

              vec4 marker = uMarkerData[i];
              float markerDist = length(globePoint - marker.xyz);
              float markerCore = smoothstep(marker.w, marker.w * 0.62, markerDist);
              float pulse = fract(uTime * 0.85 + float(i) * 0.173);
              float pulseRadius = marker.w * mix(1.15, 2.8, pulse);
              float pulseWidth = marker.w * 0.42;
              float pulseInner = smoothstep(
                pulseRadius - pulseWidth,
                pulseRadius,
                markerDist
              );
              float pulseOuter =
                1.0 - smoothstep(pulseRadius, pulseRadius + pulseWidth, markerDist);
              float markerPulse = pulseInner * pulseOuter * (1.0 - pulse);
              float markerDot = max(markerCore, markerPulse * 0.72);
              markerMask = max(markerMask, markerDot);
              markerWeightSum += markerDot;
              markerColor += uMarkerColor[i] * markerDot;
            }

            if (markerWeightSum > 0.0) {
              markerColor /= markerWeightSum;
            }

            vec3 surface = uBaseColor;
            surface += uRimColor * rim;
            surface += uLandPointColor * (landDots * (1.0 - markerMask));

            vec3 boostedMarker = markerColor * (1.0 + 0.25 * markerMask);
            surface = mix(surface, boostedMarker, markerMask);

            color += surface;
            alpha = 1.0;
          }

          gl_FragColor = vec4(linearToSrgb(color), clamp(alpha, 0.0, 1.0));
        }
      `,
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });

    const atmosphereProgram = new Program(gl, {
      vertex: `
        attribute vec2 uv;
        attribute vec2 position;
        varying vec2 vUv;

        void main() {
          vUv = uv;
          gl_Position = vec4(position, 0.0, 1.0);
        }
      `,
      fragment: `
        precision highp float;

        varying vec2 vUv;

        uniform vec2 uResolution;
        uniform float uScale;
        uniform float uDisplayScale;
        uniform vec2 uDisplayOffset;
        uniform float uDisplayRotation;
        uniform vec3 uAtmosphereColor;
        uniform float uAtmosphereScale;
        uniform float uAtmospherePower;
        uniform float uAtmosphereCoefficient;
        uniform float uAtmosphereIntensity;

        const float kSphereRadius = 0.8;

        vec2 rotate2(vec2 p, float angle) {
          float c = cos(angle);
          float s = sin(angle);
          return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
        }

        vec2 transformUv(vec2 uv) {
          float aspect = uResolution.x / max(1.0, uResolution.y);
          vec2 centered = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
          vec2 transformed = rotate2(
            centered - vec2(uDisplayOffset.x * aspect, uDisplayOffset.y),
            -radians(uDisplayRotation)
          ) / max(uDisplayScale, 0.001);
          return vec2(transformed.x / aspect + 0.5, transformed.y + 0.5);
        }

        vec3 linearToSrgb(vec3 color) {
          vec3 safe = max(color, vec3(0.0));
          vec3 low = safe * 12.92;
          vec3 high = 1.055 * pow(safe, vec3(1.0 / 2.4)) - 0.055;
          vec3 cutoff = step(vec3(0.0031308), safe);
          return mix(low, high, cutoff);
        }

        void main() {
          vec2 uv = transformUv(vUv) * 2.0 - 1.0;
          uv.x *= uResolution.x / max(1.0, uResolution.y);
          uv /= max(0.0001, uScale);

          float globeR = kSphereRadius;
          float atmosphereR = kSphereRadius * max(1.0, uAtmosphereScale);
          float l = dot(uv, uv);
          float radial = sqrt(l);

          if (radial <= globeR) {
            discard;
          }

          float shellWidth = max(1e-5, atmosphereR - globeR);
          float x = (radial - globeR) / shellWidth;
          if (x > 3.0) {
            discard;
          }

          float falloff = exp(-pow(max(0.0, x), 1.2) * max(0.15, uAtmospherePower * 0.09));
          float finalFactor =
            falloff * uAtmosphereIntensity * max(0.0, uAtmosphereCoefficient);

          vec3 finalColor = uAtmosphereColor * finalFactor;
          float alpha = finalFactor;

          gl_FragColor = vec4(linearToSrgb(finalColor), clamp(alpha, 0.0, 1.0));
        }
      `,
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    atmosphereProgram.setBlendFunc(gl.SRC_ALPHA, gl.ONE);

    const globeMesh = new Mesh(gl, {
      geometry,
      program: globeProgram,
      frustumCulled: false,
    });
    globeMesh.setParent(globeScene);

    const atmosphereMesh = new Mesh(gl, {
      geometry,
      program: atmosphereProgram,
      frustumCulled: false,
    });
    atmosphereMesh.setParent(atmosphereScene);

    let currentScale = radiusToScale(this.radius);
    const tempColor = new Vec3();
    const setColor = (
      target: Vec3,
      value: ColorRepresentation,
      fallback: [number, number, number],
    ) => {
      const [r, g, b] = toLinearRgb(value, fallback);
      target.set(r, g, b);
    };

    this._updateUniforms = (state) => {
      currentScale = radiusToScale(state.radius);
      uniforms.uScale.value = currentScale;
      uniforms.uDisplayScale.value = Math.max(0.001, state.scale);
      uniforms.uDisplayOffset.value.set(state.offsetX, state.offsetY);
      uniforms.uDisplayRotation.value = state.rotation;
      uniforms.uDots.value = Math.max(1, Math.floor(state.pointCount));
      uniforms.uPointRadius.value = toPointRadius(state.pointSize);

      setColor(uniforms.uBaseColor.value, state.fresnelConfig.color, [
        17 / 255,
        17 / 255,
        19 / 255,
      ]);
      setColor(uniforms.uRimColor.value, state.fresnelConfig.rimColor, [
        1,
        105 / 255,
        0,
      ]);
      uniforms.uRimPower.value = Math.max(0.0001, state.fresnelConfig.rimPower);
      uniforms.uRimIntensity.value = Math.max(
        0,
        state.fresnelConfig.rimIntensity,
      );

      setColor(uniforms.uAtmosphereColor.value, state.atmosphereConfig.color, [
        1,
        105 / 255,
        0,
      ]);
      uniforms.uAtmosphereScale.value = Math.max(
        1,
        state.atmosphereConfig.scale,
      );
      uniforms.uAtmospherePower.value = Math.max(
        0.0001,
        state.atmosphereConfig.power,
      );
      uniforms.uAtmosphereCoefficient.value = Math.max(
        0,
        state.atmosphereConfig.coefficient,
      );
      uniforms.uAtmosphereIntensity.value = Math.max(
        0,
        state.atmosphereConfig.intensity,
      );

      setColor(tempColor, state.landPointColor, [
        247 / 255,
        113 / 255,
        20 / 255,
      ]);
      uniforms.uLandPointColor.value.set(tempColor.x, tempColor.y, tempColor.z);
    };

    this._updateUniforms(this._uniformState());

    let width = 1;
    let height = 1;

    const startTheta = clampTheta(0, this.lockedPolarAngle);
    let phi = 0;
    let theta = startTheta;
    let targetPhi = phi;
    let targetTheta = startTheta;
    let focusTween: gsap.core.Tween | null = null;

    const applyDisplayTransform = (x: number, y: number, aspect: number) => {
      const nextScale = Math.max(0.001, this.scale);
      const angle = this.rotation * DEG2RAD;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const ax = x * aspect * nextScale;
      const ay = y * nextScale;

      return {
        x: (ax * cos - ay * sin + this.offsetX * aspect * 2) / aspect,
        y: ax * sin + ay * cos - this.offsetY * 2,
      };
    };

    const syncMarkers = (
      currentPhi: number,
      currentTheta: number,
      currentScaleValue: number,
    ) => {
      const markerRadius = COBE_GLOBE_RADIUS;
      const aspect = width / Math.max(1, height);
      const markerCount = Math.min(this.markers.length, MAX_SHADER_MARKERS);
      markerData.fill(0);
      markerColorData.fill(0);
      uniforms.uMarkerCount.value = markerCount;

      const nextMarkers: ProjectedMarker[] = [];
      for (let index = 0; index < this.markers.length; index += 1) {
        const marker = this.markers[index];
        const position = lonLatToCartesian(
          marker.location[1],
          marker.location[0],
          markerRadius,
        );
        const rotated = applyRotation(
          position.x,
          position.y,
          position.z,
          currentPhi,
          currentTheta,
        );

        const ndcX = (rotated.rx / aspect) * currentScaleValue;
        const ndcY = -rotated.ry * currentScaleValue;
        const transformed = applyDisplayTransform(ndcX, ndcY, aspect);
        const screenX = (transformed.x + 1) * 0.5;
        const screenY = (transformed.y + 1) * 0.5;

        const frontDot = rotated.rz / markerRadius;
        const rawVisibility = smoothstep(
          frontDot,
          VISIBILITY_MIN_DOT,
          VISIBILITY_MAX_DOT,
        );
        const visibility = dynamicEase(rawVisibility);

        nextMarkers.push({
          marker,
          index,
          screenX,
          screenY,
          visibility,
        });

        if (index >= markerCount) continue;

        const unitPosition = lonLatToCartesian(
          marker.location[1],
          marker.location[0],
          1,
        );
        const markerDataOffset = index * 4;
        markerData[markerDataOffset] = unitPosition.x;
        markerData[markerDataOffset + 1] = unitPosition.y;
        markerData[markerDataOffset + 2] = unitPosition.z;
        markerData[markerDataOffset + 3] = clamp(
          (marker.size ?? 0.05) * SHADER_MARKER_SIZE_SCALE,
          MIN_SHADER_MARKER_SIZE,
          MAX_SHADER_MARKER_SIZE,
        );

        const [r, g, b] = toLinearRgb(marker.color ?? "#ffffff", [1, 1, 1]);
        const markerColorOffset = index * 3;
        markerColorData[markerColorOffset] = r;
        markerColorData[markerColorOffset + 1] = g;
        markerColorData[markerColorOffset + 2] = b;
      }

      this._updateMarkerOverlay(markerOverlay, nextMarkers);
    };

    this._syncFocusTarget = (target) => {
      focusTween?.kill();
      focusTween = null;
      if (!target) return;

      const [lat, lon] = target;
      const direction = lonLatToCartesian(lon, lat, 1);
      const targetRotation = cartesianToRotation(
        direction.x,
        direction.y,
        direction.z,
      );
      const desiredTheta = clampTheta(
        targetRotation.theta,
        this.lockedPolarAngle,
      );
      const desiredPhi = shortestAngleTarget(targetPhi, targetRotation.phi);

      const tweenState = { phi: targetPhi, theta: targetTheta };
      focusTween = gsap.to(tweenState, {
        phi: desiredPhi,
        theta: desiredTheta,
        duration: 1.5,
        ease: "power2.inOut",
        onUpdate: () => {
          targetPhi = tweenState.phi;
          targetTheta = clampTheta(tweenState.theta, this.lockedPolarAngle);
        },
        overwrite: true,
      });
    };

    this._syncFocusTarget(this.focusOn);

    let dragging = false;
    let activePointerId = -1;
    let lastPointerX = 0;
    let lastPointerY = 0;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      dragging = true;
      activePointerId = event.pointerId;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
      focusTween?.kill();
      focusTween = null;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging || event.pointerId !== activePointerId) return;
      const dx = event.clientX - lastPointerX;
      const dy = event.clientY - lastPointerY;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      targetPhi += dx * ROTATE_SENSITIVITY;
      targetTheta = clampTheta(
        targetTheta + dy * ROTATE_SENSITIVITY,
        this.lockedPolarAngle,
      );
    };

    const stopDragging = (event: PointerEvent) => {
      if (event.pointerId !== activePointerId) return;
      dragging = false;
      activePointerId = -1;
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", stopDragging);
    canvas.addEventListener("pointercancel", stopDragging);
    canvas.addEventListener("lostpointercapture", stopDragging);

    let disposed = false;

    const image = new Image();
    image.onload = () => {
      if (disposed) return;
      landTexture.image = image;
      landTexture.needsUpdate = true;
      this._updateUniforms?.(this._uniformState());
    };
    image.onerror = (error) => {
      console.warn("motion-globe: failed to load land mask texture", error);
    };
    image.src = LAND_TEXTURE_URL;
    if (image.complete && image.naturalWidth > 0) {
      landTexture.image = image;
      landTexture.needsUpdate = true;
      this._updateUniforms?.(this._uniformState());
    }

    let raf = 0;
    let previous = 0;
    const tick = (now: number) => {
      const w = Math.max(1, canvas.clientWidth);
      const h = Math.max(1, canvas.clientHeight);
      const bufW = Math.round(w * renderer.dpr);
      const bufH = Math.round(h * renderer.dpr);
      if (canvas.width !== bufW || canvas.height !== bufH) {
        canvas.width = bufW;
        canvas.height = bufH;
        renderer.width = w;
        renderer.height = h;
        renderer.state.viewport = {
          x: 0,
          y: 0,
          width: null as any,
          height: null as any,
        };
        width = w;
        height = h;
        uniforms.uResolution.value.set(w, h);
      }

      const delta = previous ? (now - previous) / 1000 : 0;
      previous = now;
      uniforms.uTime.value += delta;

      if (this.autoRotate) {
        targetPhi -= AUTO_ROTATE_SPEED * delta;
      }
      targetTheta = clampTheta(targetTheta, this.lockedPolarAngle);

      const easing = 1 - Math.exp(-delta * SMOOTHING_STRENGTH);
      phi += (targetPhi - phi) * easing;
      theta += (targetTheta - theta) * easing;

      uniforms.uRotation.value.set(phi, theta);

      syncMarkers(phi, theta, currentScale);
      renderer.render({ scene: globeScene, camera, clear: true });
      renderer.render({ scene: atmosphereScene, camera, clear: false });
      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);

    this._cleanup = () => {
      disposed = true;
      focusTween?.kill();
      focusTween = null;
      window.cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", stopDragging);
      canvas.removeEventListener("pointercancel", stopDragging);
      canvas.removeEventListener("lostpointercapture", stopDragging);

      globeMesh.setParent(null);
      atmosphereMesh.setParent(null);
      geometry.remove();
      globeProgram.remove();
      atmosphereProgram.remove();
      this._updateUniforms = undefined;
      this._syncFocusTarget = undefined;
    };
  }

  override render() {
    return html`
      <canvas aria-hidden="true"></canvas>
      <div class="markers" aria-hidden="true"></div>
    `;
  }
}
