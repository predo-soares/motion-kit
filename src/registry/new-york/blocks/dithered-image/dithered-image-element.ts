import { LitElement, html, css } from "lit"
import { customElement, property } from "lit/decorators.js"
import { Camera, Mesh, Program, Renderer, Texture, Transform, Triangle, Vec2, Vec3 } from "ogl"
import { toLinearRgb, type ColorRepresentation } from "@/lib/helpers/color"

type DitherMap = "bayer4x4" | "bayer8x8" | "halftone" | "voidAndCluster"

const THRESHOLD_MAPS: Record<DitherMap, number[]> = {
  bayer4x4: [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5],
  bayer8x8: [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21],
  halftone: [24, 10, 12, 26, 35, 47, 49, 37, 8, 0, 2, 14, 45, 59, 61, 51, 22, 6, 4, 16, 43, 57, 63, 53, 30, 20, 18, 28, 33, 41, 55, 39, 34, 46, 48, 36, 25, 11, 13, 27, 44, 58, 60, 50, 9, 1, 3, 15, 42, 56, 62, 52, 23, 7, 5, 17, 32, 40, 54, 38, 31, 21, 19, 29],
  voidAndCluster: [131, 187, 8, 78, 50, 18, 134, 89, 155, 102, 29, 95, 184, 73, 22, 86, 113, 171, 142, 105, 34, 166, 9, 60, 151, 128, 40, 110, 168, 137, 45, 28, 64, 188, 82, 54, 124, 189, 80, 13, 156, 56, 7, 61, 186, 121, 154, 6, 108, 177, 24, 100, 38, 176, 93, 123, 83, 148, 96, 17, 88, 133, 44, 145, 69, 161, 139, 72, 30, 181, 115, 27, 163, 47, 178, 65, 164, 14, 120, 48, 5, 127, 153, 52, 190, 58, 126, 81, 116, 21, 106, 77, 173, 92, 191, 63, 99, 12, 76, 144, 4, 185, 37, 149, 192, 39, 135, 23, 117, 31, 170, 132, 35, 172, 103, 66, 129, 79, 3, 97, 57, 159, 70, 141, 53, 94, 114, 20, 49, 158, 19, 146, 169, 122, 183, 11, 104, 180, 2, 165, 152, 87, 182, 118, 91, 42, 67, 25, 84, 147, 43, 85, 125, 68, 16, 136, 71, 10, 193, 112, 160, 138, 51, 111, 162, 26, 194, 46, 174, 107, 41, 143, 33, 74, 1, 101, 195, 15, 75, 140, 109, 90, 32, 62, 157, 98, 167, 119, 179, 59, 36, 130, 175, 55, 0, 150],
}

@customElement("motion-dithered-image")
export class MotionDitheredImage extends LitElement {
  static override styles = css`
    :host { display: block; position: relative; width: 100%; height: 100%; }
    canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
  `

  @property() image = ""
  @property({ attribute: "dither-map" }) ditherMap: DitherMap = "bayer4x4"
  @property({ type: Number, attribute: "pixel-size" }) pixelSize = 1
  @property() color: ColorRepresentation = "#ff6900"
  @property({ attribute: "background-color" }) backgroundColor: ColorRepresentation = "#17181A"
  @property({ type: Number }) threshold = 0.0

