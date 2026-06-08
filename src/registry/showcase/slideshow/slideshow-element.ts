import { LitElement, html, css } from "lit"
import { customElement, property, state } from "lit/decorators.js"
import { gsap } from "gsap"
import { CustomEase } from "gsap/dist/CustomEase"

gsap.registerPlugin(CustomEase)

const EASE = "motion-blocks-ease"
let _easeRegistered = false
function ensureEase() {
  if (!_easeRegistered) {
    CustomEase.create(EASE, "0.625, 0.05, 0, 1")
    _easeRegistered = true
  }
}

interface SlideImage {
  src: string
  alt?: string
}

/**
 * Horizontal parallax slideshow with thumbnail navigation. Each slide
 * transitions with a counterpart inner-image parallax effect.
 *
 * @example
 * <motion-slideshow
 *   images='[{"src":"/1.jpg","alt":"One"},{"src":"/2.jpg","alt":"Two"}]'
 *   class="aspect-video w-full max-w-2xl rounded-xl overflow-hidden"
 * ></motion-slideshow>
 */
@customElement("motion-slideshow")
export class MotionSlideshow extends LitElement {
  static override styles = css`
    :host {
      display: block;
      position: relative;
      overflow: hidden;
    }
    .slide {
      pointer-events: none;
      position: absolute;
      inset: 0;
      z-index: 0;
      overflow: hidden;
      will-change: transform;
    }
    .inner {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      will-change: transform;
      -webkit-user-drag: none;
      user-select: none;
      pointer-events: none;
    }
    .thumbs {
      position: absolute;
      bottom: 1rem;
      left: 50%;
      transform: translateX(-50%);
      z-index: 50;
      display: flex;
      gap: 0.5rem;
    }
    .thumb {
      position: relative;
      width: 2.5rem;
      height: 2.5rem;
      overflow: hidden;
      border-radius: 0.25rem;
      border: none;
      padding: 0;
      cursor: pointer;
      transition: transform 0.7s cubic-bezier(0.625, 0.05, 0, 1),
        opacity 0.3s ease;
      opacity: 0.6;
    }
    .thumb:hover,
    .thumb.active {
      opacity: 1;
      transform: scale(1.1);
    }
    .thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      pointer-events: none;
    }
  `

  /** JSON array: `[{"src":"...","alt":"..."}]` */
  @property({ type: String }) images = "[]"

  @state() private _currentIndex = 0

  private _isAnimating = false
  private _ctx?: gsap.Context

  override connectedCallback() {
    super.connectedCallback()
    ensureEase()
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._ctx?.revert()
  }

  override firstUpdated() {
    this._ctx = gsap.context(() => {}, this.shadowRoot as unknown as Element)
    const slides = this._getSlides()
    if (slides[0]) gsap.set(slides[0], { zIndex: 10 })
  }

  replay() {
    this._ctx?.revert()
    this._isAnimating = false
    this._currentIndex = 0
    requestAnimationFrame(() => {
      this._ctx = gsap.context(() => {}, this.shadowRoot as unknown as Element)
      const slides = this._getSlides()
      slides.forEach((s, i) => gsap.set(s, { zIndex: i === 0 ? 10 : 0, xPercent: 0 }))
      const inners = this._getInners()
      inners.forEach((inner) => gsap.set(inner, { xPercent: 0 }))
    })
  }

  navigate(targetIndex: number) {
    const images: SlideImage[] = JSON.parse(this.images)
    if (
      this._isAnimating ||
      targetIndex === this._currentIndex ||
      targetIndex < 0 ||
      targetIndex >= images.length
    )
      return

    this._isAnimating = true
    const direction = targetIndex > this._currentIndex ? 1 : -1
    const prevIndex = this._currentIndex
    this._currentIndex = targetIndex

    const slides = this._getSlides()
    const inners = this._getInners()
    const prevSlide = slides[prevIndex]
    const prevInner = inners[prevIndex]
    const nextSlide = slides[this._currentIndex]
    const nextInner = inners[this._currentIndex]

    if (!prevSlide || !nextSlide) {
      this._isAnimating = false
      return
    }

    gsap.set(nextSlide, { zIndex: 20 })
    gsap.set(prevSlide, { zIndex: 10 })

    const tl = gsap.timeline({
      defaults: { duration: 1.5, ease: EASE },
      onComplete: () => {
        this._isAnimating = false
        gsap.set(prevSlide, { zIndex: 0, xPercent: 0 })
        if (prevInner) gsap.set(prevInner, { xPercent: 0 })
        gsap.set(nextSlide, { zIndex: 10 })
      },
    })

    tl.to(prevSlide, { xPercent: -direction * 100 }, 0)
    if (prevInner) tl.to(prevInner, { xPercent: direction * 75 }, 0)
    tl.fromTo(nextSlide, { xPercent: direction * 100 }, { xPercent: 0 }, 0)
    if (nextInner) tl.fromTo(nextInner, { xPercent: -direction * 75 }, { xPercent: 0 }, 0)
  }

  private _getSlides() {
    return Array.from(this.shadowRoot!.querySelectorAll<HTMLElement>(".slide"))
  }

  private _getInners() {
    return Array.from(this.shadowRoot!.querySelectorAll<HTMLElement>(".inner"))
  }

  override render() {
    const images: SlideImage[] = JSON.parse(this.images)
    return html`
      ${images.map(
        (img, i) => html`
          <div class="slide">
            <img
              class="inner"
              src="${img.src}"
              alt="${img.alt ?? ""}"
              draggable="false"
            />
          </div>
        `,
      )}
      <div class="thumbs">
        ${images.map(
          (img, i) => html`
            <button
              class="thumb ${i === this._currentIndex ? "active" : ""}"
              aria-label="Go to slide ${i + 1}"
              @click="${() => this.navigate(i)}"
            >
              <img src="${img.src}" alt="${img.alt ?? ""}" draggable="false" />
            </button>
          `,
        )}
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "motion-slideshow": MotionSlideshow
  }
}
