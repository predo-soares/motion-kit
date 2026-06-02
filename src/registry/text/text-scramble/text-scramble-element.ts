import { LitElement, html, css } from "lit"
import { customElement, property } from "lit/decorators.js"
import { gsap } from "gsap"
import { SplitText } from "gsap/SplitText"

gsap.registerPlugin(SplitText)

/**
 * Scrambles characters on hover before settling back to the original text.
 *
 * @example
 * <motion-text-scramble text="Hello World"></motion-text-scramble>
 *
 * <!-- External trigger (CSS selector resolved from document) -->
 * <button id="trigger">Hover</button>
 * <motion-text-scramble text="SCRAMBLE" hover-target="#trigger"></motion-text-scramble>
 */
@customElement("motion-text-scramble")
export class MotionTextScramble extends LitElement {
  static override styles = css`
    :host {
      font: inherit;
      color: inherit;
      display: inline-block;
    }
    .content {
      font: inherit;
      color: inherit;
      display: inline-block;
    }
  `

  @property() text = ""
  /** CSS selector for an external element that triggers the effect. Defaults to this element. */
  @property({ attribute: "hover-target" }) hoverTarget = ""
  @property({ type: Number, attribute: "scramble-duration" }) scrambleDuration = 0.6
  @property({ type: Number }) stagger = 0.03
  @property({ type: Number }) cycles = 12
  @property() characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"

  private _split?: SplitText
  private _timeline?: gsap.core.Timeline
  private _ctx?: gsap.Context
  private _target?: HTMLElement

  override firstUpdated() {
    this._setup()
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has("text")) this._setup()
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._cleanup()
  }

  private _getContent() {
    return this.renderRoot.querySelector<HTMLElement>(".content")
  }

  private _resolveTarget(): HTMLElement {
    if (this.hoverTarget) {
      return document.querySelector<HTMLElement>(this.hoverTarget) ?? this
    }
    return this
  }

  private _cleanup() {
    this._target?.removeEventListener("mouseenter", this._onEnter)
    this._target?.removeEventListener("mouseleave", this._onLeave)
    this._timeline?.kill()
    this._ctx?.revert()
    this._split?.revert()
    this._split = undefined
    this._timeline = undefined
    this._ctx = undefined
  }

  private _getRandomChar() {
    const pool = this.characters || "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    return pool[Math.floor(Math.random() * pool.length)] ?? ""
  }

  private _buildTimeline(chars: HTMLElement[]): gsap.core.Timeline | undefined {
    if (!chars.length) return undefined

    const tl = gsap.timeline({ paused: true })
    const stepCount = Math.max(1, Math.floor(this.cycles))
    const stepDuration = Math.max(0.1, this.scrambleDuration) / stepCount

    chars.forEach((node, i) => {
      const finalChar = node.dataset.originalChar ?? node.textContent ?? ""
      const charTl = gsap.timeline()

      if (!finalChar.trim()) {
        charTl.call(() => { node.textContent = finalChar })
      } else {
        for (let s = 0; s < stepCount; s++) {
          charTl.call(() => { node.textContent = this._getRandomChar() })
          charTl.to({}, { duration: stepDuration })
        }
        charTl.call(() => { node.textContent = finalChar })
      }

      tl.add(charTl, i * this.stagger)
    })

    return tl
  }

  replay() {
    this._timeline?.restart()
  }

  private _onEnter = () => {
    if (!this._timeline) {
      const content = this._getContent()
      if (!content) return
      const chars = (this._split?.chars ?? []) as HTMLElement[]
      this._timeline = this._buildTimeline(chars)
    }
    this._timeline?.restart()
  }

  private _onLeave = () => {
    this._timeline?.progress(1)
  }

  private _setup() {
    this._cleanup()
    const content = this._getContent()
    if (!content) return

    this._ctx = gsap.context(() => {
      this._split = SplitText.create(content, {
        type: "chars",
        reduceWhiteSpace: false,
        charsClass: "inline-block",
      })

      const chars = (this._split.chars ?? []) as HTMLElement[]
      chars.forEach((node) => {
        node.style.display = "inline-block"
        node.dataset.originalChar = node.textContent ?? ""
        if (!node.textContent?.trim()) {
          node.style.whiteSpace = "pre"
          node.style.pointerEvents = "none"
        }
      })

      this._timeline = this._buildTimeline(chars)
    }, content)

    this._target = this._resolveTarget()
    this._target.addEventListener("mouseenter", this._onEnter)
    this._target.addEventListener("mouseleave", this._onLeave)
  }

  override render() {
    return html`<span class="content">${this.text}</span>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "motion-text-scramble": MotionTextScramble
  }
}
