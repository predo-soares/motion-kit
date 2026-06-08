import { LitElement, html, css } from "lit"
import { customElement, property } from "lit/decorators.js"
import { gsap } from "gsap"

/**
 * A wrapper element that applies spring physics to its children,
 * making them stick to the cursor on hover.
 *
 * @example
 * <motion-magnetic duration="1.2">
 *   <button>Hover me</button>
 * </motion-magnetic>
 */
@customElement("motion-magnetic")
export class MotionMagnetic extends LitElement {
  static override styles = css`
    :host {
      display: inline-block;
    }
  `

  /** Animation duration in seconds. */
  @property({ type: Number }) declare duration: number

  /** GSAP easing function. */
  @property() declare ease: string

  /** Multiplier for the magnetic pull (0 = none, 1 = full offset). */
  @property({ type: Number }) declare strength: number

  private _xTo?: gsap.QuickToFunc
  private _yTo?: gsap.QuickToFunc
  private _builtWith?: { duration: number; ease: string }

  constructor() {
    super()
    this.duration = 1
    this.ease = "elastic.out(1, 0.3)"
    this.strength = 1
  }

  override connectedCallback() {
    super.connectedCallback()
    this.addEventListener("mousemove", this._onMouseMove)
    this.addEventListener("mouseleave", this._onMouseLeave)
    if (this.hasUpdated) this._initQuickTo()
  }

  override firstUpdated() {
    this._initQuickTo()
  }

  override updated(changed: Map<string, unknown>) {
    if (!this.hasUpdated) return
    if (changed.has("duration") || changed.has("ease")) this._initQuickTo()
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this.removeEventListener("mousemove", this._onMouseMove)
    this.removeEventListener("mouseleave", this._onMouseLeave)
    gsap.killTweensOf(this)
    this._xTo = undefined
    this._yTo = undefined
    this._builtWith = undefined
  }

  replay() {
    this._xTo?.(0)
    this._yTo?.(0)
  }

  private _initQuickTo() {
    const duration = Number(this.duration)
    const ease = this.ease
    if (this._builtWith?.duration === duration && this._builtWith?.ease === ease) return
    gsap.killTweensOf(this)
    this._xTo = gsap.quickTo(this, "x", { duration, ease })
    this._yTo = gsap.quickTo(this, "y", { duration, ease })
    this._builtWith = { duration, ease }
  }

  private _onMouseMove = (e: MouseEvent) => {
    const { height, width, left, top } = this.getBoundingClientRect()
    this.style.zIndex = "9999"
    this._xTo?.((e.clientX - (left + width / 2)) * this.strength)
    this._yTo?.((e.clientY - (top + height / 2)) * this.strength)
  }

  private _onMouseLeave = () => {
    this.style.zIndex = ""
    this._xTo?.(0)
    this._yTo?.(0)
  }

  override render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "motion-magnetic": MotionMagnetic
  }
}
