class MotionFlipGridItem extends HTMLElement {
  static observedAttributes = ["flip-id", "id"]

  connectedCallback() {
    this.classList.add("flip-grid-item")
    this.style.display ||= "block"
    this._syncId()
  }

  attributeChangedCallback() {
    this._syncId()
  }

  replay() {}

  private _syncId() {
    const id = this.getAttribute("flip-id") ?? this.getAttribute("id")
    if (id) {
      this.dataset.flipId = id
    } else {
      delete this.dataset.flipId
    }
  }
}

customElements.define("motion-flip-grid-item", MotionFlipGridItem)

declare global {
  interface HTMLElementTagNameMap {
    "motion-flip-grid-item": MotionFlipGridItem
  }
}
