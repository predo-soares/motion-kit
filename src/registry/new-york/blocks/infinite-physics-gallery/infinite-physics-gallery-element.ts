import { LitElement, html, css } from "lit"
import { customElement, property } from "lit/decorators.js"
import { repeat } from "lit/directives/repeat.js"
import { gsap } from "gsap"

type MediaItem =
  | { type: "image"; src: string; alt?: string }
  | { type: "video"; src: string }

interface Cell {
  id: string
  item: MediaItem
  posX: number
  posY: number
}

const MIN_POINTER_DT = 8
const WHEEL_DELTA_LIMIT = 220
const WHEEL_IMPULSE = 0.04
const DRAG_VELOCITY_BLEND = 0.3
const EDGE_RESPONSE = 0.22
const EDGE_VELOCITY_MULTIPLIER = 2.2
const MAX_VELOCITY = 24

/**
 * Infinite physics-based 2-D gallery. Drag or scroll to navigate.
 * Edge proximity auto-scrolls when the cursor lingers near the boundary.
 *
 * Items are passed as a JSON array:
 * `[{"type":"image","src":"...","alt":"..."},{"type":"video","src":"..."}]`
 *
 * @example
 * <motion-infinite-physics-gallery
 *   items='[{"type":"image","src":"/1.jpg"},{"type":"image","src":"/2.jpg"}]'
 *   cell-width="320"
 *   cell-height="400"
 *   class="h-[480px] w-full rounded-2xl overflow-hidden"
 * ></motion-infinite-physics-gallery>
 */
@customElement("motion-infinite-physics-gallery")
export class MotionInfinitePhysicsGallery extends LitElement {
  static override styles = css`
    :host {
      display: block;
      position: relative;
      overflow: hidden;
      touch-action: none;
      user-select: none;
    }
    .bg {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .cell {
      position: absolute;
      top: 0;
      left: 0;
      overflow: hidden;
      will-change: transform;
      pointer-events: auto;
    }
    .cell img,
    .cell video {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      pointer-events: none;
      -webkit-user-drag: none;
    }
  `

  /** JSON array of media items: `[{"type":"image","src":"...","alt":"..."},...]` */
  @property({ type: String }) items = "[]"

  /** Cell width in pixels. */
  @property({ type: Number, attribute: "cell-width" }) cellWidth = 320

  /** Cell height in pixels. */
  @property({ type: Number, attribute: "cell-height" }) cellHeight = 400

  /** Gap between cells in pixels. */
  @property({ type: Number }) gap = 24

  /** Base inertia friction (0–1). */
  @property({ type: Number }) friction = 0.95

  /** Wheel speed multiplier. */
  @property({ type: Number, attribute: "wheel-speed" }) wheelSpeed = 2

  /** Edge auto-scroll threshold in pixels. */
  @property({ type: Number, attribute: "edge-threshold" }) edgeThreshold = 100

  /** Edge auto-scroll speed. */
  @property({ type: Number, attribute: "edge-scroll-speed" }) edgeScrollSpeed = 2

  // ── Physics state ────────────────────────────────────────────────────
  private _ox = 0
  private _oy = 0
  private _vx = 0
  private _vy = 0
  private _evx = 0
  private _evy = 0
  private _mx = 0
  private _my = 0
  private _dragging = false
  private _pointerId: number | null = null
  private _lp = { x: 0, y: 0 }
  private _lpt = 0
  private _vpW = 0
  private _vpH = 0

  // ── Display state (triggers Lit renders) ─────────────────────────────
  private _displayOx = 0
  private _displayOy = 0
  private _isDragging = false

  private _resizeObs?: ResizeObserver
  private _cachedItems: MediaItem[] = []

  override connectedCallback() {
    super.connectedCallback()
    this._cachedItems = JSON.parse(this.items)
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._resizeObs?.disconnect()
    gsap.ticker.remove(this._tick)
  }

