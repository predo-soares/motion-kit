import { LitElement, html, css } from "lit"
import { customElement } from "lit/decorators.js"

/**
 * A single card inside <motion-card-stack>.
 * Apply visual styles (rounded corners, background, padding, etc.) directly
 * as classes or inline styles on this element — they apply to the host.
 *
 * @example
 * <motion-card-stack-item class="rounded-2xl bg-white p-8 shadow-sm min-h-[320px]">
 *   <h2>Card title</h2>
 * </motion-card-stack-item>
 */
@customElement("motion-card-stack-item")
export class MotionCardStackItem extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      will-change: transform;
    }
  `

  override render() {
    return html`<slot></slot>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "motion-card-stack-item": MotionCardStackItem
  }
}
