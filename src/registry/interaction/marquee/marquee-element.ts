import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

/**
 * Scroll-aware infinite marquee. Place any HTML inside as children — they are
 * duplicated `repeat` times to create a seamless loop. Speed reacts to scroll
 * velocity via ScrollTrigger.
 *
 * @example
 * <motion-marquee gap="32" duration="10">
 *   <img src="/logo-a.svg" alt="A" class="h-8 w-auto" />
 *   <img src="/logo-b.svg" alt="B" class="h-8 w-auto" />
 * </motion-marquee>
 */
class MotionMarquee extends HTMLElement {
  private _ctx?: gsap.Context

  connectedCallback() {
    // Defer so children are available in the parsed DOM.
    requestAnimationFrame(() => this._init())
  }

  disconnectedCallback() {
    this._ctx?.revert()
  }

  replay() {
    this._ctx?.revert()
    requestAnimationFrame(() => this._init())
  }

  private _init() {
    const gap = Number(this.getAttribute("gap") ?? 32)
    const duration = Number(this.getAttribute("duration") ?? 5)
    const velocity = Number(this.getAttribute("velocity") ?? 0.5)
    const repeat = Number(this.getAttribute("repeat") ?? 3)
    const reversed = this.hasAttribute("reversed")

    // Capture original children before rebuilding DOM.
    const originalNodes = Array.from(this.childNodes).map((n) =>
      n.cloneNode(true),
    )
    if (!originalNodes.length) return

    this.style.cssText = "display:flex;overflow:hidden;width:100%;"
    this.innerHTML = ""

    const parts: HTMLDivElement[] = []
    for (let i = 0; i < repeat; i++) {
      const part = document.createElement("div")
      part.style.cssText = `display:flex;flex-shrink:0;gap:${gap}px;padding-left:${gap / 2}px;padding-right:${gap / 2}px;`
      if (i > 0) part.setAttribute("aria-hidden", "true")
      originalNodes.forEach((n) => part.appendChild(n.cloneNode(true)))
      this.appendChild(part)
      parts.push(part)
    }

    let tl!: gsap.core.Timeline

    this._ctx = gsap.context(() => {
      tl = gsap.timeline({
        repeat: -1,
        onReverseComplete() {
          tl.totalTime(tl.rawTime() + tl.duration() * 10)
        },
      })
      tl.to(parts, { xPercent: -100, ease: "none", duration })

      if (reversed) {
        tl.progress(1)
        tl.timeScale(-1)
      }

      let direction = reversed ? -1 : 1

      ScrollTrigger.create({
        onUpdate(self) {
          const targetDir = reversed ? -self.direction : self.direction
          if (direction !== targetDir) {
            direction = targetDir
            gsap.to(tl, { timeScale: direction, overwrite: true })
          }
          const scrollVel = self.getVelocity()
          if (Math.abs(scrollVel) > 0) {
            const timeScale =
              direction * (1 + Math.abs(scrollVel * velocity) / 1000)
            gsap.to(tl, { timeScale, overwrite: true, duration: 0.1 })
            gsap.to(tl, {
              timeScale: direction,
              duration: 0.5,
              delay: 0.1,
              overwrite: "auto",
            })
          }
        },
      })
    }, this)
  }
}

customElements.define("motion-marquee", MotionMarquee)

declare global {
  interface HTMLElementTagNameMap {
    "motion-marquee": MotionMarquee
  }
}
