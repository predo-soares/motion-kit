import { gsap } from "gsap"

type PointerHandlers = {
  down: (event: PointerEvent) => void
  move: (event: PointerEvent) => void
  up: (event: PointerEvent) => void
}

type DragState = {
  cardIndex: number
  pointerId: number
  startX: number
  startY: number
  currentX: number
  currentY: number
}

class MotionFlipCardStack extends HTMLElement {
  private _cards: HTMLElement[] = []
  private _cardOrder: number[] = []
  private _dragState: DragState | null = null
  private _observer?: MutationObserver
  private _handlers = new WeakMap<HTMLElement, PointerHandlers>()

  static observedAttributes = ["stack-offset", "stack-rotation", "drag-threshold", "duration", "ease"]

  connectedCallback() {
    this.style.display ||= "inline-grid"
    this.style.position ||= "relative"
    this.style.perspective ||= "1000px"

    this._observer = new MutationObserver(() => {
      this._syncCards()
      this._layout(true)
    })
    this._observer.observe(this, { childList: true })

    requestAnimationFrame(() => {
      this._syncCards()
      this._layout(true)
    })
  }

  attributeChangedCallback(name: string, _oldValue: string | null, _newValue: string | null) {
    // Re-layout when any observed attribute changes
    this._layout(false)
  }

  disconnectedCallback() {
    this._observer?.disconnect()
    this._dragState = null

    this._cards.forEach((card) => {
      const handlers = this._handlers.get(card)
      if (!handlers) return
      card.removeEventListener("pointerdown", handlers.down)
      card.removeEventListener("pointermove", handlers.move)
      card.removeEventListener("pointerup", handlers.up)
      card.removeEventListener("pointercancel", handlers.up)
      gsap.killTweensOf(card)
    })
  }

  replay() {
    this._layout(false)
  }

  private get _stackOffset() {
    return Number(this.getAttribute("stack-offset") ?? 8)
  }

  private get _stackRotation() {
    return Number(this.getAttribute("stack-rotation") ?? -10)
  }

  private get _dragThreshold() {
    return Number(this.getAttribute("drag-threshold") ?? 80)
  }

  private get _duration() {
    return Number(this.getAttribute("duration") ?? 0.3)
  }

  private get _ease() {
    return this.getAttribute("ease") ?? "power2.out"
  }

  private _syncCards() {
    this._cards = Array.from(this.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement,
    )

    const nextIndexes = this._cards.map((_, index) => index)
    const sameSet =
      nextIndexes.length === this._cardOrder.length &&
      nextIndexes.every((index) => this._cardOrder.includes(index))

    if (!sameSet) {
      this._cardOrder = nextIndexes
    }

    this._cards.forEach((card, index) => {
      card.style.gridArea = "1 / 1"
      card.style.userSelect = "none"
      card.style.transformOrigin = "center center"

      if (this._handlers.has(card)) return

      const handlers: PointerHandlers = {
        down: (event) => this._handlePointerDown(event, this._cards.indexOf(card)),
        move: (event) => this._handlePointerMove(event, this._cards.indexOf(card)),
        up: (event) => this._handlePointerEnd(event, this._cards.indexOf(card)),
      }

      this._handlers.set(card, handlers)
      card.addEventListener("pointerdown", handlers.down)
      card.addEventListener("pointermove", handlers.move)
      card.addEventListener("pointerup", handlers.up)
      card.addEventListener("pointercancel", handlers.up)
    })
  }

  private _getTransform(cardIndex: number) {
    const stackPosition = this._cardOrder.indexOf(cardIndex)
    if (stackPosition === -1) return null

    const positionFromBottom = this._cardOrder.length - 1 - stackPosition
    return {
      zIndex: stackPosition + 1,
      y: -positionFromBottom * this._stackOffset,
      rotation: positionFromBottom * this._stackRotation,
      scale: 1 - positionFromBottom * 0.02,
    }
  }

