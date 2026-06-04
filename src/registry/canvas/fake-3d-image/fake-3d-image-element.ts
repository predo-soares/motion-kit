import { LitElement, html, css } from "lit"
import { customElement, property } from "lit/decorators.js"
import { Camera, Mesh, Program, Renderer, Texture, Transform, Triangle, Vec2 } from "ogl"

@customElement("motion-fake-3d-image")
export class MotionFake3DImage extends LitElement {
  static override styles = css`
    :host { display: block; position: relative; width: 100%; height: 100%; }
    canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
  `

  @property({ attribute: "color-src" }) colorSrc = ""
  @property({ attribute: "depth-src" }) depthSrc = ""
  @property({ type: Number, attribute: "x-threshold" }) xThreshold = 8
  @property({ type: Number, attribute: "y-threshold" }) yThreshold = 8
  @property({ type: Number }) sensitivity = 0.25

  private _raf = 0
  private _cancelled = false
  private _uniforms?: { uThreshold: { value: Vec2 } }
  private _setColor?: (src: string) => void
  private _setDepth?: (src: string) => void
  private _canvas?: HTMLCanvasElement
  private _onMove?: (e: PointerEvent) => void
  private _onLeave?: () => void

  override firstUpdated() {
    this._init(this.shadowRoot!.querySelector("canvas")!)
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._cancelled = true
    cancelAnimationFrame(this._raf)
    this._removePointerListeners()
  }

  override updated(changed: Map<string, unknown>) {
    if (!this._uniforms) return
    if (changed.has("xThreshold") || changed.has("yThreshold")) {
      this._uniforms.uThreshold.value.set(this.xThreshold, this.yThreshold)
    }
    if (changed.has("colorSrc") && this._setColor) this._setColor(this.colorSrc)
    if (changed.has("depthSrc") && this._setDepth) this._setDepth(this.depthSrc)
  }

  replay() {
    this._cancelled = true
    cancelAnimationFrame(this._raf)
    this._init(this.shadowRoot!.querySelector("canvas")!)
  }

