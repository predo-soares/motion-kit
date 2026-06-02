const GRADIENT_ANGLES = {
  top: 0,
  right: 90,
  bottom: 180,
  left: 270,
} as const

type ProgressiveBlurDirection = keyof typeof GRADIENT_ANGLES

const BLUR_STEPS = [1, 2, 4, 8, 16, 32, 64] as const

const MASK_PRESETS = [
  [
    [0, 0],
    [1, 10],
    [1, 30],
    [0, 40],
  ],
  [
    [0, 10],
    [1, 20],
    [1, 40],
    [0, 50],
  ],
  [
    [0, 15],
    [1, 30],
    [1, 50],
    [0, 60],
  ],
  [
    [0, 20],
    [1, 40],
    [1, 60],
    [0, 70],
  ],
  [
    [0, 40],
    [1, 60],
    [1, 80],
    [0, 90],
  ],
  [
    [0, 60],
    [1, 80],
  ],
  [
    [0, 70],
    [1, 100],
  ],
] as const

/**
 * Native custom element that stacks masked backdrop-blur layers to create
 * a directional progressive blur.
 *
 * @example
 * <motion-progressive-blur
 *   direction="bottom"
 *   blur-layers="8"
 *   blur-intensity="0.25"
 * ></motion-progressive-blur>
 */
export class MotionProgressiveBlur extends HTMLElement {
  static observedAttributes = [
    "direction",
    "blur-layers",
    "blur-intensity",
    "fade-color",
  ]

  get direction(): ProgressiveBlurDirection {
    const direction = this.getAttribute("direction")
    return direction in GRADIENT_ANGLES
      ? (direction as ProgressiveBlurDirection)
      : "bottom"
  }

  get blurLayers() {
    return Math.min(
      Math.max(Number(this.getAttribute("blur-layers") ?? BLUR_STEPS.length), 2),
      BLUR_STEPS.length,
    )
  }

  get blurIntensity() {
    return Number(this.getAttribute("blur-intensity") ?? 1)
  }

  get fadeColor() {
    return this.getAttribute("fade-color")
  }

  connectedCallback() {
    if (!this.style.display && getComputedStyle(this).display === "inline") {
      this.style.display = "block"
    }

    if (!this.style.position && getComputedStyle(this).position === "static") {
      this.style.position = "relative"
    }

    this._renderLayers()
  }

  attributeChangedCallback() {
    if (this.isConnected) {
      this._renderLayers()
    }
  }

  replay() {
    this._renderLayers()
  }

  private _renderLayers() {
    const angle = GRADIENT_ANGLES[this.direction]
    const fragment = document.createDocumentFragment()
    this.replaceChildren()

    for (let index = 0; index < this.blurLayers; index += 1) {
      const layer = document.createElement("div")
      const stops = MASK_PRESETS[index]
        .map(
          ([alpha, position]) =>
            `rgba(0, 0, 0, ${alpha}) ${position}%`,
        )
        .join(", ")
      const gradient = `linear-gradient(${angle}deg, ${stops})`

      layer.ariaHidden = "true"
      Object.assign(layer.style, {
        position: "absolute",
        inset: "0",
        borderRadius: "inherit",
        pointerEvents: "none",
        backgroundColor: "transparent",
      })
      layer.style.maskImage = gradient
      layer.style.webkitMaskImage = gradient
      layer.style.backdropFilter = `blur(${BLUR_STEPS[index] * this.blurIntensity}px)`
      layer.style.webkitBackdropFilter = `blur(${BLUR_STEPS[index] * this.blurIntensity}px)`
      fragment.append(layer)
    }

    if (this.fadeColor) {
      const gradientLayer = document.createElement("div")
      const gradientDirection = `to ${this.direction}`

      gradientLayer.ariaHidden = "true"
      Object.assign(gradientLayer.style, {
        position: "absolute",
        inset: "0",
        borderRadius: "inherit",
        pointerEvents: "none",
        background: `linear-gradient(${gradientDirection}, transparent, ${this.fadeColor})`,
      })

      fragment.append(gradientLayer)
    }

    this.append(fragment)
  }
}

if (!customElements.get("motion-progressive-blur")) {
  customElements.define("motion-progressive-blur", MotionProgressiveBlur)
}

declare global {
  interface HTMLElementTagNameMap {
    "motion-progressive-blur": MotionProgressiveBlur
  }
}
