import { LitElement, css, html } from "lit"
import { customElement, property } from "lit/decorators.js"
import {
  Camera,
  Mesh,
  Program,
  Renderer,
  Transform,
  Triangle,
  Vec2,
  Vec3,
} from "ogl"
import { toLinearRgb, type ColorRepresentation } from "@/lib/helpers/color"

@customElement("motion-god-rays")
export class MotionGodRays extends LitElement {
  static override styles = css`
    :host {
      display: block;
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    canvas {
      position: absolute;
      inset: 0;
      display: block;
      width: 100%;
      height: 100%;
    }
  `

  @property() color: ColorRepresentation = "#FFFFFF"
  @property({ attribute: "background-color" }) backgroundColor: ColorRepresentation =
    "#17181A"
  @property({ type: Number, attribute: "anchor-x" }) anchorX = 0.5
  @property({ type: Number, attribute: "anchor-y" }) anchorY = 1.2
  @property({ type: Number, attribute: "direction-x" }) directionX = 0
  @property({ type: Number, attribute: "direction-y" }) directionY = -1
  @property({ type: Number }) speed = 1
  @property({ type: Number, attribute: "light-spread" }) lightSpread = 1
  @property({ type: Number, attribute: "ray-length" }) rayLength = 1
  @property({ type: Boolean }) pulsating = false
  @property({ type: Number, attribute: "fade-distance" }) fadeDistance = 1
  @property({ type: Number }) saturation = 1
  @property({ type: Number, attribute: "noise-amount" }) noiseAmount = 0
  @property({ type: Number }) distortion = 0
  @property({ type: Number }) intensity = 1

  private _raf = 0
  private _uniforms?: {
    uColor: { value: Vec3 }
    uBackgroundColor: { value: Vec3 }
    uAnchorX: { value: number }
    uAnchorY: { value: number }
    uRayDir: { value: Vec2 }
    uSpeed: { value: number }
    uLightSpread: { value: number }
    uRayLength: { value: number }
    uPulsating: { value: number }
    uFadeDistance: { value: number }
    uSaturation: { value: number }
    uNoiseAmount: { value: number }
    uDistortion: { value: number }
    uIntensity: { value: number }
  }

  override firstUpdated() {
    const canvas = this.shadowRoot?.querySelector("canvas")
    if (canvas instanceof HTMLCanvasElement) {
      this._init(canvas)
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    cancelAnimationFrame(this._raf)
  }

  override updated(changed: Map<string, unknown>) {
    if (!this._uniforms) return

    if (changed.has("color")) {
      const [r, g, b] = toLinearRgb(this.color, [1, 1, 1])
      this._uniforms.uColor.value.set(r, g, b)
    }

    if (changed.has("backgroundColor")) {
      const [r, g, b] = toLinearRgb(this.backgroundColor, [
        23 / 255,
        24 / 255,
        26 / 255,
      ])
      this._uniforms.uBackgroundColor.value.set(r, g, b)
    }

    if (changed.has("anchorX")) this._uniforms.uAnchorX.value = this.anchorX
    if (changed.has("anchorY")) this._uniforms.uAnchorY.value = this.anchorY
    if (changed.has("directionX") || changed.has("directionY")) {
      this._uniforms.uRayDir.value.set(this.directionX, this.directionY)
    }
    if (changed.has("speed")) this._uniforms.uSpeed.value = this.speed
    if (changed.has("lightSpread")) {
      this._uniforms.uLightSpread.value = this.lightSpread
    }
    if (changed.has("rayLength")) this._uniforms.uRayLength.value = this.rayLength
    if (changed.has("pulsating")) {
      this._uniforms.uPulsating.value = this.pulsating ? 1 : 0
    }
    if (changed.has("fadeDistance")) {
      this._uniforms.uFadeDistance.value = this.fadeDistance
    }
    if (changed.has("saturation")) {
      this._uniforms.uSaturation.value = this.saturation
    }
    if (changed.has("noiseAmount")) {
      this._uniforms.uNoiseAmount.value = this.noiseAmount
    }
    if (changed.has("distortion")) {
      this._uniforms.uDistortion.value = this.distortion
    }
    if (changed.has("intensity")) this._uniforms.uIntensity.value = this.intensity
  }

  replay() {
    cancelAnimationFrame(this._raf)
    const canvas = this.shadowRoot?.querySelector("canvas")
    if (canvas instanceof HTMLCanvasElement) {
      this._init(canvas)
    }
  }

  private _init(canvas: HTMLCanvasElement) {
    cancelAnimationFrame(this._raf)

    const renderer = new Renderer({
      canvas,
      alpha: true,
      dpr: typeof window !== "undefined" ? window.devicePixelRatio : 1,
    })
    const gl = renderer.gl
    gl.clearColor(0, 0, 0, 0)

    canvas.style.width = "100%"
    canvas.style.height = "100%"

    const camera = new Camera(gl)
    camera.position.z = 1

    const scene = new Transform()
    const geometry = new Triangle(gl)

    const initialColor = toLinearRgb(this.color, [1, 1, 1])
    const initialBackground = toLinearRgb(this.backgroundColor, [
      23 / 255,
      24 / 255,
      26 / 255,
    ])

    const uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new Vec2(1, 1) },
      uColor: { value: new Vec3(initialColor[0], initialColor[1], initialColor[2]) },
      uBackgroundColor: {
        value: new Vec3(
          initialBackground[0],
          initialBackground[1],
          initialBackground[2],
        ),
      },
      uAnchorX: { value: this.anchorX },
      uAnchorY: { value: this.anchorY },
      uRayDir: { value: new Vec2(this.directionX, this.directionY) },
      uSpeed: { value: this.speed },
      uLightSpread: { value: this.lightSpread },
      uRayLength: { value: this.rayLength },
      uPulsating: { value: this.pulsating ? 1 : 0 },
      uFadeDistance: { value: this.fadeDistance },
      uSaturation: { value: this.saturation },
      uNoiseAmount: { value: this.noiseAmount },
      uDistortion: { value: this.distortion },
      uIntensity: { value: this.intensity },
    }