  private _init(canvas: HTMLCanvasElement) {
    this._removePointerListeners()
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

    const colorTexture = new Texture(gl, { image: new Uint8Array([0, 0, 0, 255]), width: 1, height: 1, format: gl.RGBA, type: gl.UNSIGNED_BYTE, minFilter: gl.LINEAR, magFilter: gl.LINEAR, wrapS: gl.CLAMP_TO_EDGE, wrapT: gl.CLAMP_TO_EDGE, generateMipmaps: true, flipY: true })
    const depthTexture = new Texture(gl, { image: new Uint8Array([127, 127, 127, 255]), width: 1, height: 1, format: gl.RGBA, type: gl.UNSIGNED_BYTE, minFilter: gl.LINEAR, magFilter: gl.LINEAR, wrapS: gl.CLAMP_TO_EDGE, wrapT: gl.CLAMP_TO_EDGE, generateMipmaps: true, flipY: true })

    const resolution = new Vec2(1, 1)
    const mouse = new Vec2(0, 0)
    const threshold = new Vec2(this.xThreshold, this.yThreshold)
    const colorSize = new Vec2(1, 1)
    const depthSize = new Vec2(1, 1)
    this._uniforms = { uThreshold: { value: threshold } }

    const uniforms = {
      uOriginalTexture: { value: colorTexture },
      uDepthTexture: { value: depthTexture },
      uMouse: { value: mouse },
      uThreshold: { value: threshold },
      uResolution: { value: resolution },
      uOriginalTextureSize: { value: colorSize },
      uDepthTextureSize: { value: depthSize },
    }

    let colToken = 0
    this._setColor = (src) => {
      colToken++; const tok = colToken
      const img = new Image(); img.crossOrigin = "anonymous"; img.decoding = "async"
      img.onload = () => { if (tok !== colToken) return; colorTexture.image = img; colorSize.set(img.naturalWidth || 1, img.naturalHeight || 1) }
      img.src = src
    }

    let depToken = 0
    this._setDepth = (src) => {
      depToken++; const tok = depToken
      const img = new Image(); img.crossOrigin = "anonymous"; img.decoding = "async"
      img.onload = () => { if (tok !== depToken) return; depthTexture.image = img; depthSize.set(img.naturalWidth || 1, img.naturalHeight || 1) }
      img.src = src
    }

    if (this.colorSrc) this._setColor(this.colorSrc)
    if (this.depthSrc) this._setDepth(this.depthSrc)

    const program = new Program(gl, {
      vertex: `attribute vec2 uv; attribute vec2 position; varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }`,
      fragment: `
        precision mediump float;
        uniform sampler2D uOriginalTexture; uniform sampler2D uDepthTexture;
        uniform vec2 uMouse; uniform vec2 uThreshold; uniform vec2 uResolution;
        uniform vec2 uOriginalTextureSize; uniform vec2 uDepthTextureSize;
        varying vec2 vUv;
        vec2 mirrored(vec2 v) { vec2 m = mod(v, 2.0); return mix(m, 2.0 - m, step(1.0, m)); }
        vec2 coverUV(vec2 uv, vec2 texSize) {
          vec2 s = uResolution / max(texSize, vec2(1.0));
          float sc = max(s.x, s.y);
          vec2 ss = texSize * sc;
          vec2 off = (uResolution - ss) * 0.5;
          return (uv * uResolution - off) / ss;
        }
        void main() {
          vec2 baseUv = mirrored(coverUV(vUv, uOriginalTextureSize));
          vec2 depthUv = mirrored(coverUV(vUv, uDepthTextureSize));
          float depth = texture2D(uDepthTexture, depthUv).r;
          vec2 t = max(uThreshold, vec2(0.00001));
          vec2 fake3d = vec2(baseUv.x + (depth - 0.5) * uMouse.x / t.x, baseUv.y + (depth - 0.5) * uMouse.y / t.y);
          gl_FragColor = texture2D(uOriginalTexture, mirrored(fake3d));
        }
      `,
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })

    const mesh = new Mesh(gl, { geometry, program })
    mesh.setParent(scene)

    const target = new Vec2(0, 0), smooth = new Vec2(0, 0)
    this._canvas = canvas
    this._onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      target.x = ((e.clientX - r.left) / r.width) * 2 - 1
      target.y = -(((e.clientY - r.top) / r.height) * 2 - 1)
    }
    this._onLeave = () => { target.x = 0; target.y = 0 }
    canvas.addEventListener("pointermove", this._onMove)
    canvas.addEventListener("pointerleave", this._onLeave)

    let prev = 0
    const tick = (now: number) => {
      if (this._cancelled) return
      const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight)
      const bw = Math.round(w * renderer.dpr), bh = Math.round(h * renderer.dpr)
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw; canvas.height = bh; renderer.width = w; renderer.height = h
        renderer.state.viewport = { x: 0, y: 0, width: null as any, height: null as any }
        resolution.set(w, h)
      }
      const delta = prev ? (now - prev) / 1000 : 0; prev = now
      const lerp = Math.min(1, 5 * delta)
      smooth.x += (target.x * this.sensitivity - smooth.x) * lerp
      smooth.y += (target.y * this.sensitivity - smooth.y) * lerp
      mouse.set(smooth.x, smooth.y)
      renderer.render({ scene, camera })
      this._raf = requestAnimationFrame(tick)
    }
    this._raf = requestAnimationFrame(tick)
  }

  override render() {
    return html`<canvas></canvas>`
  }

  private _removePointerListeners() {
    if (this._canvas && this._onMove) {
      this._canvas.removeEventListener("pointermove", this._onMove)
    }
    if (this._canvas && this._onLeave) {
      this._canvas.removeEventListener("pointerleave", this._onLeave)
    }
    this._canvas = undefined
    this._onMove = undefined
    this._onLeave = undefined
  }
}
