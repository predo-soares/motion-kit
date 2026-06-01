import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { gsap } from "gsap";

interface GalleryItem {
  src: string;
  alt?: string;
}

/**
 * Circular rotating image gallery. Items are evenly spaced around a ring and
 * the ring spins continuously. Peek the ring below the fold by setting `offset`.
 *
 * @example
 * <motion-radial-gallery
 *   items='[{"src":"/img/1.jpg"},{"src":"/img/2.jpg"}]'
 *   radius="480"
 *   duration="24"
 *   element-size="160"
 *   class="h-[360px] w-full overflow-hidden"
 * ></motion-radial-gallery>
 */
@customElement("motion-radial-gallery")
export class MotionRadialGallery extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
    .outer {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      overflow: hidden;
    }
    .ring {
      position: absolute;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .item-wrap {
      position: absolute;
      top: 50%;
      left: 50%;
      border-radius: 32px;
      overflow: hidden;
    }
    .counter {
      display: block;
    }
    .counter img {
      display: block;
      pointer-events: none;
      user-select: none;
      object-fit: cover;
    }
    *,
    *::before,
    *::after {
      corner-shape: var(--corner-shape-default);
    }
  `;

  /** JSON array: `[{"src":"...","alt":"..."}]` */
  @property({ type: String }) items = "[]";

  /** Radius of the circle in pixels. */
  @property({ type: Number }) radius = 600;

  /** Duration of one full rotation in seconds. */
  @property({ type: Number }) duration = 20;

  /** Rotate counter-clockwise. */
  @property({ type: Boolean }) reversed = false;

  /** Extra pixels to offset the ring center below the visible area. */
  @property({ type: Number }) offset = 0;

  /** Gap between items in pixels. */
  @property({ type: Number }) gap = 0;

  /** Estimated item width in pixels for circumference calculations. */
  @property({ type: Number, attribute: "element-size" }) elementSize = 100;

  private _tween?: gsap.core.Tween;
  private _ring?: HTMLElement;

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._tween?.kill();
  }

  override firstUpdated() {
    this._ring =
      this.shadowRoot!.querySelector<HTMLElement>(".ring") ?? undefined;
    this._startRotation();
  }

  override updated(changedProps: Map<string, unknown>) {
    if (changedProps.has("duration") && this._tween) {
      this._tween.duration(this.duration);
    }
  }

  replay() {
    if (!this._ring) return;
    this._tween?.kill();
    gsap.set(this._ring, { rotation: 0 });
    this._startRotation();
  }

  private _startRotation() {
    if (!this._ring) return;
    this._tween = gsap.to(this._ring, {
      rotation: this.reversed ? -360 : 360,
      duration: this.duration,
      repeat: -1,
      ease: "none",
    });
  }

  private _displayItems() {
    const items: GalleryItem[] = JSON.parse(this.items);
    if (!items.length) return [];
    const circumference = 2 * Math.PI * this.radius;
    const spacePerItem = this.elementSize + this.gap;
    const neededItems = Math.ceil(circumference / spacePerItem);
    const repeats = Math.ceil(neededItems / items.length);
    return Array.from({ length: repeats }, (_, r) =>
      items.map((item, i) => ({ ...item, key: `${r}-${i}` })),
    ).flat();
  }

  override render() {
    const displayItems = this._displayItems();
    const angleStep = displayItems.length ? 360 / displayItems.length : 0;
    const r = this.radius;
    const sz = this.elementSize;

    return html`
      <div class="outer">
        <div
          class="ring"
          style="width:${r * 2}px;height:${r * 2}px;bottom:${this.offset -
          r}px;"
        >
          ${displayItems.map(
            ({ src, alt, key }, i) => html`
              <div
                class="item-wrap"
                data-key="${key}"
                style="transform:translate(-50%,-50%) rotate(${i *
                angleStep}deg) translate(0,${-r}px) rotate(90deg);"
              >
                <div class="counter" style="transform:rotate(-90deg);">
                  <img
                    src="${src}"
                    alt="${alt ?? ""}"
                    width="${sz}"
                    height="${sz}"
                  />
                </div>
              </div>
            `,
          )}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "motion-radial-gallery": MotionRadialGallery;
  }
}