  private _topCardIndex() {
    return this._cardOrder[this._cardOrder.length - 1] ?? -1
  }

  private _layout(immediate: boolean) {
    const topCardIndex = this._topCardIndex()

    this._cards.forEach((card, index) => {
      const transform = this._getTransform(index)
      if (!transform) return

      card.style.zIndex = String(
        this._dragState?.cardIndex === index
          ? this._cards.length + 10
          : transform.zIndex,
      )
      card.style.touchAction = index === topCardIndex ? "none" : "auto"
      card.style.cursor =
        index === topCardIndex
          ? this._dragState?.cardIndex === index
            ? "grabbing"
            : "grab"
          : "default"

      if (this._dragState?.cardIndex === index) return

      const vars = {
        x: 0,
        y: transform.y,
        rotation: transform.rotation,
        scale: transform.scale,
      }

      if (immediate) {
        gsap.set(card, vars)
        return
      }

      gsap.to(card, {
        ...vars,
        duration: this._duration,
        ease: this._ease,
        overwrite: true,
      })
    })
  }

  private _handlePointerDown(event: PointerEvent, cardIndex: number) {
    if (cardIndex !== this._topCardIndex()) return
    const card = this._cards[cardIndex]
    if (!card) return

    event.preventDefault()
    this._dragState = {
      cardIndex,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      currentX: 0,
      currentY: 0,
    }

    try {
      card.setPointerCapture(event.pointerId)
    } catch {
      // Pointer capture may fail for some sources; dragging still works.
    }

    gsap.killTweensOf(card)
    gsap.to(card, {
      scale: 1.05,
      rotation: 0,
      duration: 0.05,
      ease: "power2.out",
      overwrite: true,
    })
    this._layout(true)
  }

  private _handlePointerMove(event: PointerEvent, cardIndex: number) {
    if (!this._dragState || cardIndex !== this._dragState.cardIndex) return
    if (event.pointerId !== this._dragState.pointerId) return

    const card = this._cards[cardIndex]
    if (!card) return

    const dx = event.clientX - this._dragState.startX
    const dy = event.clientY - this._dragState.startY
    const x = gsap.utils.clamp(-150, 150, dx)
    const y = gsap.utils.clamp(-150, 150, dy)

    this._dragState.currentX = x
    this._dragState.currentY = y

    gsap.set(card, {
      x,
      y,
      rotation: 0,
      scale: 1.05,
    })
  }

  private _handlePointerEnd(event: PointerEvent, cardIndex: number) {
    if (!this._dragState || cardIndex !== this._dragState.cardIndex) return
    if (event.pointerId !== this._dragState.pointerId) return

    const card = this._cards[cardIndex]
    if (!card) {
      this._dragState = null
      this._layout(false)
      return
    }

    try {
      if (card.hasPointerCapture(event.pointerId)) {
        card.releasePointerCapture(event.pointerId)
      }
    } catch {
      // Ignore capture release failures.
    }

    const dragDistance =
      Math.abs(this._dragState.currentX) + Math.abs(this._dragState.currentY)
    const shouldMoveToBack = dragDistance >= this._dragThreshold

    this._dragState = null

    if (!shouldMoveToBack) {
      gsap.to(card, {
        x: 0,
        y: 0,
        rotation: 0,
        scale: 1,
        duration: this._duration,
        ease: this._ease,
        overwrite: true,
      })
      this._layout(false)
      return
    }

    const draggedPosition = this._cardOrder.indexOf(cardIndex)
    if (draggedPosition !== -1) {
      const nextOrder = [...this._cardOrder]
      const [dragged] = nextOrder.splice(draggedPosition, 1)
      if (dragged !== undefined) {
        nextOrder.unshift(dragged)
        this._cardOrder = nextOrder
      }
    }

    this._layout(false)
  }
}

customElements.define("motion-flip-card-stack", MotionFlipCardStack)

declare global {
  interface HTMLElementTagNameMap {
    "motion-flip-card-stack": MotionFlipCardStack
  }
}
