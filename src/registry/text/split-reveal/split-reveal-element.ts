import { LitElement, html, css } from "lit"
import { customElement, property } from "lit/decorators.js"
import { gsap } from "gsap"
import { SplitText } from "gsap/SplitText"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(SplitText, ScrollTrigger)

type SplitMode = "lines" | "words" | "chars"

const DEFAULT_CONFIG: Record<SplitMode, { duration: number; stagger: number }> = {
  lines: { duration: 0.8, stagger: 0.08 },
  words: { duration: 0.6, stagger: 0.06 },
  chars: { duration: 0.4, stagger: 0.008 },
}

/**
 * Masks text and reveals lines, words, or characters on mount or scroll.
 *
 * @example
 * <motion-split-reveal text="Hello World" mode="lines"></motion-split-reveal>
 *
 * <!-- Scroll-triggered -->
 * <motion-split-reveal
 *   text="Revealed on scroll"
 *   trigger-on-scroll
 *   scroll-element="#my-scroller"
 * ></motion-split-reveal>
 */
@customElement("motion-split-reveal")
export class MotionSplitReveal extends LitElement {
  static override styles = css`
    :host {
      font: inherit;
      color: inherit;
      display: inline;
      position: relative;
      align-baseline: baseline;
    }
    .content {
      font: inherit;
      color: inherit;
      display: inline;
      position: relative;
      align-baseline: baseline;
    }
  `

  @property() text = ""
  @property() mode: SplitMode = "lines"
  @property({ type: Number }) delay = 0
  @property({ type: Boolean, attribute: "trigger-on-scroll" }) triggerOnScroll = false
  @property({ attribute: "scroll-element" }) scrollElement = ""
  @property({ type: Number }) duration = 0
  @property({ type: Number }) stagger = 0

  private _split?: SplitText
  private _ctx?: gsap.Context
  private _cancelled = false

  replay() {
    void this._init()
  }

  override firstUpdated() {
    void this._init()
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has("text") || changed.has("mode")) void this._init()
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._cleanup()
  }

  private _getContent() {
    return this.renderRoot.querySelector<HTMLElement>(".content")
  }

  private _cleanup() {
    this._cancelled = true
    this._ctx?.revert()
    this._split?.revert()
    this._split = undefined
    this._ctx = undefined
  }

  private _resolveScroller(): Element | Window {
    if (!this.scrollElement) return window
    return document.querySelector<HTMLElement>(this.scrollElement) ?? window
  }

  private async _init() {
    this._cleanup()
    this._cancelled = false

    const content = this._getContent()
    if (!content) return

    await document.fonts.ready
    if (this._cancelled) return

    const cfg = DEFAULT_CONFIG[this.mode]
    const dur = this.duration || cfg.duration
    const stag = this.stagger || cfg.stagger
    const scroller = this._resolveScroller()

    this._ctx = gsap.context(() => {
      this._split = SplitText.create(content, {
        type: "lines, words, chars",
        mask: "lines",
      })

      const targets: HTMLElement[] =
        this.mode === "lines"
          ? (this._split.lines ?? []) as HTMLElement[]
          : this.mode === "words"
            ? (this._split.words ?? []) as HTMLElement[]
            : (this._split.chars ?? []) as HTMLElement[]

      if (!targets.length) return

      gsap.set(targets, { yPercent: 110 })

      gsap.to(targets, {
        yPercent: 0,
        duration: dur,
        stagger: stag,
        ease: "power3.out",
        delay: this.triggerOnScroll ? 0 : this.delay,
        scrollTrigger: this.triggerOnScroll
          ? {
              trigger: this,
              scroller,
              start: "top 85%",
            }
          : undefined,
      })
    }, content)
  }

  override render() {
    return html`<span class="content">${this.text}</span>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "motion-split-reveal": MotionSplitReveal
  }
}
