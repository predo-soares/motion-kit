import { LitElement, html, css } from "lit"
import { customElement, property } from "lit/decorators.js"
import { gsap } from "gsap"

interface LogoItem {
  src: string
  alt?: string
  name?: string
}

/**
 * Cycling logo carousel distributed across columns. Logos blur and slide
 * between items at a configurable interval, with a staggered offset per column.
 *
 * @example
 * <motion-logo-carousel
 *   logos='[{"src":"/logos/a.svg","alt":"A"},{"src":"/logos/b.svg","alt":"B"}]'
 *   columns="3"
 *   cycle-interval="2000"
 * ></motion-logo-carousel>
 */
@customElement("motion-logo-carousel")
export class MotionLogoCarousel extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      gap: 1rem;
    }
    .col {
      position: relative;
      width: 6rem;
      height: 3.5rem;
      overflow: hidden;
    }
    @media (min-width: 768px) {
      .col {
        width: 12rem;
        height: 6rem;
      }
    }
    .slot {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .slot img {
      max-height: 70%;
      max-width: 70%;
      height: auto;
      width: auto;
      object-fit: contain;
      display: block;
    }
  `

  /** JSON array of logo objects: `[{"src":"...","alt":"...","name":"..."}]` */
  @property({ type: String }) logos = "[]"

  /** Number of columns to distribute logos into. */
  @property({ type: Number }) columns = 2

  /** Milliseconds between logo cycles. */
  @property({ type: Number, attribute: "cycle-interval" }) cycleInterval = 2000

  private _colData: { logos: LogoItem[]; idx: number }[] = []
  private _colEls: HTMLDivElement[] = []
  private _timers: ReturnType<typeof setTimeout>[] = []

  override render() {
    return html`
      ${Array.from({ length: this.columns }, (_, i) => html`
        <div class="col" data-col="${i}"></div>
      `)}
    `
  }

  override firstUpdated() {
    this._build()
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this._timers.forEach(clearTimeout)
    this._timers = []
  }

  replay() {
    this._timers.forEach(clearTimeout)
    this._timers = []
    this._build()
  }

  private _build() {
    const all: LogoItem[] = JSON.parse(this.logos)
    if (!all.length) return

    const shuffled = [...all].sort(() => Math.random() - 0.5)
    const cols = Math.max(1, this.columns)
    const distributed: LogoItem[][] = Array.from({ length: cols }, () => [])
    shuffled.forEach((logo, i) => distributed[i % cols].push(logo))
    const maxLen = Math.max(...distributed.map((c) => c.length))
    distributed.forEach((col) => {
      while (col.length < maxLen) {
        col.push(shuffled[Math.floor(Math.random() * shuffled.length)])
      }
    })

    this._colData = distributed.map((logos) => ({ logos, idx: 0 }))
    this._colEls = Array.from(
      this.shadowRoot!.querySelectorAll<HTMLDivElement>(".col"),
    )

    this._colEls.forEach((colEl, i) => {
      const col = this._colData[i]
      if (!col?.logos[0]) return

      const slot = document.createElement("div")
      slot.className = "slot"
      const img = document.createElement("img")
      img.src = col.logos[0].src
      img.alt = col.logos[0].alt ?? ""
      img.draggable = false
      slot.appendChild(img)
      colEl.innerHTML = ""
      colEl.appendChild(slot)

      this._timers[i] = setTimeout(
        () => this._cycle(i),
        this.cycleInterval + i * 200,
      )
    })
  }

  private _cycle(colIdx: number) {
    const col = this._colData[colIdx]
    const colEl = this._colEls[colIdx]
    if (!col || !colEl) return

    const img = colEl.querySelector<HTMLImageElement>("img")
    if (!img) return

    gsap.to(img, {
      yPercent: -20,
      opacity: 0,
      filter: "blur(6px)",
      duration: 0.3,
      ease: "power2.in",
      onComplete: () => {
        col.idx = (col.idx + 1) % col.logos.length
        const next = col.logos[col.idx]
        img.src = next.src
        img.alt = next.alt ?? ""
        gsap.fromTo(
          img,
          { yPercent: 10, opacity: 0, filter: "blur(8px)" },
          {
            yPercent: 0,
            opacity: 1,
            filter: "blur(0px)",
            duration: 0.5,
            delay: 0.35,
            ease: "back.out(1.2)",
            clearProps: "yPercent,filter",
          },
        )
      },
    })

    this._timers[colIdx] = setTimeout(
      () => this._cycle(colIdx),
      this.cycleInterval,
    )
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "motion-logo-carousel": MotionLogoCarousel
  }
}
