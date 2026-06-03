import { LitElement, html, css } from "lit"
import { customElement, property } from "lit/decorators.js"
import {
  Camera,
  Mesh,
  Plane,
  Program,
  RenderTarget,
  Renderer,
  Texture,
  Transform,
  Triangle,
  Vec2,
} from "ogl"

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

  uniform sampler2D uTexture;
  uniform sampler2D uDisplacement;
  uniform vec2 uResolution;
  uniform vec2 uTextureSize;

  varying vec2 vUv;
  const float PI = 3.141592653589793238;

  vec2 getCoverUV(vec2 uv, vec2 textureSize) {
    vec2 safeTexture = max(textureSize, vec2(1.0));
    vec2 s = uResolution / safeTexture;
    float scale = max(s.x, s.y);
    vec2 scaledSize = safeTexture * scale;
    vec2 offset = (uResolution - scaledSize) * 0.5;
    return (uv * uResolution - offset) / scaledSize;
  }

  void main() {
    vec2 coverUv = getCoverUV(vUv, uTextureSize);
    vec4 displacement = texture2D(uDisplacement, vUv);
    float theta = displacement.r * 2.0 * PI;
    vec2 dir = vec2(sin(theta), cos(theta));
    vec2 finalUv = coverUv + dir * displacement.r * 0.05;
    gl_FragColor = texture2D(uTexture, finalUv);
  }
`

const BRUSH_VERTEX = `
  attribute vec3 position;
  attribute vec2 uv;
  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const BRUSH_FRAGMENT = `
  precision highp float;

  uniform sampler2D uBrush;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    vec4 tex = texture2D(uBrush, vUv);
    gl_FragColor = vec4(tex.rgb * uOpacity, tex.a * uOpacity);
  }
`

@customElement("motion-water-ripple")
export class MotionWaterRipple extends LitElement {
  static override styles = css`
    :host { display: block; position: relative; width: 100%; height: 100%; }
    canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
  `

  @property({ type: String, attribute: "src" })
  src = ""

  @property({ type: Number, attribute: "brush-size" })
  brushSize = 100

  private _raf = 0
  private _cancelled = false
  private _brushPixelSize = 100
  private _imageToken = 0
  private _brushToken = 0
  private _currentWave = 0
  private _prevMouse = new Vec2(0, 0)
  private _resolution?: Vec2
  private _textureSize?: Vec2
  private _imageTexture?: Texture
  private _brushTexture?: Texture
  private _displacementTarget?: RenderTarget
  private _brushCamera?: Camera
  private _waves?: Array<{
    mesh: Mesh
    opacityUniform: { value: number }
    scaleX: number
    scaleY: number
  }>
  private _onPointerMove?: (event: PointerEvent) => void

