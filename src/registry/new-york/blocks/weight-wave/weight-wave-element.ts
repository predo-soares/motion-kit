import { LitElement, html, css } from "lit"
import { customElement, property } from "lit/decorators.js"
import { gsap } from "gsap"
import { SplitText } from "gsap/SplitText"
import { registerPluginOnce } from "../../../../lib/helpers/gsap"

/**
 * Hover-reactive text effect that smoothly increases font weight with a
 * falloff across neighboring characters.
 *
 * Requires a variable font that supports the `wght` axis.
 *
 * @example
 * <motion-weight-wave text="Hover me"></motion-weight-wave>
 */
@customElement("motion-weight-wave")
export class MotionWeightWave extends LitElement {
  static override styles = css`
    :host {
      font: inherit;
      color: inherit;
      display: inline-block;
      vertical-align: baseline;
    }
  `

  @property() text = ""
  @property({ type: Number, attribute: "base-weight" }) baseWeight = 350
  @property({ type: Number, attribute: "hover-weight" }) hoverWeight = 750
  @property({ type: Number, attribute: "influence-radius" }) influenceRadius = 3
  @property({ type: Number, attribute: "falloff-power" }) falloffPower = 1.5
  @property({ type: Number }) duration = 1.0
  @property() ease = "power3.out"

  private _split?: SplitText
  private _ctx?: gsap.Context
  private _chars: HTMLElement[] = []
  private _charPositions: { x: number; width: number }[] = []

  override connectedCallback() {
    super.connectedCallback()
    registerPluginOnce(SplitText)
    this.addEventListener("pointermove", this._onPointerMove)
    this.addEventListener("pointerleave", this._onPointerLeave)
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this.removeEventListener("pointermove", this._onPointerMove)
    this.removeEventListener("pointerleave", this._onPointerLeave)
    this._cleanup()
  }

  override firstUpdated() {
    this._init()
  }

  override updated(changed: Map<string, unknown>) {
    const reinitKeys = ["text", "baseWeight", "hoverWeight", "influenceRadius", "falloffPower"]
    if (reinitKeys.some((k) => changed.has(k))) this._init()
  }

  replay() {
    this._init()
  }

  private _cleanup() {
    this._ctx?.revert()
    this._split?.revert()
    this._ctx = undefined
    this._split = undefined
    this._chars = []
    this._charPositions = []
  }

  private _init() {
    this._cleanup()

    const content = this.renderRoot.querySelector<HTMLElement>(".content")
    if (!content) return

    this._ctx = gsap.context(() => {
      this._split = SplitText.create(content, {
        type: "chars",
        reduceWhiteSpace: false,
      })

      this._chars = (this._split.chars ?? []) as HTMLElement[]

      this._chars.forEach((char) => {
        char.style.fontWeight = String(this.baseWeight)
        char.style.fontVariationSettings = `"wght" ${this.baseWeight}`
        char.style.display = "inline-block"

        if (!char.textContent?.trim()) {
          char.style.whiteSpace = "pre"
          char.style.pointerEvents = "none"
          char.style.minWidth = "0.25em"
        }
      })
    }, content)

    requestAnimationFrame(() => {
      this._charPositions = this._chars.map((char) => {
        const rect = char.getBoundingClientRect()
        return { x: rect.left + rect.width / 2, width: rect.width }
      })
    })
  }

  private _calculateWeight(distance: number) {
    if (this.influenceRadius <= 0) return this.baseWeight
    if (distance > this.influenceRadius + 1) return this.baseWeight
    const normalized = Math.max(0, 1 - distance / (this.influenceRadius + 1))
    const shaped = Math.pow(normalized, this.falloffPower)
    return this.baseWeight + (this.hoverWeight - this.baseWeight) * shaped
  }

  private _applyWeight(char: HTMLElement, weight: number) {
    gsap.to(char, {
      fontWeight: weight,
      fontVariationSettings: `"wght" ${weight}`,
      duration: this.duration,
      ease: this.ease,
      overwrite: "auto",
    })
  }

  private _onPointerMove = (e: PointerEvent) => {
    if (!this._chars.length || !this._charPositions.length) return
    const mouseX = e.clientX

    this._chars.forEach((char, i) => {
      const pos = this._charPositions[i]
      if (!pos) return
      const distance = Math.abs(mouseX - pos.x) / pos.width
      this._applyWeight(char, this._calculateWeight(distance))
    })
  }

  private _onPointerLeave = () => {
    this._chars.forEach((char) => this._applyWeight(char, this.baseWeight))
  }

  override render() {
    return html`<span class="content">${this.text}</span>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "motion-weight-wave": MotionWeightWave
  }
}
