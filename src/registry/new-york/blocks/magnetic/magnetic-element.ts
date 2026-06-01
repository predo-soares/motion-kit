import { gsap } from "gsap";

/**
 * Native magnetic custom element with GSAP-powered motion.
 *
 * @example
 * <motion-magnetic-native duration="1" strength="0.35">
 *   <button>Hover me</button>
 * </motion-magnetic-native>
 */
export class MotionMagneticNative extends HTMLElement {
  static observedAttributes = ["duration", "strength", "ease"];

  private _xTo?: gsap.QuickToFunc;
  private _yTo?: gsap.QuickToFunc;
  private _ctx?: gsap.Context;

  get duration() {
    return Number(this.getAttribute("duration") ?? 1);
  }

  get strength() {
    return Number(this.getAttribute("strength") ?? 1);
  }

  get ease() {
    return this.getAttribute("ease") ?? "elastic.out(1, 0.3)";
  }

  connectedCallback() {
    if (!this.style.display) {
      this.style.display = "inline-block";
    }

    this.addEventListener("mousemove", this._onMouseMove);
    this.addEventListener("mouseleave", this._onMouseLeave);
    this.addEventListener("lostpointercapture", this._onMouseLeave);
    this._setupAnimation();
  }

  disconnectedCallback() {
    this.removeEventListener("mousemove", this._onMouseMove);
    this.removeEventListener("mouseleave", this._onMouseLeave);
    this.removeEventListener("lostpointercapture", this._onMouseLeave);
    this._ctx?.revert();
  }

  attributeChangedCallback() {
    if (this.isConnected) {
      this._setupAnimation();
      this._onMouseLeave();
    }
  }

  private _setupAnimation() {
    this._ctx?.revert();
    this._ctx = gsap.context(() => {
      this._xTo = gsap.quickTo(this, "x", {
        duration: this.duration,
        ease: this.ease,
      });
      this._yTo = gsap.quickTo(this, "y", {
        duration: this.duration,
        ease: this.ease,
      });
    }, this);
  }

  replay() {
    this._onMouseLeave()
  }

  private _onMouseMove = (event: MouseEvent) => {
    const { height, width, left, top } = this.getBoundingClientRect();
    this._xTo?.((event.clientX - (left + width / 2)) * this.strength);
    this._yTo?.((event.clientY - (top + height / 2)) * this.strength);
  };

  private _onMouseLeave = () => {
    this._xTo?.(0);
    this._yTo?.(0);
  };
}

if (!customElements.get("motion-magnetic-native")) {
  customElements.define("motion-magnetic-native", MotionMagneticNative);
}

declare global {
  interface HTMLElementTagNameMap {
    "motion-magnetic-native": MotionMagneticNative;
  }
}
