import { gsap } from "gsap"
import { Flip } from "gsap/Flip"
import { registerPluginOnce } from "@/lib/helpers/gsap"

class MotionFlipGrid extends HTMLElement {
  static observedAttributes = ["columns", "duration", "ease", "stagger", "gap"]

  private _observer?: MutationObserver
  private _ctx: gsap.Context | null = null
  private _state: Flip.FlipState | null = null
  private _rafId = 0
  private _isAnimating = false

  connectedCallback() {
    registerPluginOnce(Flip)

    // Apply base styles before the observer is active so these mutations
    // don't trigger spurious animations.
    this.style.position ||= "relative"
    this.style.display = "grid"
    this._applyLayoutStyles()

    this._observer = new MutationObserver(() => {
      // Ignore mutations that happen during our own animations
      if (this._isAnimating) return

      // Capture state synchronously (before next layout) then schedule the
      // animation — mirrors Svelte's $effect.pre / $effect split.
      this._captureBeforeChange()
      this._scheduleAnimate()
    })
    this._observer.observe(this, {
      childList: true,
      subtree: true,
      attributes: true,
      // "style" intentionally omitted: _applyLayoutStyles mutates this
      // element's own style, which would cause an infinite observer loop.
      attributeFilter: ["flip-id", "class"],
    })

    // Capture the initial state so the first triggered animation has a
    // valid from-state. Use double RAF to ensure layout is fully computed.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Only capture if we haven't already captured via attribute changes
        if (!this._state) {
          this._state = this._captureState()
        }
      })
    })
  }

  disconnectedCallback() {
    this._observer?.disconnect()
    this._ctx?.revert()
    this._ctx = null
    cancelAnimationFrame(this._rafId)
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    // For layout-related attributes, capture state BEFORE the attribute value
    // takes effect in the layout, then schedule the animation.
    if (oldValue === newValue) return
    if (name !== "columns" && name !== "gap") return

    // Capture immediately (synchronously) before any layout recalculations
    this._captureBeforeChange()
    this._scheduleAnimate()
  }

  replay() {
    const items = this._items()
    if (!items.length) return

    gsap.fromTo(
      items,
      { opacity: 0, scale: 0 },
      {
        opacity: 1,
        scale: 1,
        duration: this._duration,
        ease: this._ease,
        stagger: this._stagger,
        overwrite: true,
      },
    )
  }

  private get _duration() {
    return Number(this.getAttribute("duration") ?? 0.5)
  }

  private get _ease() {
    return this.getAttribute("ease") ?? "power2.inOut"
  }

  private get _stagger() {
    return Number(this.getAttribute("stagger") ?? 0)
  }

  private _items() {
    return Array.from(this.querySelectorAll<HTMLElement>(".flip-grid-item"))
  }

  private _captureState() {
    const items = this._items()
    if (!items.length) return null
    return Flip.getState([...items, this])
  }

  /** Capture current positions only if we don't already have a pending state. */
  private _captureBeforeChange() {
    if (!this._state) {
      this._state = this._captureState()
    }
  }

  private _applyLayoutStyles() {
    const columns = this.getAttribute("columns")
    if (columns) {
      this.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`
    } else {
      this.style.removeProperty("grid-template-columns")
    }

    const gap = this.getAttribute("gap")
    if (gap) {
      this.style.gap = gap
    } else {
      this.style.removeProperty("gap")
    }
  }

  private _scheduleAnimate() {
    if (this._rafId) return

    this._rafId = requestAnimationFrame(() => {
      this._rafId = 0

      // Apply new layout so Flip measures the updated positions.
      this._applyLayoutStyles()

      const items = this._items()
      const fromState = this._state
      // Null out state so _captureBeforeChange picks up fresh positions on
      // the next change — mirrors Svelte's `state = null` after use.
      this._state = null

      if (!items.length || !fromState) return

      this._isAnimating = true
      this._ctx?.revert()
      this._ctx = gsap.context(() => {
        Flip.from(fromState, {
          targets: [...items, this],
          duration: this._duration,
          ease: this._ease,
          stagger: this._stagger,
          absolute: ".flip-grid-item",
          onEnter: (elements) => {
            gsap.fromTo(
              elements,
              { opacity: 0, scale: 0 },
              { opacity: 1, scale: 1, duration: this._duration, ease: this._ease },
            )
          },
          onLeave: (elements) => {
            gsap.to(elements, {
              opacity: 0,
              scale: 0,
              duration: this._duration,
              ease: this._ease,
            })
          },
          onComplete: () => {
            this._isAnimating = false
          },
        })
      }, this)
    })
  }
}

customElements.define("motion-flip-grid", MotionFlipGrid)

declare global {
  interface HTMLElementTagNameMap {
    "motion-flip-grid": MotionFlipGrid
  }
}
