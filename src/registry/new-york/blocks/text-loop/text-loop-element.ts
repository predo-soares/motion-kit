import { LitElement, html, css } from "lit"
import { customElement, property } from "lit/decorators.js"
import { gsap } from "gsap"

/**
 * Cycles through an array of text strings with a blurred vertical slide transition.
 *
 * @example
 * <motion-text-loop
 *   texts='["Design","Develop","Deploy"]'
 *   interval="2500"
 * ></motion-text-loop>
 */
@customElement("motion-text-loop")
export class MotionTextLoop extends LitElement {
  static override styles = css`
    :host {
      font: inherit;
      color: inherit;
      position: relative;
      display: inline-block;
      clip-path: inset(-100vh 0 -100vh 0);
    }
    .container {
      position: relative;
      display: inline-block;
      overflow: visible;
    }
    .sizer {
      visibility: hidden;
      display: inline-block;
      width: 0;
    }
    .text-item {
      font: inherit;
      color: inherit;
      white-space: nowrap;
      display: inline-block;
    }
  `

  @property({ type: Array }) texts: string[] = []
  @property({ type: Number }) interval = 2000

  private _timer?: ReturnType<typeof setInterval>
  private _animating = false
  private _isFirst = true

  override connectedCallback() {
    super.connectedCallback()
    this._timer = setInterval(() => {
      if (!document.hidden && !this._animating) this._advance()
    }, this.interval)
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    clearInterval(this._timer)
    const span = this._span()
    if (span) gsap.killTweensOf(span)
    const container = this._container()
    if (container) gsap.killTweensOf(container)
  }

  override firstUpdated() {
    const container = this._container()
    const span = this._span()
    if (!container || !span) return

    span.textContent = this.texts[0] ?? ""
    container.style.width = `${span.offsetWidth}px`
  }

  private _span() {
    return this.renderRoot.querySelector<HTMLElement>(".text-item")
  }

  private _container() {
    return this.renderRoot.querySelector<HTMLElement>(".container")
  }

  replay() {
    const container = this._container()
    const span = this._span()
    if (!container || !span) return

    gsap.killTweensOf(span)
    gsap.killTweensOf(container)
    this._animating = false
    this._isFirst = true
    span.dataset.index = "0"
    span.textContent = this.texts[0] ?? ""
    container.style.width = `${span.offsetWidth}px`
    Object.assign(span.style, { position: "", top: "", left: "", width: "" })
    gsap.set(span, { clearProps: "yPercent,opacity,filter" })
  }

  private async _advance() {
    const container = this._container()
    const span = this._span()
    if (!container || !span || !this.texts.length) return

    this._animating = true

    container.style.width = `${container.offsetWidth}px`
    Object.assign(span.style, { position: "absolute", top: "0", left: "0", width: "100%" })

    await gsap.to(span, {
      yPercent: -50,
      opacity: 0,
      filter: "blur(6px)",
      duration: 0.2,
      ease: "power2.in",
    })

    const nextIndex = (Number(span.dataset.index ?? 0) + 1) % this.texts.length
    span.dataset.index = String(nextIndex)
    span.textContent = this.texts[nextIndex] ?? ""

    Object.assign(span.style, { position: "absolute", top: "0", left: "0", width: "auto" })
    gsap.set(span, { yPercent: 50, opacity: 0, filter: "blur(8px)" })

    const nextWidth = span.offsetWidth

    gsap.to(container, {
      width: nextWidth,
      duration: 0.35,
      ease: "power2.inOut",
    })

    await gsap.to(span, {
      yPercent: 0,
      opacity: 1,
      filter: "blur(0px)",
      duration: 0.3,
      delay: 0.25,
      ease: "back.out(1.2)",
    })

    if (this._isFirst) this._isFirst = false
    this._animating = false
  }

  override render() {
    return html`
      <span class="container">
        <span class="sizer" aria-hidden="true">&nbsp;</span>
        <span class="text-item" data-index="0"></span>
      </span>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "motion-text-loop": MotionTextLoop
  }
}