  override firstUpdated() {
    this._init(this.shadowRoot!.querySelector("canvas")!)
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._cancelled = true
    this._imageToken += 1
    this._brushToken += 1
    cancelAnimationFrame(this._raf)
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has("src") && this._imageTexture && this.src) {
      this._loadImage(this.src)
    }
    if (changed.has("brushSize")) {
      this._brushPixelSize = Math.max(1, this.brushSize)
    }
  }

  replay() {
    // Water ripple doesn't need replay as it's interactive
  }

  private _disposeTarget = (gl: Renderer["gl"], target: RenderTarget) => {
    target.textures.forEach((texture) => {
      if (texture.texture) gl.deleteTexture(texture.texture)
    })
    if (target.depthTexture?.texture) gl.deleteTexture(target.depthTexture.texture)
    if (target.depthBuffer) gl.deleteRenderbuffer(target.depthBuffer)
    if (target.stencilBuffer) gl.deleteRenderbuffer(target.stencilBuffer)
    if (target.depthStencilBuffer) gl.deleteRenderbuffer(target.depthStencilBuffer)
    if (target.buffer) gl.deleteFramebuffer(target.buffer)
  }

  private _loadImage = (source: string) => {
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
      if (this._textureSize) {
        this._textureSize.set(
          img.naturalWidth || img.width || 1,
          img.naturalHeight || img.height || 1,
        )
      }
    }
    img.src = source
  }

  private _loadBrush = (source: string) => {
    this._brushToken += 1
    const token = this._brushToken
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.decoding = "async"
    img.onload = () => {
      if (this._cancelled || token !== this._brushToken) return
      if (this._brushTexture) {
        this._brushTexture.image = img
      }
    }
    img.src = source
  }

  private _setNewWave = (x: number, y: number, index: number) => {
    if (!this._waves) return
    const wave = this._waves[index]
    if (!wave) return
    wave.mesh.position.x = x
    wave.mesh.position.y = y
    wave.mesh.visible = true
    wave.opacityUniform.value = 1
    wave.scaleX = 1.5
    wave.scaleY = 1.5
    wave.mesh.scale.set(
      wave.scaleX * this._brushPixelSize,
      wave.scaleY * this._brushPixelSize,
      1,
    )
  }

  private _init(canvas: HTMLCanvasElement) {
    this._cancelled = false
    this._brushPixelSize = Math.max(1, this.brushSize)

    const renderer = new Renderer({ canvas, alpha: true, dpr: window.devicePixelRatio })
    const gl = renderer.gl
    gl.clearColor(0, 0, 0, 0)
    canvas.style.width = "100%"
    canvas.style.height = "100%"

    const camera = new Camera(gl)
    camera.position.z = 1

    const brushCamera = new Camera(gl, {
      left: -1,
      right: 1,
      top: 1,
      bottom: -1,
      near: 0,
      far: 10,
    })
    brushCamera.position.z = 1
    this._brushCamera = brushCamera

    const scene = new Transform()
    const brushScene = new Transform()

    const fullscreenGeometry = new Triangle(gl)
    const brushGeometry = new Plane(gl, {
      width: 1,
      height: 1,
    })

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
      generateMipmaps: true,
      flipY: true,
    })
    this._imageTexture = imageTexture

    const brushTexture = new Texture(gl, {
      image: new Uint8Array([0, 0, 0, 0]),
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
    this._brushTexture = brushTexture

    const displacementTarget = new RenderTarget(gl, {
      width: 1,
      height: 1,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      format: gl.RGBA,
      type: gl.UNSIGNED_BYTE,
    })
    this._displacementTarget = displacementTarget

    const resolutionUniform = new Vec2(1, 1)
    const textureSizeUniform = new Vec2(1, 1)
    this._resolution = resolutionUniform
    this._textureSize = textureSizeUniform

    const mainUniforms = {
      uTexture: { value: imageTexture },
      uDisplacement: { value: displacementTarget.texture },
      uResolution: { value: resolutionUniform },
      uTextureSize: { value: textureSizeUniform },
    }

    const mainProgram = new Program(gl, {
      vertex: VERTEX,
      fragment: FRAGMENT,
      uniforms: mainUniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })

    const mainMesh = new Mesh(gl, {
      geometry: fullscreenGeometry,
      program: mainProgram,
      frustumCulled: false,
    })
    mainMesh.setParent(scene)

    const MAX_WAVES = 100
    const waves: Array<{
      mesh: Mesh
      opacityUniform: { value: number }
      scaleX: number
      scaleY: number
    }> = []

    for (let i = 0; i < MAX_WAVES; i++) {
      const opacityUniform = { value: 0 }
      const brushProgram = new Program(gl, {
        vertex: BRUSH_VERTEX,
        fragment: BRUSH_FRAGMENT,
        uniforms: {
          uBrush: { value: brushTexture },
          uOpacity: opacityUniform,
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
        cullFace: null,
      })
      brushProgram.setBlendFunc(gl.SRC_ALPHA, gl.ONE)

      const brushMesh = new Mesh(gl, {
        geometry: brushGeometry,
        program: brushProgram,
        frustumCulled: false,
      })
      brushMesh.visible = false
      brushMesh.rotation.z = Math.random() * Math.PI * 2
      brushMesh.setParent(brushScene)

      waves.push({
        mesh: brushMesh,
        opacityUniform,
        scaleX: 1.5,
        scaleY: 1.5,
      })
    }
    this._waves = waves

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const x = event.clientX - rect.left - rect.width / 2
      const y = -(event.clientY - rect.top - rect.height / 2)

      if (Math.abs(x - this._prevMouse.x) > 4 || Math.abs(y - this._prevMouse.y) > 4) {
        this._currentWave = (this._currentWave + 1) % MAX_WAVES
        this._setNewWave(x, y, this._currentWave)
        this._prevMouse.set(x, y)
      }
    }
    this._onPointerMove = onPointerMove
    canvas.addEventListener("pointermove", onPointerMove)

    this._loadBrush("/motion-kit/water-ripple/brush.png")
    if (this.src) {
      this._loadImage(this.src)
    }

    let previousTime = 0
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
        resolutionUniform.set(w, h)
        brushCamera.left = -w / 2
        brushCamera.right = w / 2
        brushCamera.top = h / 2
        brushCamera.bottom = -h / 2
        brushCamera.updateProjectionMatrix()
        displacementTarget.setSize(w, h)
      }

      const delta = previousTime ? (now - previousTime) / 1000 : 0
      previousTime = now
      const timeScale = delta * 60

      for (let i = 0; i < waves.length; i++) {
        const wave = waves[i]
        if (!wave.mesh.visible) continue

        wave.mesh.rotation.z += 0.02 * timeScale
        wave.opacityUniform.value *= Math.pow(0.96, timeScale)

        const decay = Math.pow(0.99, timeScale)
        wave.opacityUniform.value *= decay
        wave.scaleX = 0.982 * wave.scaleX + 0.108
        wave.scaleY = 0.982 * wave.scaleY + 0.108
        wave.mesh.scale.set(
          wave.scaleX * this._brushPixelSize,
          wave.scaleY * this._brushPixelSize,
          1,
        )

        if (wave.opacityUniform.value < 0.002) {
          wave.mesh.visible = false
        }
      }

      renderer.render({
        scene: brushScene,
        camera: brushCamera,
        target: displacementTarget,
        clear: true,
      })

      renderer.render({ scene, camera, clear: true })
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
    "motion-water-ripple": MotionWaterRipple
  }
}