    this._uniforms = uniforms

    const program = new Program(gl, {
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
        uniform vec3 uColor;
        uniform vec3 uBackgroundColor;
        uniform float uAnchorX;
        uniform float uAnchorY;
        uniform vec2 uRayDir;
        uniform float uSpeed;
        uniform float uLightSpread;
        uniform float uRayLength;
        uniform float uPulsating;
        uniform float uFadeDistance;
        uniform float uSaturation;
        uniform float uNoiseAmount;
        uniform float uDistortion;
        uniform float uIntensity;

        float noise2(vec2 st) {
          return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453123);
        }

        float ditherNoise(vec2 p) {
          return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
        }

        float colorLuma(vec3 c) {
          return dot(c, vec3(0.2126, 0.7152, 0.0722));
        }

        vec3 hueFromColor(vec3 c, vec3 fallback) {
          float m = max(max(c.r, c.g), c.b);
          if (m < 1e-5) return fallback;
          return clamp(c / m, 0.0, 1.0);
        }

        vec3 blendAdaptive(vec3 bg, vec3 effect, float softness) {
          float bgLum = colorLuma(bg);
          float lightBg = smoothstep(0.45, 0.95, bgLum);
          float edge = clamp(softness, 0.0, 1.0);
          float tintEnergy = 1.0 - exp(-4.0 * colorLuma(effect));

          vec3 additive = bg + effect;
          vec3 effectHue = hueFromColor(effect, vec3(1.0));
          vec3 tintTarget = mix(bg, effectHue, 0.9);
          vec3 tint = mix(bg, tintTarget, edge * tintEnergy);

          return mix(additive, tint, lightBg);
        }

        vec3 linearToSrgb(vec3 color) {
          vec3 safe = max(color, vec3(0.0));
          vec3 low = safe * 12.92;
          vec3 high = 1.055 * pow(safe, vec3(1.0 / 2.4)) - 0.055;
          vec3 cutoff = step(vec3(0.0031308), safe);
          return mix(low, high, cutoff);
        }

        float rayStrength(
          vec2 raySource,
          vec2 rayDir,
          vec2 coord,
          float seedA,
          float seedB,
          float speed,
          float time,
          float maxDim
        ) {
          vec2 sourceToCoord = coord - raySource;
          vec2 dirNorm = normalize(sourceToCoord);
          float cosAngle = dot(dirNorm, rayDir);

          float distortedAngle = cosAngle
            + uDistortion * sin(time * 2.0 + length(sourceToCoord) * 0.01) * 0.2;

          float spreadFactor = pow(max(distortedAngle, 0.0), 1.0 / max(uLightSpread, 0.001));

          float dist = length(sourceToCoord);
          float maxDist = maxDim * uRayLength;
          float lengthFalloff = clamp((maxDist - dist) / maxDist, 0.0, 1.0);

          float fadeFalloff = clamp(
            (maxDim * uFadeDistance - dist) / (maxDim * uFadeDistance),
            0.5, 1.0
          );

          float pulse = (uPulsating > 0.5) ? (0.8 + 0.2 * sin(time * speed * 3.0)) : 1.0;

          float baseStrength = clamp(
            (0.45 + 0.15 * sin(distortedAngle * seedA + time * speed)) +
            (0.3 + 0.2 * cos(-distortedAngle * seedB + time * speed)),
            0.0, 1.0
          );

          return baseStrength * lengthFalloff * fadeFalloff * spreadFactor * pulse;
        }

        void mainImage(out vec4 col, vec2 fragCoord) {
          vec2 resolution = uResolution;
          float time = uTime;

          vec2 coord = fragCoord;
          vec2 rayPos = vec2(uAnchorX, uAnchorY) * resolution;
          vec2 rayDir = normalize(uRayDir);

          float maxDim = length(resolution);

          float rs1 = rayStrength(rayPos, rayDir, coord, 36.2214, 21.11349, 1.5 * uSpeed, time, maxDim);
          float rs2 = rayStrength(rayPos, rayDir, coord, 22.3991, 18.0234, 1.1 * uSpeed, time, maxDim);

          float intensityScale = max(uIntensity, 0.0);
          float intensityForShape = clamp(intensityScale, 0.0, 1.0);
          float shapeExponent = mix(2.35, 1.35, intensityForShape);
          float strength = rs1 * 0.5 + rs2 * 0.4;
          float shapedStrength = pow(clamp(strength, 0.0, 1.0), shapeExponent);
          float softMask = 1.0 - exp(-3.0 * shapedStrength);
          vec3 rayColor = uColor * shapedStrength * intensityScale;

          if (uNoiseAmount > 0.0) {
            float n = noise2(coord * 0.01 + time * 0.1);
            float noiseMix = 1.0 - uNoiseAmount + uNoiseAmount * n;
            rayColor *= noiseMix;
            softMask *= mix(1.0, noiseMix, 0.5);
          }

          vec3 rgb = blendAdaptive(uBackgroundColor, rayColor, softMask);

          if (uSaturation != 1.0) {
            float gray = dot(rgb, vec3(0.299, 0.587, 0.114));
            rgb = mix(vec3(gray), rgb, uSaturation);
          }

          rgb += (ditherNoise(fragCoord + vec2(uTime * 60.0)) - 0.5) / 255.0;
          rgb = clamp(rgb, 0.0, 1.0);

          col = vec4(rgb, 1.0);
        }

        void main() {
          vec4 fragColor;
          vec2 fragCoord = vUv * uResolution.xy;
          mainImage(fragColor, fragCoord);
          fragColor.rgb = linearToSrgb(fragColor.rgb);
          gl_FragColor = fragColor;
        }
      `,
      uniforms,
      depthTest: false,
      depthWrite: false,
    })

    const mesh = new Mesh(gl, { geometry, program })
    mesh.setParent(scene)

    let previous = 0
    const tick = (now: number) => {
      const w = Math.max(1, canvas.clientWidth)
      const h = Math.max(1, canvas.clientHeight)
      const bufW = Math.round(w * renderer.dpr)
      const bufH = Math.round(h * renderer.dpr)
      if (canvas.width !== bufW || canvas.height !== bufH) {
        canvas.width = bufW
        canvas.height = bufH
        renderer.width = w
        renderer.height = h
        renderer.state.viewport = { x: 0, y: 0, width: null as any, height: null as any }
        uniforms.uResolution.value.set(w, h)
      }

      const delta = previous ? (now - previous) / 1000 : 0
      previous = now
      uniforms.uTime.value += delta
      renderer.render({ scene, camera })
      this._raf = window.requestAnimationFrame(tick)
    }

    this._raf = window.requestAnimationFrame(tick)
  }

  override render() {
    return html`<canvas aria-hidden="true"></canvas>`
  }
}
