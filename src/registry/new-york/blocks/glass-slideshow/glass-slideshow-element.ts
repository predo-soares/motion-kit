import { LitElement, css, html } from "lit"
import { customElement, property } from "lit/decorators.js"
import {
  Camera,
  Mesh,
  Program,
  Renderer,
  Texture,
  Transform,
  Triangle,
  Vec2,
} from "ogl"
import { gsap } from "gsap"

type SlideImage = {
  src: string
  alt?: string
}

type UniformSetter = (next: {
  intensity: number
  distortion: number
  chromaticAberration: number
  refraction: number
}) => void

type SourceSetter = (sources: string[]) => void

@customElement("motion-glass-slideshow")
export class MotionGlassSlideshow extends LitElement {
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

  @property() images = "[]"
  @property({ type: Number }) index = 0
  @property({ type: Number, attribute: "transition-duration" })
  transitionDuration = 2000
  @property({ type: Number }) intensity = 1
  @property({ type: Number }) distortion = 1
  @property({ type: Number, attribute: "chromatic-aberration" })
  chromaticAberration = 1
  @property({ type: Number }) refraction = 1
  @property({ type: Boolean }) autoplay = true
  @property({ type: Number, attribute: "autoplay-interval" })
  autoplayInterval = 5000

  private _slides: SlideImage[] = []
  private _canvas?: HTMLCanvasElement
  private _setImageSources?: SourceSetter
  private _setUniformParams?: UniformSetter
  private _currentIndex = 0
  private _nextIndex = 0
  private _isTransitioning = false
  private _progress = { value: 0 }
  private _autoplayTimer = 0
  private _raf = 0
  private _cleanupScene?: () => void

  override firstUpdated() {
    this._slides = this._parseImages()
    this._canvas = this.renderRoot.querySelector("canvas") ?? undefined
    if (this._canvas) {
      this._initScene(this._canvas)
    }
    this._syncImages()
    this._syncUniforms()
    this._syncAutoplay()
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    window.clearInterval(this._autoplayTimer)
    cancelAnimationFrame(this._raf)
    gsap.killTweensOf(this._progress)
    this._cleanupScene?.()
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has("images")) {
      this._slides = this._parseImages()
      this._normalizeIndices()
      this._syncImages()
      this._syncAutoplay()
    }

    if (
      changed.has("intensity") ||
      changed.has("distortion") ||
      changed.has("chromaticAberration") ||
      changed.has("refraction")
    ) {
      this._syncUniforms()
    }

    if (changed.has("index") && !this.autoplay) {
      this.transitionTo(this.index)
    }

