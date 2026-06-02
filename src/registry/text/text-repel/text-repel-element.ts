import { LitElement, html, css } from "lit"
import { customElement, property } from "lit/decorators.js"
import { gsap } from "gsap"
import { SplitText } from "gsap/SplitText"

gsap.registerPlugin(SplitText)

type RepelItem = {
  node: HTMLElement
  centerX: number
  centerY: number
  xTo: gsap.QuickToFunc
  yTo: gsap.QuickToFunc
}

/**
 * Splits text into words or characters and repels them from the pointer.
 *
 * @example
 * <motion-text-repel text="Hover over me" mode="words"></motion-text-repel>
 */
@customElement("motion-text-repel")
export class MotionTextRepel extends LitElement {
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
  @property() mode: "words" | "chars" = "words"
  @property({ type: Number }) strength = 18
  @property({ type: Number }) radius = 160
  @property({ type: Number, attribute: "falloff-power" }) falloffPower = 1.5
  @property({ type: Number }) duration = 0.45
  @property() ease = "power3.out"
  /** CSS selector for an external hover target. Defaults to this element. */
  @property({ attribute: "hover-target" }) hoverTarget = ""

  private _split?: SplitText
  private _items: RepelItem[] = []
  private _ctx?: gsap.Context
  private _resizeObserver?: ResizeObserver
  private _target?: HTMLElement
  private _cancelled = false

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

  private _resolveTarget(): HTMLElement {
    if (this.hoverTarget) {
      return document.querySelector<HTMLElement>(this.hoverTarget) ?? this
    }
    return this
  }

  private _cleanup() {
    this._cancelled = true
    this._target?.removeEventListener("pointermove", this._onPointerMove)
    this._target?.removeEventListener("pointerenter", this._measure)
    this._target?.removeEventListener("pointerleave", this._reset)
    window.removeEventListener("scroll", this._measure, true)
    window.removeEventListener("resize", this._measure)
    this._resizeObserver?.disconnect()
    this._ctx?.revert()
    this._split?.revert()
    this._split = undefined
    this._items = []
    this._ctx = undefined
  }

  replay() {
    this._reset()
  }

  private _measure = () => {
    this._items = this._items.map((item) => {
      const rect = item.node.getBoundingClientRect()
      return { ...item, centerX: rect.left + rect.width / 2, centerY: rect.top + rect.height / 2 }
    })
  }

  private _reset = () => {
    this._items.forEach(({ xTo, yTo }) => { xTo(0); yTo(0) })
  }

  private _onPointerMove = (e: PointerEvent) => {
    if (!this._items.length) return
    this._measure()
    this._items.forEach(({ centerX, centerY, xTo, yTo }) => {
      const dx = centerX - e.clientX
      const dy = centerY - e.clientY
      const dist = Math.hypot(dx, dy)

      if (dist <= 0 || dist > this.radius) { xTo(0); yTo(0); return }

      const influence = Math.pow(Math.max(0, 1 - dist / this.radius), this.falloffPower)
      const d = this.strength * influence
      xTo((dx / dist) * d)
      yTo((dy / dist) * d)
    })
  }

  private async _init() {
    this._cleanup()
    this._cancelled = false

    const content = this._getContent()
    if (!content) return

    // Wait for fonts + two rAFs so layout is stable
    await document.fonts.ready
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    if (this._cancelled) return

    this._ctx = gsap.context(() => {
      this._split = SplitText.create(content, {
        type: "words, chars",
        reduceWhiteSpace: false,
        wordsClass: "repel-word",
        charsClass: "repel-char",
      })

      const targets = (
        this.mode === "words"
          ? (this._split?.words ?? [])
          : (this._split?.chars ?? [])
      ) as HTMLElement[]

      targets.forEach((node) => {
        node.style.display = "inline-block"
        node.style.willChange = "transform"
        if (!node.textContent?.trim()) {
          node.style.whiteSpace = "pre"
          node.style.pointerEvents = "none"
        }
      })

      this._items = targets.map((node) => {
        const rect = node.getBoundingClientRect()
        return {
          node,
          centerX: rect.left + rect.width / 2,
          centerY: rect.top + rect.height / 2,
          xTo: gsap.quickTo(node, "x", { duration: this.duration, ease: this.ease }),
          yTo: gsap.quickTo(node, "y", { duration: this.duration, ease: this.ease }),
        }
      })
    }, content)

    this._resizeObserver = new ResizeObserver(this._measure)
    this._resizeObserver.observe(content)

    this._target = this._resolveTarget()
    this._target.addEventListener("pointermove", this._onPointerMove)
    this._target.addEventListener("pointerenter", this._measure)
    this._target.addEventListener("pointerleave", this._reset)
    window.addEventListener("scroll", this._measure, true)
    window.addEventListener("resize", this._measure)
  }

  override render() {
    return html`<span class="content">${this.text}</span>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "motion-text-repel": MotionTextRepel
  }
}
