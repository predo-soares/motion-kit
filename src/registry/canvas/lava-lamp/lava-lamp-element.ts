import { LitElement, html, css } from "lit"
import { customElement, property } from "lit/decorators.js"
import { Camera, Mesh, Program, Renderer, Transform, Triangle, Vec3, Vec4 } from "ogl"
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
  uniform vec4 uResolution;
  uniform float uScale;
  uniform vec3 uOffset;
  uniform vec3 uColor;
  uniform vec3 uFresnelColor;
  uniform float uFresnelPower;
  uniform float uRadius;
  uniform float uSmoothness;

  mat4 rotationMatrix(vec3 axis, float angle) {
    axis = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;
    return mat4(
      oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
      oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
      oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
      0.0,                                0.0,                                0.0,                                1.0
    );
  }

  vec3 rotate(vec3 v, vec3 axis, float angle) {
    mat4 m = rotationMatrix(axis, angle);
    return (m * vec4(v, 1.0)).xyz;
  }

  vec3 transformRayPoint(vec3 p) {
    vec3 translated = p - vec3(uOffset.x * 2.0, uOffset.y * 2.0, 0.0);
    return rotate(translated, vec3(0.0, 0.0, 1.0), -uOffset.z) / max(uScale, 0.001);
  }

  float smin(float a, float b, float k) {
    k *= 6.0;
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * h * k * (1.0 / 6.0);
  }

  float sphereSDF(vec3 p, float r) {
    return length(p) - r;
  }

  float sdf(vec3 p) {
    p = transformRayPoint(p);
    vec3 p1 = rotate(p, vec3(0.0, 0.0, 1.0), uTime / 5.0);
    vec3 p2 = rotate(p, vec3(1.0, 1.0, 1.0), -uTime / 5.0);
    vec3 p3 = rotate(p, vec3(1.0, 1.0, 0.0), -uTime / 4.5);
    vec3 p4 = rotate(p, vec3(0.0, 1.0, 0.0), -uTime / 4.0);

    float r = uRadius;

    float final = sphereSDF(p1 - vec3(-0.5, 0.0, 0.0), 0.35 * r);
    float next = sphereSDF(p2 - vec3(0.55, 0.0, 0.0), 0.3 * r);
    final = smin(final, next, uSmoothness);
    next = sphereSDF(p2 - vec3(-0.8, 0.0, 0.0), 0.2 * r);
    final = smin(final, next, uSmoothness);
    next = sphereSDF(p3 - vec3(1.0, 0.0, 0.0), 0.15 * r);
    final = smin(final, next, uSmoothness);
    next = sphereSDF(p4 - vec3(0.45, -0.45, 0.0), 0.15 * r);
    final = smin(final, next, uSmoothness);

    return final * max(uScale, 0.001);
  }

  vec3 getNormal(vec3 p) {
    float d = 0.001;
    return normalize(vec3(
      sdf(p + vec3(d, 0.0, 0.0)) - sdf(p - vec3(d, 0.0, 0.0)),
      sdf(p + vec3(0.0, d, 0.0)) - sdf(p - vec3(0.0, d, 0.0)),
      sdf(p + vec3(0.0, 0.0, d)) - sdf(p - vec3(0.0, 0.0, d))
    ));
  }

  float rayMarch(vec3 rayOrigin, vec3 ray) {
    float t = 0.0;
    for (int i = 0; i < 100; i++) {
      vec3 p = rayOrigin + ray * t;
      float d = sdf(p);
      if (d < 0.001) return t;
      t += d;
      if (t > 100.0) break;
    }
    return -1.0;
  }

  vec3 linearToSrgb(vec3 c) {
    vec3 safe = max(c, vec3(0.0));
    vec3 low = safe * 12.92;
    vec3 high = 1.055 * pow(safe, vec3(1.0 / 2.4)) - 0.055;
    vec3 cutoff = step(vec3(0.0031308), safe);
    return mix(low, high, cutoff);
  }

  void main() {
    vec3 cameraPos = vec3(0.0, 0.0, 5.0);
    vec3 ray = normalize(vec3((vUv - vec2(0.5)) * uResolution.zw, -1.0));

    float t = rayMarch(cameraPos, ray);
    if (t > 0.0) {
      vec3 p = cameraPos + ray * t;
      vec3 normal = getNormal(p);
      float fresnel = pow(1.0 + dot(ray, normal), uFresnelPower);
      vec3 color = mix(uColor, uFresnelColor, fresnel);
      gl_FragColor = vec4(linearToSrgb(color), 1.0);
    } else {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    }
  }
