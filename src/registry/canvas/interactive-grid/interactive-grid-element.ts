import { LitElement, html, css } from "lit"
import { customElement, property } from "lit/decorators.js"
import { Camera, Mesh, Program, Renderer, Texture, Transform, Triangle, Vec2 } from "ogl"

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

  uniform vec2 uResolution;
  uniform vec2 uTextureSize;
  uniform sampler2D uDataTexture;
  uniform sampler2D uTexture;
  varying vec2 vUv;

  vec2 getCoverUV(vec2 uv, vec2 textureSize) {
    vec2 s = uResolution / textureSize;
    float scale = max(s.x, s.y);
    vec2 scaledSize = textureSize * scale;
    vec2 offset = (uResolution - scaledSize) * 0.5;
    return (uv * uResolution - offset) / scaledSize;
  }

  void main() {
    vec2 coverUv = getCoverUV(vUv, uTextureSize);
    vec4 data = texture2D(uDataTexture, vUv);
    vec2 displacedUV = coverUv - 0.02 * data.rg;
    vec4 color = texture2D(uTexture, displacedUV);
    gl_FragColor = color;
  }
`

type GridState = {
  size: number
  data: Float32Array
  texture: Texture
}

@customElement("motion-interactive-grid")
export class MotionInteractiveGrid extends LitElement {
  static override styles = css`
    :host { display: block; position: relative; width: 100%; height: 100%; }
    canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
  `

  @property({ type: String, attribute: "src" })
  src = ""

  @property({ type: Number, attribute: "grid" })
  grid = 15

  @property({ type: Number, attribute: "mouse-size" })
  mouseSize = 0.15

  @property({ type: Number, attribute: "strength" })
  strength = 0.35

  @property({ type: Number, attribute: "relaxation" })
  relaxation = 0.9

  private _raf = 0
  private _cancelled = false
  private _imageToken = 0
  private _mouseX = 0
  private _mouseY = 0
  private _currentVX = 0
  private _currentVY = 0
  private _prevX = 0
  private _prevY = 0
  private _gl?: WebGLRenderingContext | WebGL2RenderingContext
  private _gridState?: GridState
  private _imageTexture?: Texture
  private _uniforms?: {
    uResolution: { value: Vec2 }
    uTextureSize: { value: Vec2 }
    uDataTexture: { value: Texture }
    uTexture: { value: Texture }
  }
  private _onMouseMove?: (e: MouseEvent) => void

  override firstUpdated() {
    this._init(this.shadowRoot!.querySelector("canvas")!)
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._cancelled = true
    this._imageToken += 1
    cancelAnimationFrame(this._raf)
    const canvas = this.shadowRoot?.querySelector("canvas")
    if (canvas && this._onMouseMove) {
      canvas.removeEventListener("mousemove", this._onMouseMove as any)
    }
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has("src") && this._imageTexture && this._uniforms && this.src) {
      this._loadImage(this.src)
    }
    if (changed.has("grid") && this._gl && this._uniforms) {
      const prev = this._gridState
      this._gridState = this._createGridState(this._gl, this.grid)
      this._uniforms.uDataTexture.value = this._gridState.texture
      if (prev?.texture.texture) {
        this._gl.deleteTexture(prev.texture.texture)
      }
    }
  }

  replay() {
    // Interactive — no replay needed
  }

  private _normalizeGridSize(value: number) {
    return Math.max(1, Math.round(value))
  }

  private _createGridState(gl: WebGLRenderingContext | WebGL2RenderingContext, gridSize: number): GridState {
    const size = this._normalizeGridSize(gridSize)
    const total = size * size
    const data = new Float32Array(4 * total)

    for (let i = 0; i < total; i++) {
      const r = Math.random() * 255 - 125
      const r1 = Math.random() * 255 - 125
      const stride = i * 4
      data[stride] = r
      data[stride + 1] = r1
      data[stride + 2] = r
      data[stride + 3] = 255
    }

    const isWebgl2 = typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext
    const internalFormat = isWebgl2 ? (gl as WebGL2RenderingContext).RGBA32F : gl.RGBA

    const texture = new Texture(gl as any, {
      image: data,
      width: size,
      height: size,
      format: gl.RGBA,
      internalFormat,
      type: gl.FLOAT,
      minFilter: gl.NEAREST,
      magFilter: gl.NEAREST,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
      generateMipmaps: false,
      flipY: false,
    })

    return { size, data, texture }
  }

  private _loadImage(source: string) {
    this._imageToken += 1
    const token = this._imageToken
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.decoding = "async"
    img.onload = () => {
      if (this._cancelled || token !== this._imageToken) return
      if (this._imageTexture) {
        this._imageTexture.image = img
      }
      if (this._uniforms) {
        this._uniforms.uTextureSize.value.set(
          img.naturalWidth || img.width || 1,
          img.naturalHeight || img.height || 1,
        )
      }
    }
    img.src = source
  }

  private _init(canvas: HTMLCanvasElement) {
    this._cancelled = false

    const renderer = new Renderer({ canvas, alpha: true, dpr: window.devicePixelRatio })
    const gl = renderer.gl
    this._gl = gl as any
    gl.clearColor(0, 0, 0, 0)
    canvas.style.width = "100%"
    canvas.style.height = "100%"

    const camera = new Camera(gl)
    camera.position.z = 1
    const scene = new Transform()
    const geometry = new Triangle(gl)

    const imageTexture = new Texture(gl, {
      image: new Uint8Array([0, 0, 0, 255]),
      width: 1,
      height: 1,
      format: gl.RGBA,
      type: gl.UNSIGNED_BYTE,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
      generateMipmaps: false,
      flipY: true,
    })
    this._imageTexture = imageTexture

    const gridState = this._createGridState(gl as any, this.grid)
    this._gridState = gridState

    const uniforms = {
      uResolution: { value: new Vec2(1, 1) },
      uTextureSize: { value: new Vec2(1, 1) },
      uDataTexture: { value: gridState.texture },
      uTexture: { value: imageTexture },
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

    if (this.src) {
      this._loadImage(this.src)
    }

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const newX = (e.clientX - rect.left) / rect.width
      const newY = (e.clientY - rect.top) / rect.height
      this._currentVX = newX - this._prevX
      this._currentVY = newY - this._prevY
      this._prevX = newX
      this._prevY = newY
      this._mouseX = newX
      this._mouseY = newY
    }
    this._onMouseMove = onMouseMove
    canvas.addEventListener("mousemove", onMouseMove)

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
      void delta

      const gs = this._gridState!
      const { size, data } = gs
      const gridMouseX = size * this._mouseX
      const gridMouseY = size * (1 - this._mouseY)
      const maxDist = size * this.mouseSize
      const width = uniforms.uResolution.value.x
      const height = uniforms.uResolution.value.y
      const aspect = width > 0 ? height / width : 1
      const maxDistSq = maxDist * maxDist

      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          const distance =
            ((gridMouseX - i) * (gridMouseX - i)) / aspect +
            (gridMouseY - j) * (gridMouseY - j)

          if (distance < maxDistSq) {
            const index = 4 * (i + size * j)
            let power = maxDist / Math.sqrt(distance)
            if (!Number.isFinite(power) || power > 10) power = 10
            data[index] += this.strength * 100 * this._currentVX * power
            data[index + 1] -= this.strength * 100 * this._currentVY * power
          }

          const idx = 4 * (i + size * j)
          data[idx] *= this.relaxation
          data[idx + 1] *= this.relaxation
        }
      }

      this._currentVX *= 0.9
      this._currentVY *= 0.9
      gs.texture.needsUpdate = true

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
    "motion-interactive-grid": MotionInteractiveGrid
  }
}
