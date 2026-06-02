import { LitElement, css, html } from "lit"
import { customElement, property } from "lit/decorators.js"
import { gsap } from "gsap"

interface TrailConfig {
  imageLifespan?: number
  removalTickMs?: number
  mouseThreshold?: number
  minMovementForImage?: number
  inDuration?: number
  outDuration?: number
  maxRotationFactor?: number
  baseRotation?: number
  speedSmoothingFactor?: number
  minImageSize?: number
  maxImageSize?: number
  staggerOut?: number
}

interface TrailItem {
  el: HTMLImageElement
  rotation: number
  removeAt: number
}

const DEFAULT_CONFIG: Required<TrailConfig> = {
  imageLifespan: 600,
  removalTickMs: 16,
  mouseThreshold: 40,
  minMovementForImage: 5,
  inDuration: 600,
  outDuration: 800,
  maxRotationFactor: 3,
  baseRotation: 30,
  speedSmoothingFactor: 0.25,
  minImageSize: 260,
  maxImageSize: 340,
  staggerOut: 40,
}

const POOL_CAP = 24

@customElement("motion-image-trail")
export class MotionImageTrail extends LitElement {
  static override styles = css`
    :host {
      display: block;
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    .container {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    .trail-image {
      position: absolute;
      pointer-events: none;
      user-select: none;
      will-change: transform;
      transform-origin: 50% 50%;
    }
  `

  @property({ type: Array }) images: string[] = []
  @property({ type: Object }) config: TrailConfig = {}

  private _ctx: gsap.Context | null = null
  private _trail: TrailItem[] = []
  private _pool: HTMLImageElement[] = []
  private _raf = 0
  private _cleanupListeners?: () => void
  private _state = {
    imageIndex: 0,
    isPointerIn: false,
    isMoving: false,
    lastMouseX: 0,
    lastMouseY: 0,
    mouseX: 0,
    mouseY: 0,
    prevMouseX: 0,
    prevMouseY: 0,
    lastMoveTime: Date.now(),
    lastRemovalTime: 0,
    smoothedSpeed: 0,
    maxSpeed: 0.5,
  }

