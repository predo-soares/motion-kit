import { LitElement, css, html } from "lit"
import { customElement, property } from "lit/decorators.js"
import {
  Camera,
  Mesh,
  Plane,
  Program,
  Renderer,
  Texture,
  Transform,
  Vec2,
} from "ogl"

type ImageItem = string | { src: string; alt?: string }

type PlaneData = {
  index: number
  z: number
  imageIndex: number
  x: number
  y: number
}

type PlaneUniforms = {
  map: { value: Texture }
  opacity: { value: number }
  blurAmount: { value: number }
  scrollForce: { value: number }
  uTextureSize: { value: Vec2 }
}

type PlaneRuntime = {
  mesh: Mesh
  program: Program
  uniforms: PlaneUniforms
}

type FadeSettings = {
  fadeIn: { start: number; end: number }
  fadeOut: { start: number; end: number }
}

type BlurSettings = {
  blurIn: { start: number; end: number }
  blurOut: { start: number; end: number }
  maxBlur: number
}

const DEFAULT_DEPTH_RANGE = 50
const MAX_HORIZONTAL_OFFSET = 8
const MAX_VERTICAL_OFFSET = 8

const DEFAULT_FADE_SETTINGS: FadeSettings = {
  fadeIn: { start: 0.01, end: 0.25 },
  fadeOut: { start: 0.43, end: 0.46 },
}

const DEFAULT_BLUR_SETTINGS: BlurSettings = {
  blurIn: { start: 0, end: 0.2 },
  blurOut: { start: 0.43, end: 0.46 },
  maxBlur: 8,
}

const normalizeImages = (items: ImageItem[]) =>
  items.map((item) => (typeof item === "string" ? { src: item, alt: "" } : item))

const makeSpatialPositions = (count: number): { x: number; y: number }[] => {
  const positions: { x: number; y: number }[] = []

  for (let index = 0; index < count; index += 1) {
    const horizontalAngle = (index * 2.618) % (Math.PI * 2)
    const verticalAngle = (index * 1.618 + Math.PI / 3) % (Math.PI * 2)

    const horizontalRadius = (index % 3) * 1.2
    const verticalRadius = ((index + 1) % 4) * 0.8

    positions.push({
      x:
        (Math.sin(horizontalAngle) * horizontalRadius * MAX_HORIZONTAL_OFFSET) /
        3,
      y:
        (Math.cos(verticalAngle) * verticalRadius * MAX_VERTICAL_OFFSET) / 4,
    })
  }

  return positions
}

@customElement("motion-infinite-gallery")
export class MotionInfiniteGallery extends LitElement {
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

  @property({ type: Array }) images: ImageItem[] = []
  @property({ type: Number }) speed = 1
  @property({ type: Number, attribute: "visible-count" }) visibleCount = 8
  @property({ type: Object, attribute: "fade-settings" })
  fadeSettings: FadeSettings = DEFAULT_FADE_SETTINGS
  @property({ type: Object, attribute: "blur-settings" })
  blurSettings: BlurSettings = DEFAULT_BLUR_SETTINGS

  private _cleanup?: () => void
  private _setImageItems?: (items: ImageItem[]) => void
  private _setVisibleCount?: (count: number) => void

  override firstUpdated() {
    if (!this.hasAttribute("tabindex")) {
      this.tabIndex = 0
    }
    const canvas = this.shadowRoot?.querySelector("canvas")
    if (canvas instanceof HTMLCanvasElement) {
      this._init(canvas)
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._cleanup?.()
    this._cleanup = undefined
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has("images")) {
      this._setImageItems?.(this.images)
    }
    if (changed.has("visibleCount")) {
      this._setVisibleCount?.(this.visibleCount)
    }
  }

  replay() {
    this._cleanup?.()
    this._cleanup = undefined
    const canvas = this.shadowRoot?.querySelector("canvas")
    if (canvas instanceof HTMLCanvasElement) {
      this._init(canvas)
    }
  }

