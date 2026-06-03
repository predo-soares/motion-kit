import { LitElement, html, css } from "lit"
import { customElement, property } from "lit/decorators.js"
import { Camera, Mesh, Program, Renderer, Transform, Triangle, Vec2, Vec3 } from "ogl"
import { toLinearRgb, type ColorRepresentation } from "@/lib/helpers/color"

const VERTEX = `
  attribute vec2 uv;
  attribute vec2 position;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`

const FRAGMENT = `
  precision highp float;
  varying vec2 vUv;

  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec3 uColor;
  uniform vec3 uBackgroundColor;
  uniform float uSpeed;
  uniform float uDistortion;
  uniform float uHueShift;
  uniform float uIntensity;

  mat3 hueRot(float a) {
    float c = cos(a), s = sin(a), t = 1.0 - c;
    return mat3(
    t*.333+c,    t*.333-s*.577, t*.333+s*.577,
    t*.333+s*.577, t*.333+c,   t*.333-s*.577,
    t*.333-s*.577, t*.333+s*.577, t*.333+c
    );
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

    vec3 additive = bg + effect;
    vec3 effectHue = hueFromColor(effect, vec3(1.0));
    vec3 tintTarget = mix(bg, effectHue, 0.9);
    vec3 tint = mix(bg, tintTarget, edge);

    return mix(additive, tint, lightBg);
  }

  vec3 linearToSrgb(vec3 color) {
    vec3 safe = max(color, vec3(0.0));
    vec3 low = safe * 12.92;
    vec3 high = 1.055 * pow(safe, vec3(1.0 / 2.4)) - 0.055;
    vec3 cutoff = step(vec3(0.0031308), safe);
    return mix(low, high, cutoff);
  }

  void mainImage(out vec4 o, vec2 uv) {
    vec2 u = (uv * 2.0 - 1.0);
    u.x *= uResolution.x / uResolution.y;

    float time = uTime * uSpeed;

    u /= 0.5 + uDistortion * dot(u, u);
    u += 0.2 * cos(time) - 7.56;

    vec3 baseColor = uColor;

    vec3 palette[3];
    palette[0] = baseColor;
    palette[1] = hueRot(radians(uHueShift)) * baseColor;
    palette[2] = hueRot(radians(-uHueShift)) * baseColor;

    vec3 col = vec3(0.0);
    float edgeField = 0.0;
    for(int i = 0; i < 3; i++) {
      vec2 uv_loop = sin(1.5 * u.yx + 2.0 * cos(u -= 0.01));
      float val = 1.0 - exp(-6.0 / exp(6.0 * length(uv_loop + sin(5.0 * uv_loop.y - 3.0 * time) / 4.0)));
      val = pow(clamp(val, 0.0, 1.0), 1.4);
      edgeField += val;
      col += val * palette[i];
    }
    vec3 bands = col * uIntensity;
    float softMask = 1.0 - exp(-0.85 * edgeField * uIntensity);
    vec3 rgb = blendAdaptive(uBackgroundColor, bands, softMask);
    o = vec4(rgb, 1.0);
  }

  void main() {
    vec4 fragColor;
    mainImage(fragColor, vUv);
    fragColor.rgb = linearToSrgb(fragColor.rgb);
    gl_FragColor = fragColor;
  }
`

@customElement("motion-specular-band")
export class MotionSpecularBand extends LitElement {
  static override styles = css`
    :host { display: block; position: relative; width: 100%; height: 100%; }
    canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
  `

  @property({ type: String, attribute: "color" })
  color: ColorRepresentation = "#FF6900"

  @property({ type: String, attribute: "background-color" })
  backgroundColor: ColorRepresentation = "#17181A"

  @property({ type: Number })
  speed = 1.0

  @property({ type: Number })
  distortion = 0.2

  @property({ type: Number })
  hueShift = 30.0

  @property({ type: Number })
  intensity = 1.0

