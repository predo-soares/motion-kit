import { LitElement, html, css } from "lit"
import { customElement, property } from "lit/decorators.js"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

/**
 * Scroll-driven sticky card stack. Nest <motion-card-stack-item> elements inside.
 * Apply padding directly on this element via class or style.
 *
 * @example
 * <motion-card-stack scroll-element="#scroller" class="p-16">
 *   <motion-card-stack-item class="rounded-2xl bg-white p-8 min-h-[320px]">
 *     Card 1
 *   </motion-card-stack-item>
 *   <motion-card-stack-item class="rounded-2xl bg-slate-50 p-8 min-h-[320px]">
 *     Card 2
 *   </motion-card-stack-item>
 * </motion-card-stack>
 */
@customElement("motion-card-stack")
export class MotionCardStack extends LitElement {
  static override styles = css`
    :host {
      display: block;
      position: relative;
      width: 100%;
    }
  `

  @property({ type: Number, attribute: "scale-factor" }) scaleFactor = 0.05
  @property({ type: Number }) gap = 0
  @property({ type: Number }) offset = 10
  @property({ type: Number, attribute: "top-offset" }) topOffset = 0
  @property({ attribute: "scroll-element" }) scrollElement = ""

  private _ctx?: gsap.Context
  private _cancelled = false

  override firstUpdated() {
    void this._init()
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._cleanup()
  }

  private _resolveScroller(): HTMLElement | Window {
    if (this.scrollElement) {
      return document.querySelector<HTMLElement>(this.scrollElement) ?? window
    }
    return window
  }

  private _cleanup() {
    this._cancelled = true
    this._ctx?.revert()
    this._ctx = undefined
    this.style.paddingBottom = ""
  }

  replay() {
    const scroller = this._resolveScroller()
    if (scroller instanceof HTMLElement) {
      scroller.scrollTop = 0
    } else {
      window.scrollTo(0, 0)
    }
    void this._init()
  }

  private async _init() {
    this._cleanup()
    this._cancelled = false

    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    if (this._cancelled) return

    const cards = Array.from(
      this.querySelectorAll<HTMLElement>("motion-card-stack-item"),
    )
    if (!cards.length) return

    const scroller = this._resolveScroller()
    const { gap, scaleFactor, offset, topOffset } = this

    const scrollerHeight =
      scroller instanceof HTMLElement ? scroller.clientHeight : window.innerHeight

    const lastCard = cards[cards.length - 1]!
    const targetPos = topOffset + (cards.length - 1) * offset
    const totalGap = Math.max(0, cards.length - 1) * gap
    const extraPadding = Math.max(
      0,
      scrollerHeight - lastCard.offsetHeight - targetPos - totalGap,
    )
    if (extraPadding > 0) this.style.paddingBottom = `${extraPadding}px`

    this._ctx = gsap.context(() => {
      cards.forEach((card, index) => {
        const cardTop = topOffset + index * offset

        gsap.set(card, {
          transformOrigin: "top center",
          zIndex: index,
          position: "sticky",
          top: `${cardTop}px`,
          marginBottom: index < cards.length - 1 ? `${gap}px` : "0px",
        })

        if (index < cards.length - 1) {
          gsap.timeline({
            scrollTrigger: {
              trigger: card,
              start: `top top+=${cardTop}`,
              endTrigger: this,
              end: "bottom bottom",
              scrub: true,
              scroller,
              invalidateOnRefresh: true,
            },
          }).to(card, {
            scale: 1 - (cards.length - 1 - index) * scaleFactor,
            ease: "none",
          })
        }
      })
    }, this)
  }

  override render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "motion-card-stack": MotionCardStack
  }
}