  private _init(canvas: HTMLCanvasElement) {
    this._cleanup?.()

    const depthRange = DEFAULT_DEPTH_RANGE
    const totalRange = depthRange
    let count = Math.max(1, Math.floor(this.visibleCount))
    let spatialPositions = makeSpatialPositions(count)

    const renderer = new Renderer({
      canvas,
      alpha: true,
      antialias: true,
      dpr: typeof window !== "undefined" ? window.devicePixelRatio : 1,
    })
    const gl = renderer.gl
    gl.clearColor(0, 0, 0, 0)

    canvas.style.width = "100%"
    canvas.style.height = "100%"

    const camera = new Camera(gl, {
      fov: 55,
      aspect: 1,
      near: 0.1,
      far: 100,
    })
    camera.position.set(0, 0, 0)

    const scene = new Transform()
    const geometry = new Plane(gl, {
      width: 1,
      height: 1,
      widthSegments: 32,
      heightSegments: 32,
    })

    const fallbackTexture = new Texture(gl, {
      image: new Uint8Array([0, 0, 0, 255]),
      width: 1,
      height: 1,
      format: gl.RGBA,
      type: gl.UNSIGNED_BYTE,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR,
      wrapS: gl.MIRRORED_REPEAT,
      wrapT: gl.MIRRORED_REPEAT,
      generateMipmaps: false,
      flipY: true,
      anisotropy: renderer.parameters.maxAnisotropy,
    })

    let normalizedImages = normalizeImages(this.images)
    let textures: Texture[] = []
    let imageLoadToken = 0
    let disposed = false

    const disposeTexture = (texture: Texture) => {
      if (texture.texture) {
        gl.deleteTexture(texture.texture)
      }
    }

    const setTexturesFromImages = (items: ImageItem[]) => {
      normalizedImages = normalizeImages(items)
      imageLoadToken += 1
      const token = imageLoadToken

      textures.forEach(disposeTexture)
      textures = []

      for (let index = 0; index < normalizedImages.length; index += 1) {
        const texture = new Texture(gl, {
          image: new Uint8Array([0, 0, 0, 255]),
          width: 1,
          height: 1,
          format: gl.RGBA,
          type: gl.UNSIGNED_BYTE,
          minFilter: gl.LINEAR,
          magFilter: gl.LINEAR,
          wrapS: gl.MIRRORED_REPEAT,
          wrapT: gl.MIRRORED_REPEAT,
          generateMipmaps: false,
          flipY: true,
          anisotropy: renderer.parameters.maxAnisotropy,
        })
        textures.push(texture)

        const image = new Image()
        image.crossOrigin = "anonymous"
        image.decoding = "async"
        image.onload = () => {
          if (disposed || token !== imageLoadToken) return
          texture.image = image
        }
        image.src = normalizedImages[index]?.src ?? ""
      }
    }

    const createPlane = (): PlaneRuntime => {
      const uniforms: PlaneUniforms = {
        map: { value: fallbackTexture },
        opacity: { value: 1 },
        blurAmount: { value: 0 },
        scrollForce: { value: 0 },
        uTextureSize: { value: new Vec2(1, 1) },
      }

      const program = new Program(gl, {
        vertex: `
          attribute vec3 position;
          attribute vec3 normal;
          attribute vec2 uv;

          uniform mat4 modelViewMatrix;
          uniform mat4 projectionMatrix;
          uniform float scrollForce;

          varying vec2 vUv;
          varying vec3 vNormal;

          void main() {
            vUv = uv;
            vNormal = normal;

            vec3 pos = position;

            float curveIntensity = scrollForce * 0.3;
            float distanceFromCenter = length(pos.xy);
            float curve = distanceFromCenter * distanceFromCenter * curveIntensity;

            float ripple1 = sin(pos.x * 2.0 + scrollForce * 3.0) * 0.02;
            float ripple2 = sin(pos.y * 2.5 + scrollForce * 2.0) * 0.015;
            float clothEffect = (ripple1 + ripple2) * abs(curveIntensity) * 2.0;

            pos.z -= (curve + clothEffect);

            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragment: `
          precision highp float;

          uniform sampler2D map;
          uniform float opacity;
          uniform float blurAmount;
          uniform float scrollForce;
          uniform vec2 uTextureSize;

          varying vec2 vUv;
          varying vec3 vNormal;

          void main() {
            vec4 color = texture2D(map, vUv);

            if (blurAmount > 0.0) {
              vec2 texelSize = 1.0 / max(uTextureSize, vec2(1.0));
              vec4 blurred = vec4(0.0);
              float total = 0.0;

              for (float x = -2.0; x <= 2.0; x += 1.0) {
                for (float y = -2.0; y <= 2.0; y += 1.0) {
                  vec2 offset = vec2(x, y) * texelSize * blurAmount;
                  float weight = 1.0 / (1.0 + length(vec2(x, y)));
                  blurred += texture2D(map, vUv + offset) * weight;
                  total += weight;
                }
              }
              color = blurred / total;
            }

            float curveHighlight = abs(scrollForce) * 0.05;
            color.rgb += vec3(curveHighlight * 0.1);

            gl_FragColor = vec4(color.rgb, color.a * opacity);
          }
        `,
        uniforms,
        transparent: true,
        depthTest: true,
        depthWrite: true,
      })

      const mesh = new Mesh(gl, {
        geometry,
        program,
        frustumCulled: false,
      })
      mesh.setParent(scene)

      return { mesh, program, uniforms }
    }

    let planesData: PlaneData[] = []
    let planes: PlaneRuntime[] = []

    const disposePlane = (plane: PlaneRuntime) => {
      plane.mesh.setParent(null)
      plane.program.remove()
    }

    const resetPlanes = (nextVisibleCount: number) => {
      planes.forEach(disposePlane)
      count = Math.max(1, Math.floor(nextVisibleCount))
      spatialPositions = makeSpatialPositions(count)
      planesData = Array.from({ length: count }, (_, index) => ({
        index,
        z: count > 0 ? ((depthRange / count) * index) % depthRange : 0,
        imageIndex: normalizedImages.length > 0 ? index % normalizedImages.length : 0,
        x: spatialPositions[index]?.x ?? 0,
        y: spatialPositions[index]?.y ?? 0,
      }))
      planes = Array.from({ length: count }, createPlane)
    }

    resetPlanes(count)
    setTexturesFromImages(this.images)

    this._setImageItems = setTexturesFromImages
    this._setVisibleCount = (nextCount: number) => {
      const visibleCount = Math.max(1, Math.floor(nextCount))
      if (visibleCount !== count) {
        resetPlanes(visibleCount)
      }
    }

    let scrollVelocity = 0
    let autoPlay = true
    let lastInteraction = Date.now()

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      scrollVelocity += event.deltaY * 0.01 * this.speed
      autoPlay = false
      lastInteraction = Date.now()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        scrollVelocity -= 2 * this.speed
        autoPlay = false
        lastInteraction = Date.now()
      } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        scrollVelocity += 2 * this.speed
        autoPlay = false
        lastInteraction = Date.now()
      }
    }

    canvas.addEventListener("wheel", handleWheel, { passive: false })
    this.addEventListener("keydown", handleKeyDown)

    const autoPlayInterval = window.setInterval(() => {
      if (Date.now() - lastInteraction > 3000) {
        autoPlay = true
      }
    }, 1000)

    let raf = 0
    let previous = 0
    const tick = (now: number) => {
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
        camera.perspective({
          fov: 55,
          aspect: w / Math.max(1, h),
          near: 0.1,
          far: 100,
        })
      }

      const delta = previous ? (now - previous) / 1000 : 0
      previous = now
      if (autoPlay) {
        scrollVelocity += 0.3 * delta
      }
      scrollVelocity *= 0.95

      const totalImages = normalizedImages.length
      const imageAdvance = totalImages > 0 ? count % totalImages || totalImages : 0

      for (let index = 0; index < planesData.length; index += 1) {
        const planeData = planesData[index]
        const plane = planes[index]
        if (!planeData || !plane) continue

        plane.uniforms.scrollForce.value = scrollVelocity

        let nextZ = planeData.z + scrollVelocity * delta * 10
        let wrapsForward = 0
        let wrapsBackward = 0

        if (nextZ >= totalRange) {
          wrapsForward = Math.floor(nextZ / totalRange)
          nextZ -= totalRange * wrapsForward
        } else if (nextZ < 0) {
          wrapsBackward = Math.ceil(-nextZ / totalRange)
          nextZ += totalRange * wrapsBackward
        }

        if (wrapsForward > 0 && imageAdvance > 0 && totalImages > 0) {
          planeData.imageIndex =
            (planeData.imageIndex + wrapsForward * imageAdvance) % totalImages
        }

        if (wrapsBackward > 0 && imageAdvance > 0 && totalImages > 0) {
          const step = planeData.imageIndex - wrapsBackward * imageAdvance
          planeData.imageIndex = ((step % totalImages) + totalImages) % totalImages
        }

        planeData.z = ((nextZ % totalRange) + totalRange) % totalRange
        planeData.x = spatialPositions[index]?.x ?? 0
        planeData.y = spatialPositions[index]?.y ?? 0

        const normalizedPosition = planeData.z / totalRange
        const fadeSettings = this.fadeSettings ?? DEFAULT_FADE_SETTINGS
        const blurSettings = this.blurSettings ?? DEFAULT_BLUR_SETTINGS
        let opacity = 1

        if (
          normalizedPosition >= fadeSettings.fadeIn.start &&
          normalizedPosition <= fadeSettings.fadeIn.end
        ) {
          const progress =
            (normalizedPosition - fadeSettings.fadeIn.start) /
            (fadeSettings.fadeIn.end - fadeSettings.fadeIn.start)
          opacity = progress
        } else if (normalizedPosition < fadeSettings.fadeIn.start) {
          opacity = 0
        } else if (
          normalizedPosition >= fadeSettings.fadeOut.start &&
          normalizedPosition <= fadeSettings.fadeOut.end
        ) {
          const progress =
            (normalizedPosition - fadeSettings.fadeOut.start) /
            (fadeSettings.fadeOut.end - fadeSettings.fadeOut.start)
          opacity = 1 - progress
        } else if (normalizedPosition > fadeSettings.fadeOut.end) {
          opacity = 0
        }

        let blur = 0
        if (
          normalizedPosition >= blurSettings.blurIn.start &&
          normalizedPosition <= blurSettings.blurIn.end
        ) {
          const progress =
            (normalizedPosition - blurSettings.blurIn.start) /
            (blurSettings.blurIn.end - blurSettings.blurIn.start)
          blur = blurSettings.maxBlur * (1 - progress)
        } else if (normalizedPosition < blurSettings.blurIn.start) {
          blur = blurSettings.maxBlur
        } else if (
          normalizedPosition >= blurSettings.blurOut.start &&
          normalizedPosition <= blurSettings.blurOut.end
        ) {
          const progress =
            (normalizedPosition - blurSettings.blurOut.start) /
            (blurSettings.blurOut.end - blurSettings.blurOut.start)
          blur = blurSettings.maxBlur * progress
        } else if (normalizedPosition > blurSettings.blurOut.end) {
          blur = blurSettings.maxBlur
        }

        plane.uniforms.opacity.value = Math.max(0, Math.min(1, opacity))
        plane.uniforms.blurAmount.value = Math.max(
          0,
          Math.min(blurSettings.maxBlur, blur),
        )

        const texture =
          totalImages > 0 ? (textures[planeData.imageIndex] ?? fallbackTexture) : fallbackTexture
        plane.uniforms.map.value = texture

        const textureWidth =
          texture.image && "width" in texture.image
            ? Math.max(1, Number(texture.image.width) || 1)
            : 1
        const textureHeight =
          texture.image && "height" in texture.image
            ? Math.max(1, Number(texture.image.height) || 1)
            : 1
        plane.uniforms.uTextureSize.value.set(textureWidth, textureHeight)

        const aspect = textureWidth / textureHeight
        if (aspect > 1) {
          plane.mesh.scale.set(2 * aspect, 2, 1)
        } else {
          plane.mesh.scale.set(2, 2 / Math.max(aspect, 0.00001), 1)
        }

        plane.mesh.position.set(
          planeData.x,
          planeData.y,
          planeData.z - depthRange / 2,
        )
      }

      renderer.render({ scene, camera, clear: true })
      raf = window.requestAnimationFrame(tick)
    }

    raf = window.requestAnimationFrame(tick)

    this._cleanup = () => {
      disposed = true
      imageLoadToken += 1
      window.cancelAnimationFrame(raf)
      window.clearInterval(autoPlayInterval)
      canvas.removeEventListener("wheel", handleWheel)
      this.removeEventListener("keydown", handleKeyDown)
      this._setImageItems = undefined
      this._setVisibleCount = undefined

      planes.forEach(disposePlane)
      geometry.remove()
      textures.forEach(disposeTexture)
      disposeTexture(fallbackTexture)
    }
  }

  override render() {
    return html`<canvas aria-hidden="true"></canvas>`
  }
}