  private _raf = 0
  private _cancelled = false
  private _uniforms?: {
    uPixelSize: { value: number }
    uThreshold: { value: number }
    uColor: { value: Vec3 }
    uBackgroundColor: { value: Vec3 }
    uThresholdMap: { value: Texture }
    uMapSize: { value: Vec2 }
  }
  private _gl?: WebGLRenderingContext
  private _setImage?: (src: string) => void
  private _setDitherMap?: (map: DitherMap) => void

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
    if (changed.has("pixelSize")) this._uniforms.uPixelSize.value = Math.max(1, this.pixelSize)
    if (changed.has("threshold")) this._uniforms.uThreshold.value = this.threshold
    if (changed.has("color")) { const [r, g, b] = toLinearRgb(this.color, [1, 105 / 255, 0]); this._uniforms.uColor.value.set(r, g, b) }
    if (changed.has("backgroundColor")) { const [r, g, b] = toLinearRgb(this.backgroundColor, [23 / 255, 24 / 255, 26 / 255]); this._uniforms.uBackgroundColor.value.set(r, g, b) }
    if (changed.has("image") && this._setImage) this._setImage(this.image)
    if (changed.has("ditherMap") && this._setDitherMap) this._setDitherMap(this.ditherMap)
  }

  replay() {
    this._cancelled = true
    cancelAnimationFrame(this._raf)
    const canvas = this.shadowRoot!.querySelector("canvas")!
    this._init(canvas)
  }

  private _makeThresholdTexture(gl: WebGLRenderingContext, map: DitherMap) {
    const data = THRESHOLD_MAPS[map] ?? THRESHOLD_MAPS.bayer4x4
    const size = Math.max(1, Math.round(Math.sqrt(data.length)))
    const pixels = new Uint8Array(size * size * 4)
    for (let i = 0; i < data.length; i++) {
      const v = Math.round((data[i] / data.length) * 255)
      pixels[i * 4] = v; pixels[i * 4 + 1] = v; pixels[i * 4 + 2] = v; pixels[i * 4 + 3] = 255
    }
    return { size, texture: new Texture(gl as any, { image: pixels, width: size, height: size, format: gl.RGBA, type: gl.UNSIGNED_BYTE, minFilter: gl.NEAREST, magFilter: gl.NEAREST, wrapS: gl.REPEAT, wrapT: gl.REPEAT, generateMipmaps: false, flipY: false }) }
  }

  private _init(canvas: HTMLCanvasElement) {
    this._cancelled = false
    const renderer = new Renderer({ canvas, alpha: true, dpr: window.devicePixelRatio })
    const gl = renderer.gl
    this._gl = gl
    gl.clearColor(0, 0, 0, 0)
    canvas.style.width = "100%"
    canvas.style.height = "100%"

    const camera = new Camera(gl)
    camera.position.z = 1
    const scene = new Transform()
    const geometry = new Triangle(gl)

    const imageTexture = new Texture(gl, { image: new Uint8Array([0, 0, 0, 255]), width: 1, height: 1, format: gl.RGBA, type: gl.UNSIGNED_BYTE, minFilter: gl.LINEAR, magFilter: gl.LINEAR, wrapS: gl.CLAMP_TO_EDGE, wrapT: gl.CLAMP_TO_EDGE, generateMipmaps: false, flipY: true })

    const resolution = new Vec2(1, 1)
    const mapSize = new Vec2(4, 4)
    const coverScale = new Vec2(1, 1)
    const coverOffset = new Vec2(0, 0)
    const [cr, cg, cb] = toLinearRgb(this.color, [1, 105 / 255, 0])
    const [br, bg, bb] = toLinearRgb(this.backgroundColor, [23 / 255, 24 / 255, 26 / 255])
    const colorVec = new Vec3(cr, cg, cb)
    const bgVec = new Vec3(br, bg, bb)

    let thresholdState = this._makeThresholdTexture(gl, this.ditherMap)
    mapSize.set(thresholdState.size, thresholdState.size)
    let currentMap = this.ditherMap

    let imgW = 1, imgH = 1
    const updateCover = (rw: number, rh: number) => {
      const screenAspect = rw / rh, imgAspect = imgW / imgH
      let scaleX = 1, scaleY = 1, offX = 0, offY = 0
      if (screenAspect > imgAspect) { scaleY = imgAspect / screenAspect; offY = (1 - scaleY) * 0.5 }
      else { scaleX = screenAspect / imgAspect; offX = (1 - scaleX) * 0.5 }
      coverScale.set(scaleX, scaleY); coverOffset.set(offX, offY)
    }

    const uniforms = {
      uTexture: { value: imageTexture },
      uThresholdMap: { value: thresholdState.texture },
      uResolution: { value: resolution },
      uMapSize: { value: mapSize },
      uCoverScale: { value: coverScale },
      uCoverOffset: { value: coverOffset },
      uPixelSize: { value: Math.max(1, this.pixelSize) },
      uThreshold: { value: this.threshold },
      uColor: { value: colorVec },
      uBackgroundColor: { value: bgVec },
    }
    this._uniforms = uniforms as any

    let imgToken = 0
    this._setImage = (src: string) => {
      imgToken++; const tok = imgToken
      const img = new Image(); img.crossOrigin = "anonymous"; img.decoding = "async"
      img.onload = () => {
        if (tok !== imgToken) return
        imageTexture.image = img; imgW = img.naturalWidth || 1; imgH = img.naturalHeight || 1
        updateCover(resolution.x, resolution.y)
      }
      img.src = src
    }

    this._setDitherMap = (map: DitherMap) => {
      if (map === currentMap) return
      const prev = thresholdState.texture
      thresholdState = this._makeThresholdTexture(gl, map)
      currentMap = map
      uniforms.uThresholdMap.value = thresholdState.texture
      mapSize.set(thresholdState.size, thresholdState.size)
      if (prev.texture) gl.deleteTexture(prev.texture)
    }

    if (this.image) this._setImage(this.image)

    const program = new Program(gl, {
      vertex: `attribute vec2 uv; attribute vec2 position; varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }`,
      fragment: `
        precision highp float;
        uniform sampler2D uTexture; uniform sampler2D uThresholdMap;
        uniform vec2 uResolution; uniform vec2 uMapSize; uniform vec2 uCoverScale; uniform vec2 uCoverOffset;
        uniform float uPixelSize; uniform float uThreshold; uniform vec3 uColor; uniform vec3 uBackgroundColor;
        varying vec2 vUv;
        float getLuminance(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
        vec3 linearToSrgb(vec3 c) { vec3 s = max(c, vec3(0.0)); vec3 lo = s * 12.92; vec3 hi = 1.055 * pow(s, vec3(1.0/2.4)) - 0.055; return mix(lo, hi, step(vec3(0.0031308), s)); }
        void main() {
          float px = max(1.0, uPixelSize);
          vec2 pc = floor(gl_FragCoord.xy / px);
          vec2 centerUv = (pc * px + px * 0.5) / uResolution;
          vec2 imgUv = max(uCoverScale, vec2(0.00001)) * centerUv + uCoverOffset;
          vec4 tex = texture2D(uTexture, imgUv);
          vec2 mapUv = mod(pc, uMapSize) / uMapSize + 0.5 / uMapSize;
          float thresh = texture2D(uThresholdMap, mapUv).r;
          float lum = getLuminance(tex.rgb);
          float d = step(thresh + uThreshold, lum);
          gl_FragColor = vec4(linearToSrgb(mix(uBackgroundColor, uColor, d)), 1.0);
        }
      `,
      uniforms,
      transparent: false,
      depthTest: false,
      depthWrite: false,
    })

    const mesh = new Mesh(gl, { geometry, program })
    mesh.setParent(scene)

    const tick = () => {
      if (this._cancelled) return
      const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight)
      const bw = Math.round(w * renderer.dpr), bh = Math.round(h * renderer.dpr)
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw; canvas.height = bh; renderer.width = w; renderer.height = h
        renderer.state.viewport = { x: 0, y: 0, width: null as any, height: null as any }
        resolution.set(bw, bh); updateCover(bw, bh)
      }
      renderer.render({ scene, camera })
      this._raf = requestAnimationFrame(tick)
    }
    this._raf = requestAnimationFrame(tick)
  }

  override render() {
    return html`<canvas></canvas>`
  }
}
