import { LitElement, html, css } from "lit"
import { customElement, property } from "lit/decorators.js"
import { gsap } from "gsap"
import { SplitText } from "gsap/SplitText"
import { registerPluginOnce, ensureMotionCoreEase } from "@/lib/helpers/gsap"

/**
 * Splits text into characters and animates stacked layers on hover for a seamless swap.
 *
 * @example
 * <motion-split-hover text="Hover me"></motion-split-hover>
 */
@customElement("motion-split-hover")
export class MotionSplitHover extends LitElement {
  static override styles = css`
    :host {
      font: inherit;
      color: inherit;
      position: relative;
      display: inline-flex;
      overflow: hidden;
      vertical-align: baseline;
      line-height: 1;
    }
    .clone {
      pointer-events: none;
      position: absolute;
      inset: 0;
    }
  `

  @property() text = ""

  private _originalSplit?: SplitText
  private _cloneSplit?: SplitText
  private _timeline?: gsap.core.Timeline
  private _ctx?: gsap.Context

  override connectedCallback() {
    super.connectedCallback()
    registerPluginOnce(SplitText)
    ensureMotionCoreEase()
    this.addEventListener("mouseenter", this._onEnter)
    this.addEventListener("mouseleave", this._onLeave)
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this.removeEventListener("mouseenter", this._onEnter)
    this.removeEventListener("mouseleave", this._onLeave)
    this._cleanup()
  }

  override firstUpdated() {
    this._init()
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has("text")) this._init()
  }

  replay() {
    this._init()
  }

  private _cleanup() {
    this._timeline?.kill()
    this._ctx?.revert()
    this._originalSplit?.revert()
    this._cloneSplit?.revert()
    this._timeline = undefined
    this._ctx = undefined
    this._originalSplit = undefined
    this._cloneSplit = undefined
  }

  private _init() {
    this._cleanup()

    const original = this.renderRoot.querySelector<HTMLElement>(".original")
    const clone = this.renderRoot.querySelector<HTMLElement>(".clone")
    if (!original || !clone) return

    this._ctx = gsap.context(() => {
      this._originalSplit = SplitText.create(original, {
        type: "chars",
        charsClass: "inline-block",
        onSplit: (self) => {
          if (this._cloneSplit) {
            this._cloneSplit.revert()
            this._cloneSplit = undefined
          }

          this._cloneSplit = SplitText.create(clone, {
            type: "chars",
            charsClass: "inline-block",
          })

          gsap.set(self.chars, { yPercent: 0 })
          gsap.set(this._cloneSplit.chars, { yPercent: 100 })

          this._timeline?.kill()
          this._timeline = gsap
            .timeline({ paused: true })
            .to(
              self.chars,
              { yPercent: -100, stagger: 0.02, duration: 0.35, ease: "motion-kit-ease" },
              0,
            )
            .to(
              this._cloneSplit.chars,
              { yPercent: 0, stagger: 0.02, duration: 0.35, ease: "motion-kit-ease" },
              0,
            )
        },
      })
    }, original)
  }

  private _onEnter = () => this._timeline?.play()
  private _onLeave = () => this._timeline?.reverse()

  override render() {
    return html`
      <span class="original">${this.text}</span>
      <span class="clone" aria-hidden="true">${this.text}</span>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "motion-split-hover": MotionSplitHover
  }
}
