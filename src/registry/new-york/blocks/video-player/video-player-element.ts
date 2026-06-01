import { LitElement, html, css, nothing } from "lit"
import { customElement, property, state } from "lit/decorators.js"
import { gsap } from "gsap"
import { Flip } from "gsap/Flip"

gsap.registerPlugin(Flip)

const ICON_PLAY = "M7 5v14l11-7z"
const ICON_PAUSE = "M6 5h4v14H6zM14 5h4v14h-4z"
const ICON_VOLUME =
  "M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"
const ICON_MUTE =
  "M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z"
const ICON_ENTER_FS = "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
const ICON_EXIT_FS =
  "M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"

function formatTime(s: number) {
  if (!Number.isFinite(s) || s < 0) return "0:00"
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, "0")}`
}

/**
 * Custom video player with play/pause, scrubber, mute, and fullscreen expand.
 * Fullscreen is handled with a GSAP Flip layout animation — no native fullscreen API.
 *
 * @example
 * <motion-video-player
 *   src="https://example.com/video.mp4"
 *   poster="https://example.com/poster.jpg"
 *   class="aspect-video w-full max-w-2xl rounded-xl overflow-hidden"
 * ></motion-video-player>
 */
@customElement("motion-video-player")
export class MotionVideoPlayer extends LitElement {
  static override styles = css`
    :host {
      display: block;
      position: relative;
      overflow: hidden;
    }
    :host([fullscreen]) {
      position: fixed !important;
      inset: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      max-width: 100vw !important;
      border-radius: 0 !important;
      z-index: 9999 !important;
    }
    video {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      cursor: pointer;
    }
    .grad {
      position: absolute;
      right: 0;
      bottom: 0;
      left: 0;
      height: 8rem;
      background: linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.35) 50%, transparent 100%);
      pointer-events: none;
      z-index: 10;
    }
    .controls {
      position: absolute;
      right: 0;
      bottom: 0;
      left: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 2.5rem 1rem 1rem;
      pointer-events: none;
    }
    .btn {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border-radius: 9999px;
      background: rgba(255,255,255,0.12);
      color: #fff;
      border: none;
      cursor: pointer;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      transition: background 0.15s ease, transform 0.15s ease;
      pointer-events: auto;
    }
    .btn:hover {
      background: rgba(255,255,255,0.22);
    }
    .btn:active {
      transform: scale(0.93);
    }
    .btn svg {
      display: block;
    }
    /* Scrubber */
    .scrubber-root {
      flex: 1;
      position: relative;
      height: 2.5rem;
      display: flex;
      align-items: center;
      touch-action: none;
      cursor: pointer;
      pointer-events: auto;
    }
    .track {
      position: relative;
      width: 100%;
      height: 6px;
      border-radius: 999px;
      overflow: hidden;
      background: rgba(255,255,255,0.15);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      transition: height 0.2s ease;
    }
    .scrubber-root:hover .track,
    .scrubber-root.dragging .track {
      height: 20px;
    }
    .progress {
      position: absolute;
      inset: 0;
      transform-origin: left;
      background: rgba(255,255,255,0.5);
    }
    .thumb {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: 2px;
      background: #fff;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.15s ease;
    }
    .scrubber-root:hover .thumb,
    .scrubber-root.dragging .thumb {
      opacity: 1;
    }
    .hover-time {
      position: absolute;
      top: -2rem;
      left: 0;
      transform: translateX(-50%);
      background: rgba(255,255,255,0.12);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      color: #fff;
      font-family: monospace;
      font-size: 0.625rem;
      line-height: 1;
      padding: 0.25rem 0.4rem;
      border-radius: 0.25rem;
      white-space: nowrap;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.15s ease;
    }
    .scrubber-root:hover .hover-time,
    .scrubber-root.dragging .hover-time {
      opacity: 1;
    }
    .time-display {
      display: flex;
      align-items: center;
      gap: 0.15rem;
      font-family: monospace;
      font-size: 0.625rem;
      font-weight: 500;
      color: #fff;
      pointer-events: none;
      white-space: nowrap;
    }
    .time-sep {
      opacity: 0.6;
    }
  `

  @property({ type: String }) src = ""
  @property({ type: String }) poster = ""
  @property({ type: Boolean }) autoplay = false
  @property({ type: Boolean }) muted = true
  @property({ type: Boolean }) loop = false
  @property({ type: Boolean, attribute: "hide-controls" }) hideControls = false

  @state() private _playing = false
  @state() private _hovered = false
  @state() private _currentTime = 0
  @state() private _duration = 0
  @state() private _scrubDragging = false
  @state() private _hoverX = 0
  @state() private _hoverTime = 0
  @state() private _fullscreen = false

  private _video?: HTMLVideoElement
  private _rafId = 0
  private _originalParent: ParentNode | null = null
  private _originalNext: Node | null = null
  private _placeholder: HTMLElement | null = null

  private _onHostEnter = () => { this._hovered = true }
  private _onHostLeave = () => { this._hovered = false }

  override connectedCallback() {
    super.connectedCallback()
    this.addEventListener("mouseenter", this._onHostEnter)
    this.addEventListener("mouseleave", this._onHostLeave)
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this.removeEventListener("mouseenter", this._onHostEnter)
    this.removeEventListener("mouseleave", this._onHostLeave)
    cancelAnimationFrame(this._rafId)
    this._cleanupFullscreen()
  }

  private _cleanupFullscreen() {
    if (this._fullscreen && document.body.contains(this as Node)) {
      const ph = this._placeholder
      if (ph && this._originalParent) {
        this._originalParent.insertBefore(this, ph)
        ph.remove()
      }
      this._placeholder = null
      this._fullscreen = false
    }
  }

  private get _videoEl(): HTMLVideoElement | null {
    return this.shadowRoot?.querySelector("video") ?? null
  }

  private _onPlay = () => {
    this._playing = true
    this._rafId = requestAnimationFrame(this._tick)
  }

  private _onPause = () => {
    this._playing = false
    cancelAnimationFrame(this._rafId)
  }

  private _onLoadedMeta = () => {
    const v = this._videoEl
    if (!v) return
    this._duration = v.duration
    this._currentTime = v.currentTime
  }

  private _onEnded = () => {
    this._playing = false
    this._currentTime = this._duration
    cancelAnimationFrame(this._rafId)
  }

  private _tick = () => {
    const v = this._videoEl
    if (v && !this._scrubDragging && !v.paused) {
      this._currentTime = v.currentTime
    }
    if (this._playing) {
      this._rafId = requestAnimationFrame(this._tick)
    }
  }

  private _togglePlay() {
    if (this.hideControls) return
    const v = this._videoEl
    if (!v) return
    if (v.paused) v.play()
    else v.pause()
  }

  private _toggleMute() {
    const v = this._videoEl
    if (!v) return
    this.muted = !this.muted
    v.muted = this.muted
  }

  private async _toggleFullscreen() {
    if (!this._fullscreen) {
      // Capture FLIP state before DOM changes
      const state = Flip.getState(this as unknown as Element, {
        props: "borderRadius",
      })
      this._originalParent = this.parentNode
      this._originalNext = this.nextSibling
      const rect = (this as HTMLElement).getBoundingClientRect()
      const ph = document.createElement("div")
      ph.style.width = rect.width + "px"
      ph.style.height = rect.height + "px"
      ph.style.display = "block"
      ph.style.flexShrink = "0"
      if (this._originalParent) this._originalParent.insertBefore(ph, this)
      this._placeholder = ph
      document.body.appendChild(this)
      this._fullscreen = true
      await this.updateComplete
      Flip.from(state, {
        duration: 0.5,
        ease: "power4.inOut",
        absolute: true,
        zIndex: 9999,
      })
    } else {
      const ph = this._placeholder
      if (!ph) return
      Flip.fit(this as unknown as Element, ph, {
        duration: 0.5,
        ease: "power4.inOut",
        absolute: true,
        borderRadius: "0.75rem",
        onComplete: () => {
          this._fullscreen = false
          if (ph.parentNode && this._originalParent) {
            if (this._originalNext) {
              this._originalParent.insertBefore(this, this._originalNext)
            } else {
              this._originalParent.appendChild(this)
            }
          }
          ph.remove()
          this._placeholder = null
          gsap.set(this as unknown as Element, { clearProps: "all" })
        },
      })
    }
  }

  // ── Scrubber ─────────────────────────────────────────────────────────
  private _scrubberPointerDown(e: PointerEvent) {
    const root = e.currentTarget as HTMLElement
    root.setPointerCapture(e.pointerId)
    this._scrubDragging = true
    this._seek(e, root)
    const v = this._videoEl
    if (v && this._playing) v.pause()
  }

  private _scrubberPointerMove(e: PointerEvent) {
    const root = e.currentTarget as HTMLElement
    const track = root.querySelector<HTMLElement>(".track")
    if (!track) return
    const bounds = track.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - bounds.left, bounds.width))
    this._hoverX = x
    this._hoverTime = (x / bounds.width) * this._duration
    if (this._scrubDragging) {
      const v = this._videoEl
      if (v) v.currentTime = this._hoverTime
      this._currentTime = this._hoverTime
    }
  }

  private _scrubberPointerUp(e: PointerEvent) {
    const root = e.currentTarget as HTMLElement
    root.releasePointerCapture(e.pointerId)
    this._scrubDragging = false
    const v = this._videoEl
    if (v && this._playing) v.play()
  }

  private _seek(e: PointerEvent, root: HTMLElement) {
    const track = root.querySelector<HTMLElement>(".track")
    if (!track || !this._duration) return
    const bounds = track.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - bounds.left, bounds.width))
    const t = (x / bounds.width) * this._duration
    const v = this._videoEl
    if (v) v.currentTime = t
    this._currentTime = t
  }

  override render() {
    const progress = this._duration > 0 ? this._currentTime / this._duration : 0
    const controlsVisible = this._hovered || !this._playing
    const controlsOpacity = controlsVisible ? "1" : "0"
    const controlsPointer = controlsVisible ? "auto" : "none"

    return html`
      <video
        .src="${this.src}"
        .poster="${this.poster ?? ""}"
        ?autoplay="${this.autoplay}"
        ?muted="${this.muted}"
        ?loop="${this.loop}"
        playsinline
        @play="${this._onPlay}"
        @pause="${this._onPause}"
        @loadedmetadata="${this._onLoadedMeta}"
        @ended="${this._onEnded}"
        @click="${this._togglePlay}"
      ></video>

      ${this.hideControls
        ? nothing
        : html`
            <div
              class="grad"
              style="opacity:${controlsOpacity};transition:opacity 0.3s ease;"
            ></div>
            <div
              class="controls"
              style="opacity:${controlsOpacity};pointer-events:${controlsPointer};transition:opacity 0.3s ease;"
            >
              <!-- Play / Pause -->
              <button
                class="btn"
                aria-label="${this._playing ? "Pause" : "Play"}"
                @click="${this._togglePlay}"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="${this._playing ? ICON_PAUSE : ICON_PLAY}"></path>
                </svg>
              </button>

              <!-- Scrubber -->
              <div
                class="scrubber-root ${this._scrubDragging ? "dragging" : ""}"
                @pointerdown="${this._scrubberPointerDown}"
                @pointermove="${this._scrubberPointerMove}"
                @pointerup="${this._scrubberPointerUp}"
                @pointercancel="${this._scrubberPointerUp}"
              >
                <div class="track">
                  <div
                    class="progress"
                    style="transform:scaleX(${progress});"
                  ></div>
                </div>
                <div
                  class="thumb"
                  style="transform:translateX(${this._hoverX}px);"
                ></div>
                <div
                  class="hover-time"
                  style="left:${this._hoverX}px;"
                >
                  ${formatTime(this._hoverTime)}
                </div>
              </div>

              <!-- Time display -->
              <div class="time-display">
                <span>${formatTime(this._currentTime)}</span>
                <span class="time-sep">/</span>
                <span>${formatTime(this._duration)}</span>
              </div>

              <!-- Mute -->
              <button
                class="btn"
                aria-label="${this.muted ? "Unmute" : "Mute"}"
                @click="${this._toggleMute}"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="${this.muted ? ICON_MUTE : ICON_VOLUME}"></path>
                </svg>
              </button>

              <!-- Fullscreen -->
              <button
                class="btn"
                aria-label="${this._fullscreen ? "Exit fullscreen" : "Fullscreen"}"
                @click="${this._toggleFullscreen}"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="${this._fullscreen ? ICON_EXIT_FS : ICON_ENTER_FS}"></path>
                </svg>
              </button>
            </div>

          `}
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "motion-video-player": MotionVideoPlayer
  }
}