    if (changed.has("autoplay") || changed.has("autoplayInterval")) {
      this._syncAutoplay()
    }
  }

  replay() {
    if (this._slides.length > 1) {
      this.transitionTo(this._currentIndex + 1)
    }
  }

  private _parseImages() {
    try {
      const parsed = JSON.parse(this.images) as Array<string | SlideImage>
      if (!Array.isArray(parsed)) return []

      return parsed
        .map((item) => (typeof item === "string" ? { src: item, alt: "" } : item))
        .filter((item): item is SlideImage => Boolean(item?.src))
    } catch {
      return []
    }
  }

  private _normalizeIndex(index: number) {
    const total = this._slides.length
    if (total === 0) return 0
    return ((index % total) + total) % total
  }

  private _normalizeIndices() {
    const total = this._slides.length

    if (total === 0) {
      this._currentIndex = 0
      this._nextIndex = 0
      this._isTransitioning = false
      this._progress.value = 0
      gsap.killTweensOf(this._progress)
      return
    }

    this._currentIndex = this._normalizeIndex(this._currentIndex)
    this._nextIndex = this._normalizeIndex(this._nextIndex)
  }

  private _syncImages() {
    this._setImageSources?.(this._slides.map((slide) => slide.src))
  }

  private _syncUniforms() {
    this._setUniformParams?.({
      intensity: this.intensity,
      distortion: this.distortion,
      chromaticAberration: this.chromaticAberration,
      refraction: this.refraction,
    })
  }

  private _syncAutoplay() {
    window.clearInterval(this._autoplayTimer)

    if (!this.autoplay || this._slides.length <= 1) return

    this._autoplayTimer = window.setInterval(() => {
      this.transitionTo(this._currentIndex + 1)
    }, Math.max(this.autoplayInterval, 1))
  }

  private transitionTo(targetIndex: number) {
    const total = this._slides.length
    if (total === 0) return

    const normalized = this._normalizeIndex(targetIndex)
    if (normalized === this._currentIndex || this._isTransitioning) return

    gsap.killTweensOf(this._progress)
    this._progress.value = 0
    this._isTransitioning = true
    this._nextIndex = normalized

    gsap.to(this._progress, {
      value: 1,
      duration: Math.max(0.01, this.transitionDuration / 1000),
      ease: "power3.inOut",
      onComplete: () => {
        this._currentIndex = this._nextIndex
        this._progress.value = 0
        this._isTransitioning = false
      },
    })
  }

  private _initScene(canvas: HTMLCanvasElement) {
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

    const vertexShader = `
      attribute vec2 uv;
      attribute vec2 position;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `

    const fragmentShader = `
      precision highp float;

      uniform sampler2D uTexture1;
      uniform sampler2D uTexture2;
      uniform float uProgress;
      uniform vec2 uResolution;
      uniform vec2 uTexture1Size;
      uniform vec2 uTexture2Size;

      uniform float uGlobalIntensity;
      uniform float uDistortionStrength;
      uniform float uSpeedMultiplier;
      uniform float uColorEnhancement;

      uniform float uGlassRefractionStrength;
      uniform float uGlassChromaticAberration;
      uniform float uGlassBubbleClarity;
      uniform float uGlassEdgeGlow;
      uniform float uGlassLiquidFlow;

      varying vec2 vUv;

      vec3 srgbToLinear(vec3 color) {
        vec3 low = color / 12.92;
        vec3 high = pow((color + 0.055) / 1.055, vec3(2.4));
        vec3 cutoff = step(vec3(0.04045), color);
        return mix(low, high, cutoff);
      }

      vec3 linearToSrgb(vec3 color) {
        vec3 safe = max(color, vec3(0.0));
        vec3 low = safe * 12.92;
        vec3 high = 1.055 * pow(safe, vec3(1.0 / 2.4)) - 0.055;
        vec3 cutoff = step(vec3(0.0031308), safe);
        return mix(low, high, cutoff);
      }

      vec2 getCoverUV(vec2 uv, vec2 textureSize) {
        vec2 s = uResolution / textureSize;
        float scale = max(s.x, s.y);
        vec2 scaledSize = textureSize * scale;
        vec2 offset = (uResolution - scaledSize) * 0.5;
        return (uv * uResolution - offset) / scaledSize;
      }

      float noise(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float smoothNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);

        return mix(
          mix(noise(i), noise(i + vec2(1.0, 0.0)), f.x),
          mix(noise(i + vec2(0.0, 1.0)), noise(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      vec4 sampleLinear(sampler2D tex, vec2 uv) {
        vec4 c = texture2D(tex, uv);
        return vec4(srgbToLinear(c.rgb), c.a);
      }

      vec4 glassEffect(vec2 uv, float progress) {
        float glassStrength = 0.08 * uGlassRefractionStrength * uDistortionStrength * uGlobalIntensity;
        float chromaticAberration = 0.02 * uGlassChromaticAberration * uGlobalIntensity;
        float waveDistortion = 0.025 * uDistortionStrength;
        float clearCenterSize = 0.3 * uGlassBubbleClarity;
        float surfaceRipples = 0.004 * uDistortionStrength;
        float liquidFlow = 0.015 * uGlassLiquidFlow * uSpeedMultiplier;
        float rimLightWidth = 0.05;
        float glassEdgeWidth = 0.025;

        float brightnessPhase = smoothstep(0.8, 1.0, progress);
        float rimLightIntensity = 0.08 * (1.0 - brightnessPhase) * uGlassEdgeGlow * uGlobalIntensity;
        float glassEdgeOpacity = 0.06 * (1.0 - brightnessPhase) * uGlassEdgeGlow;

        vec2 center = vec2(0.5, 0.5);
        vec2 p = uv * uResolution;

        vec2 uv1 = getCoverUV(uv, uTexture1Size);
        vec2 uv2Base = getCoverUV(uv, uTexture2Size);

        float maxRadius = length(uResolution) * 0.85;
        float bubbleRadius = progress * maxRadius;
        vec2 sphereCenter = center * uResolution;

        float dist = length(p - sphereCenter);
        float normalizedDist = dist / max(bubbleRadius, 0.001);
        vec2 direction = (dist > 0.0) ? (p - sphereCenter) / dist : vec2(0.0);
        float inside = smoothstep(bubbleRadius + 3.0, bubbleRadius - 3.0, dist);

        float distanceFactor = smoothstep(clearCenterSize, 1.0, normalizedDist);
        float time = progress * 5.0 * uSpeedMultiplier;

        vec2 liquidSurface = vec2(
          smoothNoise(uv * 100.0 + time * 0.3),
          smoothNoise(uv * 100.0 + time * 0.2 + 50.0)
        ) - 0.5;
        liquidSurface *= surfaceRipples * distanceFactor;

        vec2 distortedUV = uv2Base;
        if (inside > 0.0) {
          float refractionOffset = glassStrength * pow(distanceFactor, 1.5);
          vec2 flowDirection = normalize(direction + vec2(sin(time), cos(time * 0.7)) * 0.3);
          distortedUV -= flowDirection * refractionOffset;

          float wave1 = sin(normalizedDist * 22.0 - time * 3.5);
          float wave2 = sin(normalizedDist * 35.0 + time * 2.8) * 0.7;
          float wave3 = sin(normalizedDist * 50.0 - time * 4.2) * 0.5;
          float combinedWave = (wave1 + wave2 + wave3) / 3.0;

          float waveOffset = combinedWave * waveDistortion * distanceFactor;
          distortedUV -= direction * waveOffset + liquidSurface;

          vec2 flowOffset = vec2(
            sin(time + normalizedDist * 10.0),
            cos(time * 0.8 + normalizedDist * 8.0)
          ) * liquidFlow * distanceFactor * inside;
          distortedUV += flowOffset;
        }

        vec4 newImg;
        if (inside > 0.0) {
          float aberrationOffset = chromaticAberration * pow(distanceFactor, 1.2);

          vec2 uvR = distortedUV + direction * aberrationOffset * 1.2;
          vec2 uvG = distortedUV + direction * aberrationOffset * 0.2;
          vec2 uvB = distortedUV - direction * aberrationOffset * 0.8;

          vec3 sampleR = srgbToLinear(texture2D(uTexture2, uvR).rgb);
          vec3 sampleG = srgbToLinear(texture2D(uTexture2, uvG).rgb);
          vec3 sampleB = srgbToLinear(texture2D(uTexture2, uvB).rgb);
          newImg = vec4(sampleR.r, sampleG.g, sampleB.b, 1.0);
        } else {
          newImg = sampleLinear(uTexture2, uv2Base);
        }

        if (inside > 0.0 && rimLightIntensity > 0.0) {
          float rim = smoothstep(1.0 - rimLightWidth, 1.0, normalizedDist) *
            (1.0 - smoothstep(1.0, 1.01, normalizedDist));
          newImg.rgb += rim * rimLightIntensity;

          float edge = smoothstep(1.0 - glassEdgeWidth, 1.0, normalizedDist) *
            (1.0 - smoothstep(1.0, 1.01, normalizedDist));
          newImg.rgb = mix(newImg.rgb, vec3(1.0), edge * glassEdgeOpacity);
        }

        newImg.rgb = mix(newImg.rgb, newImg.rgb * 1.2, (uColorEnhancement - 1.0) * 0.5);

        vec4 currentImg = sampleLinear(uTexture1, uv1);

        if (progress > 0.95) {
          vec4 pureNewImg = sampleLinear(uTexture2, uv2Base);
          float endTransition = (progress - 0.95) / 0.05;
          newImg = mix(newImg, pureNewImg, endTransition);
        }

        return mix(currentImg, newImg, inside);
      }

      void main() {
        vec4 outColor = glassEffect(vUv, uProgress);
        gl_FragColor = vec4(linearToSrgb(outColor.rgb), outColor.a);
      }
    `

    const createPlaceholderTexture = () =>
      new Texture(gl, {
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

    const placeholderTexture = createPlaceholderTexture()
    let slideTextures: Texture[] = []
    let imageLoadToken = 0

    const disposeTexture = (texture: Texture) => {
      if (texture.texture) {
        gl.deleteTexture(texture.texture)
      }
    }

    const loadTextureFromSource = (source: string, token: number) => {
      const texture = createPlaceholderTexture()
      const image = new Image()
      image.crossOrigin = "anonymous"
      image.decoding = "async"
      image.onload = () => {
        if (token !== imageLoadToken) return
        texture.image = image
      }
      image.src = source
      return texture
    }

    const replaceTextures = (sources: string[]) => {
      imageLoadToken += 1
      const token = imageLoadToken
      slideTextures.forEach(disposeTexture)
      slideTextures = sources.map((source) => loadTextureFromSource(source, token))
    }

    this._setImageSources = replaceTextures

    const getTextureSize = (texture: Texture): [number, number] => {
      const image = texture.image as
        | {
            width?: number
            height?: number
            naturalWidth?: number
            naturalHeight?: number
          }
        | null
        | undefined

      if (!image) return [1, 1]

      const width = image.naturalWidth ?? image.width ?? 1
      const height = image.naturalHeight ?? image.height ?? 1
      return [Math.max(1, width), Math.max(1, height)]
    }

    const uniforms = {
      uTexture1: { value: placeholderTexture },
      uTexture2: { value: placeholderTexture },
      uProgress: { value: 0 },
      uResolution: { value: new Vec2(1, 1) },
      uTexture1Size: { value: new Vec2(1, 1) },
      uTexture2Size: { value: new Vec2(1, 1) },
      uGlobalIntensity: { value: this.intensity },
      uDistortionStrength: { value: this.distortion },
      uSpeedMultiplier: { value: 1.0 },
      uColorEnhancement: { value: 1.0 },
      uGlassRefractionStrength: { value: this.refraction },
      uGlassChromaticAberration: { value: this.chromaticAberration },
      uGlassBubbleClarity: { value: 1.0 },
      uGlassEdgeGlow: { value: 1.0 },
      uGlassLiquidFlow: { value: 1.0 },
    }

    this._setUniformParams = (next) => {
      uniforms.uGlobalIntensity.value = next.intensity
      uniforms.uDistortionStrength.value = next.distortion
      uniforms.uGlassChromaticAberration.value = next.chromaticAberration
      uniforms.uGlassRefractionStrength.value = next.refraction
    }

    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms,
      depthTest: false,
      depthWrite: false,
    })

    const mesh = new Mesh(gl, { geometry, program, frustumCulled: false })
    mesh.setParent(scene)

    const tick = () => {
      const width = Math.max(1, canvas.clientWidth)
      const height = Math.max(1, canvas.clientHeight)
      const bufferWidth = Math.round(width * renderer.dpr)
      const bufferHeight = Math.round(height * renderer.dpr)

      if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
        canvas.width = bufferWidth
        canvas.height = bufferHeight
        renderer.width = width
        renderer.height = height
        renderer.state.viewport = { x: 0, y: 0, width: null, height: null }
        uniforms.uResolution.value.set(width, height)
      }

      const total = slideTextures.length
      const safeCurrent =
        total > 0 ? this._normalizeIndex(this._currentIndex) : 0
      const safeNext =
        total > 0 ? this._normalizeIndex(this._nextIndex) : safeCurrent

      const texture1 = total > 0 ? slideTextures[safeCurrent] : placeholderTexture
      const texture2 = total > 0 ? slideTextures[safeNext] : placeholderTexture

      uniforms.uProgress.value = this._progress.value
      uniforms.uTexture1.value = texture1
      uniforms.uTexture2.value = texture2

      const [width1, height1] = getTextureSize(texture1)
      const [width2, height2] = getTextureSize(texture2)
      uniforms.uTexture1Size.value.set(width1, height1)
      uniforms.uTexture2Size.value.set(width2, height2)

      renderer.render({ scene, camera, clear: true })
      this._raf = window.requestAnimationFrame(tick)
    }

    this._raf = window.requestAnimationFrame(tick)

    this._cleanupScene = () => {
      window.cancelAnimationFrame(this._raf)
      this._setImageSources = undefined
      this._setUniformParams = undefined
      imageLoadToken += 1

      slideTextures.forEach(disposeTexture)
      disposeTexture(placeholderTexture)

      program.remove()
      geometry.remove()
    }
  }

  override render() {
    return html`<canvas aria-hidden="true"></canvas>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "motion-glass-slideshow": MotionGlassSlideshow
  }
}
