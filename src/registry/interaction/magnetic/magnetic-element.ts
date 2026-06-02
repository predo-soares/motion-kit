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
  @property({ type: Number }) duration = 1

  /** GSAP easing function. */
  @property() ease = "elastic.out(1, 0.3)"

  private _xTo!: gsap.QuickToFunc
  private _yTo!: gsap.QuickToFunc
  private _ctx?: gsap.Context

  override firstUpdated() {
    this._ctx = gsap.context(() => {
      this._xTo = gsap.quickTo(this, "x", {
        duration: this.duration,
        ease: this.ease,
      })
      this._yTo = gsap.quickTo(this, "y", {
        duration: this.duration,
        ease: this.ease,
      })
    }, this)

    this.addEventListener("mousemove", this._onMouseMove)
    this.addEventListener("mouseleave", this._onMouseLeave)
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this.removeEventListener("mousemove", this._onMouseMove)
    this.removeEventListener("mouseleave", this._onMouseLeave)
    this._ctx?.revert()
  }

  replay() {
    this._xTo(0)
    this._yTo(0)
  }

  private _onMouseMove = (e: MouseEvent) => {
    const { height, width, left, top } = this.getBoundingClientRect()
    this._xTo(e.clientX - (left + width / 2))
    this._yTo(e.clientY - (top + height / 2))
  }

  private _onMouseLeave = () => {
    this._xTo(0)
    this._yTo(0)
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