`

@customElement("motion-lava-lamp")
export class MotionLavaLamp extends LitElement {
  static override styles = css`
    :host { display: block; position: relative; width: 100%; height: 100%; }
    canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
  `

  @property({ type: Number }) scale = 1
  @property({ type: Number, attribute: "offset-x" }) offsetX = 0
  @property({ type: Number, attribute: "offset-y" }) offsetY = 0
  @property({ type: Number }) rotation = 0
  @property({ type: String }) color: ColorRepresentation = "#17181A"
  @property({ type: String, attribute: "fresnel-color" }) fresnelColor: ColorRepresentation = "#ff6900"
  @property({ type: Number }) speed = 1.0
  @property({ type: Number, attribute: "fresnel-power" }) fresnelPower = 3.0
  @property({ type: Number }) radius = 1
  @property({ type: Number }) smoothness = 0.1

  private _raf = 0
  private _cancelled = false
  private _uniforms?: {
    uTime: { value: number }
    uResolution: { value: Vec4 }
    uScale: { value: number }
    uOffset: { value: Vec3 }
    uColor: { value: Vec3 }
    uFresnelColor: { value: Vec3 }
    uFresnelPower: { value: number }
    uRadius: { value: number }
    uSmoothness: { value: number }
  }
  private _time = 0

  override firstUpdated() {
    this._init(this.shadowRoot!.querySelector("canvas")!)
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._cancelled = true
    cancelAnimationFrame(this._raf)
  }

  override updated(changed: Map<string, unknown>) {
    const u = this._uniforms
    if (!u) return
    if (changed.has("color")) {
      const [r, g, b] = toLinearRgb(this.color, [24 / 255, 24 / 255, 27 / 255])
      u.uColor.value.set(r, g, b)
    }
    if (changed.has("fresnelColor")) {
      const [r, g, b] = toLinearRgb(this.fresnelColor, [1, 105 / 255, 0])
      u.uFresnelColor.value.set(r, g, b)
    }
    if (changed.has("scale")) u.uScale.value = this.scale
    if (changed.has("offsetX") || changed.has("offsetY") || changed.has("rotation")) {
      u.uOffset.value.set(this.offsetX, this.offsetY, (this.rotation * Math.PI) / 180)
    }
    if (changed.has("fresnelPower")) u.uFresnelPower.value = this.fresnelPower
    if (changed.has("radius")) u.uRadius.value = this.radius
    if (changed.has("smoothness")) u.uSmoothness.value = this.smoothness
  }

  replay() {
    this._cancelled = true
    cancelAnimationFrame(this._raf)
    this._uniforms = undefined
    this._time = 0
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

    const initialColor = toLinearRgb(this.color, [24 / 255, 24 / 255, 27 / 255])
    const initialFresnelColor = toLinearRgb(this.fresnelColor, [1, 105 / 255, 0])

    const uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new Vec4(1, 1, 1, 1) },
      uScale: { value: this.scale },
      uOffset: { value: new Vec3(this.offsetX, this.offsetY, (this.rotation * Math.PI) / 180) },
      uColor: { value: new Vec3(initialColor[0], initialColor[1], initialColor[2]) },
      uFresnelColor: { value: new Vec3(initialFresnelColor[0], initialFresnelColor[1], initialFresnelColor[2]) },
      uFresnelPower: { value: this.fresnelPower },
      uRadius: { value: this.radius },
      uSmoothness: { value: this.smoothness },
    }
    this._uniforms = uniforms

    const program = new Program(gl, {
      vertex: VERTEX,
      fragment: FRAGMENT,
      uniforms,
      transparent: true,
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
        const a1 = h / w > 1 ? w / h : 1
        const a2 = h / w > 1 ? 1 : h / w
        uniforms.uResolution.value.set(w, h, a1, a2)
      }

      const delta = previous ? (now - previous) / 1000 : 0
      previous = now
      this._time += delta * this.speed
      uniforms.uTime.value = this._time

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
    "motion-lava-lamp": MotionLavaLamp
  }
}
