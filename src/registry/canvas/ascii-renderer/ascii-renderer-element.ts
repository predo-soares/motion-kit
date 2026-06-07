import { LitElement, html, css } from "lit"
import { customElement, property } from "lit/decorators.js"
import { Camera, Mesh, Program, Renderer, Texture, Transform, Triangle, Vec2, Vec3 } from "ogl"
import { toLinearRgb, type ColorRepresentation } from "@/lib/helpers/color"

@customElement("motion-ascii-renderer")
export class MotionAsciiRenderer extends LitElement {
  static override styles = css`
    :host { display: block; position: relative; width: 100%; height: 100%; }
    canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
  `

  @property() image = ""
  @property({ type: Number }) density = 25.0
  @property({ type: Number }) strength = 3.0
  @property() color: ColorRepresentation = "#6c87bc"
  @property({ attribute: "background-color" }) backgroundColor: ColorRepresentation = "#17181A"

  private _raf = 0
  private _cancelled = false
  private _uniforms?: {
    uDensity: { value: number }
    uStrength: { value: number }
    uColor: { value: Vec3 }
    uBackgroundColor: { value: Vec3 }
  }
  private _setImage?: (src: string) => void

  override firstUpdated() {
    this._init(this.shadowRoot!.querySelector("canvas")!)
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._cancelled = true
    cancelAnimationFrame(this._raf)
  }