  private _raf = 0
  private _cancelled = false
  private _uTime?: { value: number }
  private _uniforms?: {
    uTime: { value: number }
    uResolution: { value: Vec2 }
    uColor: { value: Vec3 }
    uBackgroundColor: { value: Vec3 }
    uSpeed: { value: number }
    uDistortion: { value: number }
    uHueShift: { value: number }
    uIntensity: { value: number }
  }

  override firstUpdated() {
    this._init(this.shadowRoot!.querySelector("canvas")!)
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._cancelled = true
    cancelAnimationFrame(this._raf)
  }

  override updated(changed: Map<string, unknown>) {
    if (this._uniforms) {
      if (changed.has("color")) {
        const [r, g, b] = toLinearRgb(this.color, [1, 105 / 255, 0])
        this._uniforms.uColor.value.set(r, g, b)
      }
      if (changed.has("backgroundColor")) {
        const [r, g, b] = toLinearRgb(this.backgroundColor, [23 / 255, 24 / 255, 26 / 255])
        this._uniforms.uBackgroundColor.value.set(r, g, b)
      }
      if (changed.has("speed")) {
        this._uniforms.uSpeed.value = this.speed
      }
      if (changed.has("distortion")) {
        this._uniforms.uDistortion.value = this.distortion
      }
      if (changed.has("hueShift")) {
        this._uniforms.uHueShift.value = this.hueShift
      }
      if (changed.has("intensity")) {
        this._uniforms.uIntensity.value = this.intensity
      }
    }
  }

  replay() {
    this._cancelled = true
    cancelAnimationFrame(this._raf)
    this._uTime = undefined
    this._init(this.shadowRoot!.querySelector("canvas")!)
  }

  private _init(canvas: HTMLCanvasElement) {
    this._cancelled = false

    const renderer = new Renderer({ canvas, alpha: true, dpr: window.devicePixelRatio })
    const gl = renderer.gl
    gl.clearColor(0, 0, 0, 0)
    canvas.style.width = "100%"
    canvas.style.height = "100%"

    const camera = new Camera(gl)
    camera.position.z = 1
    const scene = new Transform()
    const geometry = new Triangle(gl)

    const initialColor = toLinearRgb(this.color, [1, 105 / 255, 0])
    const initialBackgroundColor = toLinearRgb(this.backgroundColor, [23 / 255, 24 / 255, 26 / 255])

    const uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new Vec2(1, 1) },
      uColor: {
        value: new Vec3(initialColor[0], initialColor[1], initialColor[2]),
      },
      uBackgroundColor: {
        value: new Vec3(initialBackgroundColor[0], initialBackgroundColor[1], initialBackgroundColor[2]),
      },
      uSpeed: { value: this.speed },
      uDistortion: { value: this.distortion },
      uHueShift: { value: this.hueShift },
      uIntensity: { value: this.intensity },
    }
    this._uniforms = uniforms
    this._uTime = uniforms.uTime

    const program = new Program(gl, {
      vertex: VERTEX,
      fragment: FRAGMENT,
      uniforms,
      depthTest: false,
      depthWrite: false,
    })

    const mesh = new Mesh(gl, { geometry, program })
    mesh.setParent(scene)

    let previous = 0
    const tick = (now: number) => {
      if (this._cancelled) return

      const w = Math.max(1, canvas.clientWidth)
      const h = Math.max(1, canvas.clientHeight)
      const bufW = Math.round(w * renderer.dpr)
      const bufH = Math.round(h * renderer.dpr)
      if (canvas.width !== bufW || canvas.height !== bufH) {
        canvas.width = bufW
        canvas.height = bufH
        renderer.width = w
        renderer.height = h
        ;(renderer.state as any).viewport = { x: 0, y: 0, width: null, height: null }
        uniforms.uResolution.value.set(w, h)
      }

      const delta = previous ? (now - previous) / 1000 : 0
      previous = now
      uniforms.uTime.value += delta

      renderer.render({ scene, camera })
      this._raf = requestAnimationFrame(tick)
    }

    this._raf = requestAnimationFrame(tick)
  }

  override render() {
    return html`<canvas aria-hidden="true"></canvas>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "motion-specular-band": MotionSpecularBand
  }
}
