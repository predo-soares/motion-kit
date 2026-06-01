import { LitElement, html, css } from "lit"
import { customElement, property } from "lit/decorators.js"
import { gsap } from "gsap"
import { SplitText } from "gsap/SplitText"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(SplitText, ScrollTrigger)

const OFFSCREEN_MARGIN_PX = 8

/**
 * Splits text into lines/words and slides each line's words in from the right on scroll.
 *
 * @example
 * <motion-stacking-words
 *   text="Every word arrives on its own."
 *   start="top 90%"
 *   end="top 30%"
 * ></motion-stacking-words>
 *
 * <!-- Inside a custom scroller -->
 * <motion-stacking-words
 *   text="Revealed inside a scrollable div"
 *   scroll-element="#my-scroller"
 * ></motion-stacking-words>
 */
@customElement("motion-stacking-words")
export class MotionStackingWords extends LitElement {
  static override styles = css`
    :host {
      display: block;
      font: inherit;
      color: inherit;
      visibility: hidden;
    }
    .content {
      display: block;
      font: inherit;
      color: inherit;
    }
    .content :is(.stacking-words-line, .stacking-words-line-mask) {
      display: block;
    }
    .content .stacking-words-word {
      display: inline-block;
      will-change: transform;
    }
  `

  @property() text = ""
  @property() start = "top 90%"
  @property() end = "top 30%"
  @property({ type: Number }) scrub = 1.234
  @property({ type: Number }) stagger = 0.21
  @property() ease = "power3.out"
  @property({ attribute: "scroll-element" }) scrollElement = ""

  private _split?: SplitText
  private _lineTweens: gsap.core.Tween[] = []
  private _ctx?: gsap.Context
  private _cancelled = false

  replay() {
    const scroller = this._resolveScroller()
    if (scroller instanceof HTMLElement) {
      scroller.scrollTop = 0
    } else {
      window.scrollTo(0, 0)
    }
    void this._init()
  }

  override firstUpdated() {
    void this._init()
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has("text")) void this._init()
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._cleanup()
  }

  private _getContent() {
    return this.renderRoot.querySelector<HTMLElement>(".content")
  }

  private _resolveScroller(): Element | Window {
    if (!this.scrollElement) return window
    return document.querySelector<HTMLElement>(this.scrollElement) ?? window
  }

  private _killLineTweens() {
    this._lineTweens.forEach((t) => t.kill())
    this._lineTweens = []
  }

  private _cleanup() {
    this._cancelled = true
    this._killLineTweens()
    this._ctx?.revert()
    this._split?.revert()
    this._split = undefined
    this._ctx = undefined
  }

  private async _init() {
    this._cleanup()
    this._cancelled = false

    const content = this._getContent()
    if (!content) return

    await document.fonts.ready
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    if (this._cancelled) return

    const scroller = this._resolveScroller()
    const { start, end, scrub, stagger, ease } = this

    this._ctx = gsap.context(() => {
      this._split = SplitText.create(content, {
        aria: "hidden",
        autoSplit: true,
        linesClass: "stacking-words-line",
        wordsClass: "stacking-words-word",
        tag: "span",
        type: "lines, words",
        onSplit: (self) => {
          this._killLineTweens()

          const words = (self.words ?? []) as HTMLElement[]
          words.forEach((word) => {
            const rect = word.getBoundingClientRect()
            gsap.set(word, {
              x: window.innerWidth - rect.left + rect.width + OFFSCREEN_MARGIN_PX,
            })
          })

          ;(self.lines ?? []).forEach((line) => {
            const tween = gsap.to(
              (line as HTMLElement).querySelectorAll(".stacking-words-word"),
              {
                ease,
                stagger,
                x: 0,
                scrollTrigger: {
                  trigger: line as HTMLElement,
                  start,
                  end,
                  scrub,
                  scroller,
                  invalidateOnRefresh: true,
                },
              },
            )
            this._lineTweens.push(tween)
          })

          ScrollTrigger.refresh()
          gsap.set(this, { autoAlpha: 1 })
        },
      })
    }, content)
  }

  override render() {
    return html`<span class="content">${this.text}</span>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "motion-stacking-words": MotionStackingWords
  }
}