  override updated(changed: Map<string, unknown>) {
    if (!this._uniforms) return
    if (changed.has("density")) this._uniforms.uDensity.value = this.density
    if (changed.has("strength")) this._uniforms.uStrength.value = this.strength
    if (changed.has("color")) { const [r, g, b] = toLinearRgb(this.color, [108 / 255, 135 / 255, 188 / 255]); this._uniforms.uColor.value.set(r, g, b) }
    if (changed.has("backgroundColor")) { const [r, g, b] = toLinearRgb(this.backgroundColor, [23 / 255, 24 / 255, 26 / 255]); this._uniforms.uBackgroundColor.value.set(r, g, b) }
    if (changed.has("image") && this._setImage) this._setImage(this.image)
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

    const imageTexture = new Texture(gl, {
      image: new Uint8Array([0, 0, 0, 255]),
      width: 1, height: 1,
      format: gl.RGBA, type: gl.UNSIGNED_BYTE,
      minFilter: gl.LINEAR, magFilter: gl.LINEAR,
      wrapS: gl.CLAMP_TO_EDGE, wrapT: gl.CLAMP_TO_EDGE,
      generateMipmaps: false, flipY: true,
    })

    const resolution = new Vec2(1, 1)
    const coverScale = new Vec2(1, 1)
    const coverOffset = new Vec2(0, 0)
    const [cr, cg, cb] = toLinearRgb(this.color, [108 / 255, 135 / 255, 188 / 255])
    const [br, bg, bb] = toLinearRgb(this.backgroundColor, [23 / 255, 24 / 255, 26 / 255])

    let imgW = 1, imgH = 1
    const updateCover = (rw: number, rh: number) => {
      const sa = rw / rh, ia = imgW / imgH
      let sx = 1, sy = 1, ox = 0, oy = 0
      if (sa > ia) { sy = ia / sa; oy = (1 - sy) * 0.5 }
      else { sx = sa / ia; ox = (1 - sx) * 0.5 }
      coverScale.set(sx, sy); coverOffset.set(ox, oy)
    }

    const uniforms = {
      uTime: { value: 0 },
      uResolution: { value: resolution },
      uTexture: { value: imageTexture },
      uCoverScale: { value: coverScale },
      uCoverOffset: { value: coverOffset },
      uDensity: { value: this.density },
      uStrength: { value: this.strength },
      uColor: { value: new Vec3(cr, cg, cb) },
      uBackgroundColor: { value: new Vec3(br, bg, bb) },
    }
    this._uniforms = uniforms as any

    let imgToken = 0
    this._setImage = (src: string) => {
      imgToken++; const tok = imgToken
      const img = new Image(); img.crossOrigin = "anonymous"; img.decoding = "async"
      img.onload = () => {
        if (tok !== imgToken) return
        imageTexture.image = img
        imgW = img.naturalWidth || 1; imgH = img.naturalHeight || 1
        updateCover(resolution.x, resolution.y)
      }
      img.src = src
    }
    if (this.image) this._setImage(this.image)

    const program = new Program(gl, {
      vertex: `attribute vec2 uv; attribute vec2 position; varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }`,
      fragment: `
        precision highp float;
        uniform float uTime; uniform vec2 uResolution;
        uniform sampler2D uTexture; uniform vec2 uCoverScale; uniform vec2 uCoverOffset;
        uniform float uDensity; uniform float uStrength;
        uniform vec3 uColor; uniform vec3 uBackgroundColor;
        varying vec2 vUv;
        vec2 mirrored(vec2 v) { vec2 m = mod(v, 2.0); return mix(m, 2.0 - m, step(1.0, m)); }
        float digit(vec2 p, float intensity) {
          p = (fract(p) - 0.5) * 1.2 + 0.5;
          if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) return 0.0;
          float x = fract(p.x * 5.0);
          float y = fract((1.0 - p.y) * 5.0);
          int i = int(floor((1.0 - p.y) * 5.0));
          int j = int(floor(p.x * 5.0));
          int n = (i - 2) * (i - 2) + (j - 2) * (j - 2);
          float f = float(n) / 16.0;
          float isOn = smoothstep(0.1, 0.2, intensity - f);
          return isOn * (0.2 + y * 4.0 / 5.0) * (0.75 + x / 4.0);
        }
        float onOff(float a, float b, float c) {
          return step(c, sin(uTime + a * cos(uTime * b)));
        }
        float displace(vec2 look) {
          float y = look.y - mod(uTime / 4.0, 1.0);
          float window = 1.0 / (1.0 + 50.0 * y * y);
          return sin(look.y * 20.0 + uTime) / 80.0 * onOff(4.0, 2.0, 0.8) * (1.0 + cos(uTime * 60.0)) * window;
        }
        vec3 linearToSrgb(vec3 c) {
          vec3 s = max(c, vec3(0.0));
          vec3 lo = s * 12.92;
          vec3 hi = 1.055 * pow(s, vec3(1.0 / 2.4)) - 0.055;
          return mix(lo, hi, step(vec3(0.0031308), s));
        }
        void main() {
          vec2 p = vUv;
          float aspect = uResolution.x / max(uResolution.y, 1.0);
          p.x *= aspect;
          vec2 pDisp = p;
          pDisp.x += displace(p) * 0.5;
          vec2 grid = vec2(3.0, 1.0) * uDensity;
          vec2 cellIdx = floor(pDisp * grid);
          vec2 cellCenterP = (cellIdx + 0.5) / grid;
          vec2 cellUv = cellCenterP;
          cellUv.x /= aspect;
          vec2 imgUv = cellUv * uCoverScale + uCoverOffset;
          vec3 texColor = texture2D(uTexture, mirrored(imgUv)).rgb;
          float intensity = dot(texColor, vec3(0.299, 0.587, 0.114));
          intensity = pow(intensity, 2.8);
          float bar = mod(p.y + uTime * 20.0, 1.0) < 0.2 ? 1.4 : 1.0;
          vec2 gridP = pDisp * grid;
          float middle = digit(gridP, intensity * 1.3 * uStrength);
          float off = 0.002;
          float sum = 0.0;
          for (float i = -1.0; i < 2.0; i += 1.0)
            for (float j = -1.0; j < 2.0; j += 1.0)
              sum += digit(gridP + vec2(off * i * grid.x, off * j * grid.y), intensity * 1.3 * uStrength);
          vec3 emission = vec3(0.6) * middle + sum / 15.0 * uColor * bar;
          vec3 finalColor = uBackgroundColor + emission;
          gl_FragColor = vec4(linearToSrgb(finalColor), 1.0);
        }
      `,
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })

    const mesh = new Mesh(gl, { geometry, program, frustumCulled: false })
    mesh.setParent(scene)

    let prev = 0
    const tick = (now: number) => {
      if (this._cancelled) return
      const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight)
      const bw = Math.round(w * renderer.dpr), bh = Math.round(h * renderer.dpr)
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw; canvas.height = bh; renderer.width = w; renderer.height = h
        renderer.state.viewport = { x: 0, y: 0, width: null as any, height: null as any }
        resolution.set(w, h); updateCover(w, h)
      }
      const delta = prev ? (now - prev) / 1000 : 0; prev = now
      uniforms.uTime.value += delta
      renderer.render({ scene, camera })
      this._raf = requestAnimationFrame(tick)
    }
    this._raf = requestAnimationFrame(tick)
  }

  override render() {
    return html`<canvas></canvas>`
  }
}