  override firstUpdated() {
    const host = this as HTMLElement
    this._vpW = host.clientWidth
    this._vpH = host.clientHeight

    this._resizeObs = new ResizeObserver(() => {
      this._vpW = host.clientWidth
      this._vpH = host.clientHeight
      this.requestUpdate()
    })
    this._resizeObs.observe(host)

    host.addEventListener("pointerdown", this._onPointerDown)
    host.addEventListener("pointermove", this._onPointerMove)
    host.addEventListener("pointerup", this._onPointerEnd)
    host.addEventListener("pointercancel", this._onPointerEnd)
    host.addEventListener("pointerleave", this._onPointerLeave)
    host.addEventListener("wheel", this._onWheel, { passive: false })

    gsap.ticker.add(this._tick)
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has("items")) {
      this._cachedItems = JSON.parse(this.items)
    }
  }

  replay() {
    this._ox = 0
    this._oy = 0
    this._vx = 0
    this._vy = 0
    this._displayOx = 0
    this._displayOy = 0
    this.requestUpdate()
  }

  // ── Tick ─────────────────────────────────────────────────────────────
  private _tick = (_time: number, deltaMs: number) => {
    if (this._dragging) return

    const deltaFrames = Math.max(deltaMs / 16.6667, 0.0001)
    const fr = Math.pow(this.friction * 0.95, deltaFrames)
    this._vx *= fr
    this._vy *= fr
    if (Math.abs(this._vx) < 0.01) this._vx = 0
    if (Math.abs(this._vy) < 0.01) this._vy = 0

    const ex = this._edgeInfluence(this._mx, this._vpW, this.edgeThreshold)
    const ey = this._edgeInfluence(this._my, this._vpH, this.edgeThreshold)
    const evtX = ex * this.edgeScrollSpeed * EDGE_VELOCITY_MULTIPLIER
    const evtY = ey * this.edgeScrollSpeed * EDGE_VELOCITY_MULTIPLIER
    this._evx = this._damp(this._evx, evtX, EDGE_RESPONSE, deltaFrames)
    this._evy = this._damp(this._evy, evtY, EDGE_RESPONSE, deltaFrames)

    const vx = this._clamp(this._vx + this._evx, -MAX_VELOCITY, MAX_VELOCITY)
    const vy = this._clamp(this._vy + this._evy, -MAX_VELOCITY, MAX_VELOCITY)

    if (vx !== 0 || vy !== 0) {
      this._ox += vx * deltaFrames
      this._oy += vy * deltaFrames
      this._displayOx = this._ox
      this._displayOy = this._oy
      this.requestUpdate()
    }
  }

  // ── Pointer handlers ─────────────────────────────────────────────────
  private _onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType !== "touch") return
    this._dragging = true
    this._isDragging = true
    this._pointerId = e.pointerId
    this._vx = 0
    this._vy = 0
    this._evx = 0
    this._evy = 0
    this._lp = { x: e.clientX, y: e.clientY }
    this._lpt = Date.now()
    this._setMouse(e.clientX, e.clientY)
    try {
      (this as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      // capture may fail for some pointer types
    }
    this.requestUpdate()
  }

  private _onPointerMove = (e: PointerEvent) => {
    this._setMouse(e.clientX, e.clientY)
    if (!this._dragging || this._pointerId !== e.pointerId) return

    const now = Date.now()
    const dt = Math.max(now - this._lpt, MIN_POINTER_DT)
    const dx = e.clientX - this._lp.x
    const dy = e.clientY - this._lp.y

    this._ox += dx
    this._oy += dy
    const pvx = dx * (16 / dt)
    const pvy = dy * (16 / dt)
    this._vx =
      this._vx * DRAG_VELOCITY_BLEND + pvx * (1 - DRAG_VELOCITY_BLEND)
    this._vy =
      this._vy * DRAG_VELOCITY_BLEND + pvy * (1 - DRAG_VELOCITY_BLEND)
    this._vx = this._clamp(this._vx, -MAX_VELOCITY, MAX_VELOCITY)
    this._vy = this._clamp(this._vy, -MAX_VELOCITY, MAX_VELOCITY)
    this._lp = { x: e.clientX, y: e.clientY }
    this._lpt = now
    this._displayOx = this._ox
    this._displayOy = this._oy
    this.requestUpdate()
  }

  private _onPointerEnd = (e: PointerEvent) => {
    if (this._pointerId !== e.pointerId) return
    this._dragging = false
    this._isDragging = false
    try {
      if ((this as HTMLElement).hasPointerCapture(e.pointerId)) {
        (this as HTMLElement).releasePointerCapture(e.pointerId)
      }
    } catch {
      // ignore
    }
    this._pointerId = null
    this.requestUpdate()
  }

  private _onPointerLeave = () => {
    if (!this._dragging) {
      this._mx = 0
      this._my = 0
    }
  }

  private _onWheel = (e: WheelEvent) => {
    e.preventDefault()
    const scale =
      e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this._vpH || 800 : 1
    const dx = this._clamp(e.deltaX * scale, -WHEEL_DELTA_LIMIT, WHEEL_DELTA_LIMIT)
    const dy = this._clamp(e.deltaY * scale, -WHEEL_DELTA_LIMIT, WHEEL_DELTA_LIMIT)
    this._vx -= dx * this.wheelSpeed * WHEEL_IMPULSE
    this._vy -= dy * this.wheelSpeed * WHEEL_IMPULSE
    this._vx = this._clamp(this._vx, -MAX_VELOCITY, MAX_VELOCITY)
    this._vy = this._clamp(this._vy, -MAX_VELOCITY, MAX_VELOCITY)
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  private _setMouse(cx: number, cy: number) {
    const rect = (this as HTMLElement).getBoundingClientRect()
    this._mx = cx - rect.left
    this._my = cy - rect.top
  }

  private _clamp(v: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, v))
  }

  private _damp(cur: number, tgt: number, s: number, df: number) {
    return cur + (tgt - cur) * (1 - Math.pow(1 - s, df))
  }

  private _edgeInfluence(pos: number, size: number, threshold: number) {
    if (pos <= 0 || size <= 0 || threshold <= 0) return 0
    if (pos < threshold) return 1 - pos / threshold
    if (pos > size - threshold) return -1 + (size - pos) / threshold
    return 0
  }

  private _mod(v: number, d: number) {
    return ((v % d) + d) % d
  }

  // ── Render ────────────────────────────────────────────────────────────
  private _visibleCells(): Cell[] {
    const items = this._cachedItems
    if (!items.length || this._vpW === 0) return []

    const cw = this.cellWidth + this.gap
    const ch = this.cellHeight + this.gap
    const ox = this._displayOx
    const oy = this._displayOy

    const startX = Math.floor(-ox / cw) - 1
    const endX = Math.ceil((this._vpW - ox) / cw) + 1
    const startY = Math.floor(-oy / ch) - 1
    const endY = Math.ceil((this._vpH - oy) / ch) + 1

    const cells: Cell[] = []
    for (let i = startX; i <= endX; i++) {
      for (let j = startY; j <= endY; j++) {
        const idx = this._mod(i + j * 7, items.length)
        cells.push({
          id: `${i}-${j}`,
          item: items[idx],
          posX: i * cw + ox,
          posY: j * ch + oy,
        })
      }
    }
    return cells
  }

  override render() {
    const cells = this._visibleCells()
    const cw = this.cellWidth
    const ch = this.cellHeight
    const cursor = this._isDragging ? "grabbing" : "grab"

    return html`
      <div class="bg" style="cursor:${cursor};pointer-events:none;"></div>
      ${repeat(
        cells,
        (c) => c.id,
        (c) => {
          const item = c.item
          return html`
            <div
              class="cell"
              style="width:${cw}px;height:${ch}px;transform:translate3d(${c.posX}px,${c.posY}px,0);"
            >
              ${item.type === "image"
                ? html`<img src="${item.src}" alt="${(item as any).alt ?? ""}" />`
                : html`<video src="${item.src}" autoplay muted loop playsinline></video>`}
            </div>
          `
        },
      )}
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "motion-infinite-physics-gallery": MotionInfinitePhysicsGallery
  }
}
