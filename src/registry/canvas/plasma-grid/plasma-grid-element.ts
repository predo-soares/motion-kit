import { LitElement, html, css } from "lit"
import { customElement, property } from "lit/decorators.js"
import { Camera, Mesh, Program, Renderer, Transform, Triangle, Vec3 } from "ogl"
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
  uniform vec3 uResolution;
  uniform vec3 uBaseColor;
  uniform vec3 uGradientColor;

  float rand(vec2 p) {
    return fract(sin(dot(p, vec2(12.543,514.123)))*4732.12);
  }

  float noise(vec2 p) {
    vec2 f = smoothstep(0.0, 1.0, fract(p));
    vec2 i = floor(p);
    float a = rand(i);
    float b = rand(i+vec2(1.0,0.0));
    float c = rand(i+vec2(0.0,1.0));
    float d = rand(i+vec2(1.0,1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    float n = 2.0;
    vec2 uv = fragCoord/uResolution.y;
    vec2 uvp = fragCoord/uResolution.xy;
    uv += 0.75*noise(uv*3.0+uTime/2.0+noise(uv*7.0-uTime/3.0)/2.0)/2.0;

    float grid = (mod(floor((uvp.x)*uResolution.x/n),2.0)==0.0?1.0:0.0) *
                 (mod(floor((uvp.y)*uResolution.y/n),2.0)==0.0?1.0:0.0);

    vec3 col = mix(uBaseColor, uGradientColor,
                   5.0 * vec3(pow(1.0-noise(uv*4.0-vec2(0.0, uTime/2.0)), 5.0)));

    col = pow(col, vec3(1.0));
    float alpha = grid;
    fragColor = vec4(col, alpha);
  }

  vec3 linearToSrgb(vec3 color) {
    vec3 safe = max(color, vec3(0.0));
    vec3 low = safe * 12.92;
    vec3 high = 1.055 * pow(safe, vec3(1.0 / 2.4)) - 0.055;
    vec3 cutoff = step(vec3(0.0031308), safe);
    return mix(low, high, cutoff);
  }

  void main() {
    vec4 fragColor;
    vec2 fragCoord = vUv * uResolution.xy;
    mainImage(fragColor, fragCoord);
    fragColor.rgb = linearToSrgb(fragColor.rgb);
    gl_FragColor = fragColor;
  }
`

@customElement("motion-plasma-grid")
export class MotionPlasmaGrid extends LitElement {
  static override styles = css`
    :host { display: block; position: relative; width: 100%; height: 100%; }
    canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
  `

  @property({ type: String, attribute: "color" })
  color: ColorRepresentation = "#17181A"

  @property({ type: String, attribute: "highlight-color" })
  highlightColor: ColorRepresentation = "#FF6900"

  @property({ type: Number })
  speed = 0.5

  private _raf = 0
  private _cancelled = false
  private _uniforms?: {
    uTime: { value: number }
    uResolution: { value: Vec3 }
    uBaseColor: { value: Vec3 }
    uGradientColor: { value: Vec3 }
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
        const [r, g, b] = toLinearRgb(this.color, [17 / 255, 17 / 255, 19 / 255])
        this._uniforms.uBaseColor.value.set(r, g, b)
      }
      if (changed.has("highlightColor")) {
        const [r, g, b] = toLinearRgb(this.highlightColor, [1, 105 / 255, 0])
        this._uniforms.uGradientColor.value.set(r, g, b)
      }
    }
  }

  replay() {
    this._cancelled = true
    cancelAnimationFrame(this._raf)
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

    const initialBaseColor = toLinearRgb(this.color, [17 / 255, 17 / 255, 19 / 255])
    const initialHighlightColor = toLinearRgb(this.highlightColor, [1, 105 / 255, 0])

    const uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new Vec3(1, 1, 1) },
      uBaseColor: {
        value: new Vec3(
          initialBaseColor[0],
          initialBaseColor[1],
          initialBaseColor[2],
        ),
      },
      uGradientColor: {
        value: new Vec3(
          initialHighlightColor[0],
          initialHighlightColor[1],
          initialHighlightColor[2],
        ),
      },
    }
    this._uniforms = uniforms

    const program = new Program(gl, {
      vertex: VERTEX,
      fragment: FRAGMENT,
      uniforms,
      transparent: true,
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
        uniforms.uResolution.value.set(w, h, 1)
      }

      const delta = previous ? (now - previous) / 1000 : 0
      previous = now
      uniforms.uTime.value += delta * this.speed

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
    "motion-plasma-grid": MotionPlasmaGrid
  }
}
