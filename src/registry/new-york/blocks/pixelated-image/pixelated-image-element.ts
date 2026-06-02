import { LitElement, html, css } from "lit"
import { customElement, property } from "lit/decorators.js"
import { Camera, Mesh, Program, Renderer, Texture, Transform, Triangle, Vec2 } from "ogl"

type UniformState = {
  uTexture: { value: Texture }
  uResolution: { value: Vec2 }
  uTextureSize: { value: Vec2 }
  uGridSize: { value: number }
  uIsDone: { value: number }
}

type RuntimeConfig = {
  initialGridSize: number
  stepDuration: number
}

@customElement("motion-pixelated-image")
export class MotionPixelatedImage extends LitElement {
  static override styles = css`
    :host { display: block; position: relative; width: 100%; height: 100%; }
    canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
  `

  @property({ attribute: "image" }) image = ""
  @property({ type: Number, attribute: "initial-grid-size" }) initialGridSize = 6
  @property({ type: Number, attribute: "step-duration" }) stepDuration = 0.15

  private _raf = 0
  private _cancelled = false
  private _imageToken = 0
  private _renderer?: Renderer
  private _geometry?: Triangle
  private _program?: Program
  private _mesh?: Mesh
  private _texture?: Texture
  private _setImageSource?: (source: string) => void
  private _setRuntimeConfig?: (config: RuntimeConfig) => void

  override firstUpdated() {
    this._init(this.shadowRoot!.querySelector("canvas")!)
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._cleanup()
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has("image") && this._setImageSource) {
      this._setImageSource(this.image)
    }

    if (
      (changed.has("initialGridSize") || changed.has("stepDuration")) &&
      this._setRuntimeConfig
    ) {
      this._setRuntimeConfig({
        initialGridSize: this.initialGridSize,
        stepDuration: this.stepDuration,
      })
    }
  }

  replay() {
    this._cleanup()
    this._init(this.shadowRoot!.querySelector("canvas")!)
  }

  private _cleanup() {
    this._cancelled = true
    this._imageToken += 1
    cancelAnimationFrame(this._raf)
    this._raf = 0
    this._setImageSource = undefined
    this._setRuntimeConfig = undefined

    const gl = this._renderer?.gl
    const texture = this._texture
    if (gl && texture?.texture) gl.deleteTexture(texture.texture)

    this._geometry?.remove()
    this._program?.remove()
    this._mesh?.setParent(null)

    this._texture = undefined
    this._mesh = undefined
    this._program = undefined
    this._geometry = undefined
    this._renderer = undefined
  }

  private _init(canvas: HTMLCanvasElement) {
    this._cleanup()
    this._cancelled = false

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

    const imageTexture = new Texture(gl, {
      image: new Uint8Array([0, 0, 0, 255]),
      width: 1,
      height: 1,
      format: gl.RGBA,
      type: gl.UNSIGNED_BYTE,
      minFilter: gl.NEAREST,
      magFilter: gl.NEAREST,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
      generateMipmaps: false,
      flipY: true,
    })
    this._renderer = renderer
    this._geometry = geometry
    this._texture = imageTexture

    const resolutionUniform = new Vec2(1, 1)
    const textureSizeUniform = new Vec2(1, 1)
    const uniforms: UniformState = {
      uTexture: { value: imageTexture },
      uResolution: { value: resolutionUniform },
      uTextureSize: { value: textureSizeUniform },
      uGridSize: { value: Math.max(1, this.initialGridSize) },
      uIsDone: { value: 0 },
    }

    let currentInitialGridSize = Math.max(1, this.initialGridSize)
    let currentStepDuration = Math.max(0.0001, this.stepDuration)
    let currentGridSize = currentInitialGridSize
    let isDone = false
    let elapsed = 0

    const resetState = () => {
      currentGridSize = currentInitialGridSize
      isDone = false
      elapsed = 0
      imageTexture.minFilter = gl.NEAREST
      imageTexture.magFilter = gl.NEAREST
      imageTexture.needsUpdate = true
      uniforms.uGridSize.value = currentGridSize
      uniforms.uIsDone.value = 0
    }

    this._setRuntimeConfig = (config) => {
      const nextInitialGridSize = Math.max(1, config.initialGridSize)
      const nextStepDuration = Math.max(0.0001, config.stepDuration)
      const shouldReset =
        nextInitialGridSize !== currentInitialGridSize ||
        nextStepDuration !== currentStepDuration

      currentInitialGridSize = nextInitialGridSize
      currentStepDuration = nextStepDuration

      if (shouldReset) resetState()
    }

    this._setImageSource = (source) => {
      this._imageToken += 1
      const token = this._imageToken
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.decoding = "async"
      img.onload = () => {
        if (token !== this._imageToken || this._cancelled) return
        imageTexture.image = img
        textureSizeUniform.set(
          img.naturalWidth || img.width || 1,
          img.naturalHeight || img.height || 1,
        )
        resetState()
      }
      img.src = source
    }

    if (this.image) this._setImageSource(this.image)

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

        uniform sampler2D uTexture;
        uniform vec2 uResolution;
        uniform vec2 uTextureSize;
        uniform float uGridSize;
        uniform float uIsDone;
        varying vec2 vUv;

        vec2 getCoverUV(vec2 uv, vec2 textureSize) {
          vec2 safeTexture = max(textureSize, vec2(1.0));
          vec2 s = uResolution / safeTexture;
          float scale = max(s.x, s.y);
          vec2 scaledSize = safeTexture * scale;
          vec2 offset = (uResolution - scaledSize) * 0.5;
          return (uv * uResolution - offset) / scaledSize;
        }

        void main() {
          vec2 s = uResolution;
          float rs = s.x / max(s.y, 0.00001);

          vec2 grid = vec2(uGridSize * rs, uGridSize);
          vec2 pixelatedScreenUv = floor(vUv * grid) / grid + (0.5 / grid);

          vec2 finalUv = mix(pixelatedScreenUv, vUv, clamp(uIsDone, 0.0, 1.0));
          vec2 coverUv = getCoverUV(finalUv, uTextureSize);

          gl_FragColor = texture2D(uTexture, coverUv);
        }
      `,
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
    this._program = program

    const mesh = new Mesh(gl, { geometry, program })
    this._mesh = mesh
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
        renderer.state.viewport = { x: 0, y: 0, width: null as any, height: null as any }
        resolutionUniform.set(bufW, bufH)
      }

      const delta = previous ? (now - previous) / 1000 : 0
      previous = now

      if (!isDone) {
        elapsed += delta
        const step = Math.floor(elapsed / currentStepDuration)
        currentGridSize = Math.max(1, currentInitialGridSize * Math.pow(2, step))

        if (currentGridSize > resolutionUniform.y) {
          isDone = true
          imageTexture.minFilter = gl.LINEAR
          imageTexture.magFilter = gl.LINEAR
          imageTexture.needsUpdate = true
        }
      }

      uniforms.uGridSize.value = currentGridSize
      uniforms.uIsDone.value = isDone ? 1 : 0

      renderer.render({ scene, camera })
      this._raf = window.requestAnimationFrame(tick)
    }

    this._raf = window.requestAnimationFrame(tick)
  }

  override render() {
    return html`<canvas aria-hidden="true"></canvas>`
  }
}
