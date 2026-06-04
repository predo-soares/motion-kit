import { gsap } from "gsap";

class MotionVelocityCard extends HTMLElement {
  private _rotTo!: gsap.QuickToFunc;
  private _scaleXTo!: gsap.QuickToFunc;
  private _prevX = 0;
  private _prevT = 0;

  connectedCallback() {
    this.style.display = "inline-block";

    const duration = Number(this.getAttribute("duration") ?? 0.25);
    this._rotTo = gsap.quickTo(this, "rotation", {
      duration,
      ease: "power3.out",
    });
    this._scaleXTo = gsap.quickTo(this, "scaleX", {
      duration,
      ease: "power3.out",
    });

    this.addEventListener("pointermove", this._onMove);
    this.addEventListener("pointerleave", this._onLeave);
  }

  disconnectedCallback() {
    this.removeEventListener("pointermove", this._onMove);
    this.removeEventListener("pointerleave", this._onLeave);
    gsap.killTweensOf(this);
  }

  replay() {
    this._rotTo(0);
    this._scaleXTo(1);
  }

  private _onMove = (e: PointerEvent) => {
    const now = performance.now();
    const dt = now - this._prevT;
    const dx = e.clientX - this._prevX;

    this._prevX = e.clientX;
    this._prevT = now;

    if (dt < 1) return;

    const v = dx / dt;
    const rf = Number(this.getAttribute("rotation-factor") ?? 3);
    const sf = Number(this.getAttribute("stretch-factor") ?? 0.04);

    // this._rotTo(v * rf)
    this._scaleXTo(1 + Math.abs(v) * sf);
  };

  private _onLeave = () => {
    this._prevT = 0;
    gsap.to(this, {
      rotation: 0,
      scaleX: 1,
      duration: 0.8,
      ease: "elastic.out(1, 0.3)",
    });
  };
}

customElements.define("motion-velocity-card", MotionVelocityCard);

declare global {
  interface HTMLElementTagNameMap {
    "motion-velocity-card": MotionVelocityCard;
  }
}