  override firstUpdated() {
    this._setup()
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._teardown()
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has("images") || changed.has("config")) {
      this._setup()
    }
  }

  replay() {
    this._setup()
  }

  private _teardown() {
    cancelAnimationFrame(this._raf)
    this._cleanupListeners?.()
    this._cleanupListeners = undefined
    this._ctx?.revert()
    this._ctx = null
    this._resetTrail()
  }

  private _setup() {
    this._teardown()

    const container = this.shadowRoot?.querySelector(".container")
    if (!(container instanceof HTMLDivElement) || !this.images.length) {
      return
    }

    const cfg: Required<TrailConfig> = {
      ...DEFAULT_CONFIG,
      ...this.config,
    }

    this._state = {
      imageIndex: 0,
      isPointerIn: false,
      isMoving: false,
      lastMouseX: 0,
      lastMouseY: 0,
      mouseX: 0,
      mouseY: 0,
      prevMouseX: 0,
      prevMouseY: 0,
      lastMoveTime: Date.now(),
      lastRemovalTime: 0,
      smoothedSpeed: 0,
      maxSpeed: 0.5,
    }

    this._ctx = gsap.context(() => {}, container)

    const getNextImageSrc = () => {
      const index = this._state.imageIndex % this.images.length
      this._state.imageIndex = (this._state.imageIndex + 1) % this.images.length
      return this.images[index] ?? ""
    }

    const hasMovedEnough = () => {
      const dx = this._state.mouseX - this._state.lastMouseX
      const dy = this._state.mouseY - this._state.lastMouseY
      return Math.hypot(dx, dy) > cfg.mouseThreshold
    }

    const hasMovedAtAll = () => {
      const dx = this._state.mouseX - this._state.prevMouseX
      const dy = this._state.mouseY - this._state.prevMouseY
      return Math.hypot(dx, dy) > cfg.minMovementForImage
    }

    const calcSpeed = () => {
      const now = Date.now()
      const dt = now - this._state.lastMoveTime
      if (dt <= 0) return this._state.smoothedSpeed

      const dist = Math.hypot(
        this._state.mouseX - this._state.prevMouseX,
        this._state.mouseY - this._state.prevMouseY,
      )
      const raw = dist / dt

      if (raw > this._state.maxSpeed) {
        this._state.maxSpeed = raw
      }

      const normalized = Math.min(raw / (this._state.maxSpeed || 0.5), 1)
      this._state.smoothedSpeed =
        this._state.smoothedSpeed * (1 - cfg.speedSmoothingFactor) +
        normalized * cfg.speedSmoothingFactor
      this._state.lastMoveTime = now

      return this._state.smoothedSpeed
    }

    const getPooledImage = () => {
      const pooled = this._pool.pop()
      if (pooled) return pooled

      const image = document.createElement("img")
      image.className = "trail-image"
      image.draggable = false
      return image
    }

    const recycleImage = (image: HTMLImageElement) => {
      gsap.killTweensOf(image)
      image.remove()
      image.removeAttribute("style")
      image.className = "trail-image"
      if (this._pool.length < POOL_CAP) {
        this._pool.push(image)
      }
    }

    const isInsideContainer = (clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect()
      return (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      )
    }

    const spawnTrail = (speed = 0.5) => {
      const rect = container.getBoundingClientRect()
      const x = this._state.mouseX - rect.left
      const y = this._state.mouseY - rect.top

      const size = Math.round(
        cfg.minImageSize + (cfg.maxImageSize - cfg.minImageSize) * speed,
      )
      const rotationFactor = 1 + speed * (cfg.maxRotationFactor - 1)
      const rotation = (Math.random() - 0.5) * cfg.baseRotation * rotationFactor

      const image = getPooledImage()
      image.src = getNextImageSrc()
      image.width = size
      image.height = size
      image.style.left = `${x}px`
      image.style.top = `${y}px`
      image.style.transform = "translate(-50%, -50%) scale(0)"

      container.appendChild(image)

      this._ctx?.add(() => {
        gsap.set(image, { rotation })
        gsap.to(image, {
          scale: 1,
          duration: cfg.inDuration / 1000,
          ease: "power2.out",
        })
      })

      this._trail.push({
        el: image,
        rotation,
        removeAt: Date.now() + cfg.imageLifespan,
      })
    }

    const tryEmit = () => {
      if (!this._state.isPointerIn) return
      if (hasMovedEnough() && hasMovedAtAll()) {
        this._state.lastMouseX = this._state.mouseX
        this._state.lastMouseY = this._state.mouseY
        const speed = calcSpeed()
        spawnTrail(speed)
        this._state.prevMouseX = this._state.mouseX
        this._state.prevMouseY = this._state.mouseY
      }
    }

    const cullOld = () => {
      const now = Date.now()
      if (now - this._state.lastRemovalTime < cfg.removalTickMs) return
      if (!this._trail.length) return

      const expired = this._trail.filter((item) => now >= item.removeAt)
      if (!expired.length) return

      expired.forEach((item, index) => {
        this._ctx?.add(() => {
          gsap.to(item.el, {
            duration: cfg.outDuration / 1000,
            scale: 0,
            ease: "power4.inOut",
            delay: (index * cfg.staggerOut) / 1000,
            onComplete: () => recycleImage(item.el),
          })
        })
      })

      for (let index = this._trail.length - 1; index >= 0; index -= 1) {
        if (now >= this._trail[index].removeAt) {
          this._trail.splice(index, 1)
        }
      }

      this._state.lastRemovalTime = now
    }

    let pointerIdleTimeout: number | null = null

    const onPointerMove = (event: PointerEvent) => {
      this._state.prevMouseX = this._state.mouseX
      this._state.prevMouseY = this._state.mouseY
      this._state.mouseX = event.clientX
      this._state.mouseY = event.clientY
      this._state.isPointerIn = isInsideContainer(event.clientX, event.clientY)

      if (this._state.isPointerIn) {
        this._state.isMoving = true
        if (pointerIdleTimeout) window.clearTimeout(pointerIdleTimeout)
        pointerIdleTimeout = window.setTimeout(() => {
          this._state.isMoving = false
          pointerIdleTimeout = null
        }, 100)
      }
    }

    const onPointerEnter = (event: PointerEvent) => {
      this._state.isPointerIn = true
      this._state.isMoving = false
      this._state.mouseX = event.clientX
      this._state.mouseY = event.clientY
      this._state.lastMouseX = event.clientX
      this._state.lastMouseY = event.clientY
      this._state.prevMouseX = event.clientX
      this._state.prevMouseY = event.clientY
      this._state.lastMoveTime = Date.now()
    }

    const onPointerLeave = () => {
      this._state.isPointerIn = false
      this._state.isMoving = false
    }

    const onTouchMove = (event: TouchEvent) => {
      if (!event.touches.length) return
      const touch = event.touches[0]
      const dx = Math.abs(touch.clientX - this._state.prevMouseX)
      const dy = Math.abs(touch.clientY - this._state.prevMouseY)
      if (dy > dx) return

      this._state.prevMouseX = this._state.mouseX
      this._state.prevMouseY = this._state.mouseY
      this._state.mouseX = touch.clientX
      this._state.mouseY = touch.clientY
      this._state.isPointerIn = isInsideContainer(touch.clientX, touch.clientY)
      if (this._state.isPointerIn) {
        this._state.isMoving = true
      }
    }

    const tick = () => {
      if (this._state.isMoving) tryEmit()
      cullOld()
      this._raf = requestAnimationFrame(tick)
    }

    container.addEventListener("pointermove", onPointerMove, { passive: true })
    container.addEventListener("pointerenter", onPointerEnter, { passive: true })
    container.addEventListener("pointerleave", onPointerLeave, { passive: true })
    container.addEventListener("touchmove", onTouchMove, { passive: true })
    this._raf = requestAnimationFrame(tick)

    this._cleanupListeners = () => {
      if (pointerIdleTimeout) window.clearTimeout(pointerIdleTimeout)
      container.removeEventListener("pointermove", onPointerMove)
      container.removeEventListener("pointerenter", onPointerEnter)
      container.removeEventListener("pointerleave", onPointerLeave)
      container.removeEventListener("touchmove", onTouchMove)
    }
  }

  private _resetTrail() {
    this._trail.forEach(({ el }) => {
      gsap.killTweensOf(el)
      el.remove()
    })
    this._trail = []
  }

  override render() {
    return html`<div class="container"></div>`
  }
}
