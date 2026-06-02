import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

@customElement("mk-slider")
export class MkSlider extends LitElement {
  static override styles = css`
    :host {
      display: block;
      min-width: 0;
    }

    * {
      corner-radius: squircle;
    }

    .wrapper {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      background: rgb(230 234 240);
      padding: 0.25rem;
      border-radius: 0.6rem;
    }

    .track {
      position: relative;
      height: 2rem;
      border-radius: 7px;
      background: white;
      box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.05);
      overflow: hidden;
      cursor: pointer;
      flex: 1;
      min-width: 0;
    }

    .fill {
      position: absolute;
      left: 0rem;
      top: 0;
      bottom: 0;
      background: rgba(15, 23, 42, 0.04);
      pointer-events: none;
    }

    .thumb {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 6px;
      height: 26px;
      background: rgb(148 163 184);
      border-radius: 3px;
      pointer-events: none;
      transition:
        transform 100ms,
        background 150ms;
    }
    :host(:hover) .thumb {
      transform: translateY(-50%) scaleX(1.1);
      background: rgb(59 130 246);
    }

    .ticks {
      position: absolute;
      inset: 0;
      margin: 0 0.5rem;
      pointer-events: none;
    }

    .tick {
      position: absolute;
      top: 50%;
      width: 1px;
      height: 10px;
      transform: translate(-50%, -50%);
      border-radius: 9999px;
      background: rgba(15, 23, 42, 0.08);
    }
    .tick.on {
      height: 14px;
      background: rgba(15, 23, 42, 0.15);
    }

    .labels {
      position: absolute;
      inset: 0 0.625rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      pointer-events: none;
      opacity: 0.95;
      z-index: 1;
      transition: opacity 150ms;
    }
    :host(:hover) .labels,
    :host(:focus-within) .labels {
      opacity: 1;
    }

    .lname {
      font-size: 0.75rem;
      line-height: 1;
      color: rgb(100 116 139);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }

    .lval {
      font-size: 0.75rem;
      line-height: 1;
      font-family: ui-monospace, "Cascadia Code", "Source Code Pro", monospace;
      color: rgba(15, 23, 42, 0.8);
      flex-shrink: 0;
    }

    .native {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: pointer;
      margin: 0;
    }

    .num {
      height: 2rem;
      width: 2.5rem;
      flex-shrink: 0;
      border-radius: 7px;
      background: white;
      padding: 0 0.5rem;
      text-align: right;
      font-family: ui-monospace, "Cascadia Code", "Source Code Pro", monospace;
      font-size: 0.75rem;
      color: rgba(15, 23, 42, 0.8);
      outline: none;
      border: none;
      box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.05);
      transition: box-shadow 150ms;
    }
    .num:focus {
      box-shadow: inset 0 0 0 2px rgb(148 163 184);
    }
  `;

  @property({ type: Number }) min = 0;
  @property({ type: Number }) max = 100;
  @property({ type: Number }) step = 1;
  @property({ type: Number }) value = 0;
  @property() label = "";
  @property({ attribute: "show-input", type: Boolean }) showInput = true;

  @state() private _numStr = "";

  override connectedCallback() {
    super.connectedCallback();
    this._numStr = this._fmt(this.value);
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has("value")) this._numStr = this._fmt(this.value);
  }

  private _fmt(v: number): string {
    const s = String(this.step);
    const dec = s.includes(".") ? s.split(".")[1]!.length : 0;
    return v.toFixed(dec);
  }

  private get _norm() {
    return Math.min(
      1,
      Math.max(0, (this.value - this.min) / (this.max - this.min || 1)),
    );
  }

  private _onRange(e: Event) {
    this.value = parseFloat((e.target as HTMLInputElement).value);
    // Shadow DOM retargeting propagates the native event to document naturally
  }

  private _commitNum() {
    const p = parseFloat(this._numStr);
    if (isNaN(p)) {
      this._numStr = this._fmt(this.value);
      return;
    }
    const steps = Math.round((p - this.min) / this.step);
    const raw = this.min + steps * this.step;
    this.value = Math.min(
      this.max,
      Math.max(this.min, parseFloat(raw.toFixed(10))),
    );
    this._numStr = this._fmt(this.value);
    this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  }

  private _onKey(e: KeyboardEvent) {
    if (e.key === "Enter") {
      this._commitNum();
      return;
    }
    if (e.key === "Escape") {
      this._numStr = this._fmt(this.value);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      this.value = Math.min(
        this.max,
        parseFloat((this.value + this.step).toFixed(10)),
      );
      this._numStr = this._fmt(this.value);
      this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.value = Math.max(
        this.min,
        parseFloat((this.value - this.step).toFixed(10)),
      );
      this._numStr = this._fmt(this.value);
      this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    }
  }

  override render() {
    const n = this._norm;
    const thumbLeft = `calc(${n * 100}% - 0.7rem)`;
    const fillWidth = `calc(${n * 100}% - 0.5rem)`;
    const thumbOp = this.label && n < 0.3 ? 0.35 : 1;

    const ticks = Array.from({ length: 17 }, (_, i) => {
      const t = i / 16;
      return html`<span
        class=${"tick" + (t <= n ? " on" : "")}
        style=${`left:${t * 100}%`}
      ></span>`;
    });

    const track = html`
      <div class="track">
        <div class="fill" style=${`width:${fillWidth}`}></div>
        <div
          class="thumb"
          style=${`left:${thumbLeft};opacity:${thumbOp}`}
        ></div>
        <span class="ticks">${ticks}</span>
        <div class="labels">
          <span class="lname">${this.label}</span>
          ${!this.showInput
            ? html`<span class="lval">${this._fmt(this.value)}</span>`
            : nothing}
        </div>
        <input
          class="native"
          type="range"
          .min=${String(this.min)}
          .max=${String(this.max)}
          .step=${String(this.step)}
          .value=${String(this.value)}
          @input=${this._onRange}
        />
      </div>
    `;

    if (this.showInput) {
      return html`
        <div class="wrapper">
          ${track}
          <input
            class="num"
            type="text"
            inputmode="decimal"
            .value=${this._numStr}
            @input=${(e: Event) => {
              e.stopPropagation();
              this._numStr = (e.target as HTMLInputElement).value;
            }}
            @blur=${this._commitNum}
            @keydown=${this._onKey}
          />
        </div>
      `;
    }

    return track;
  }
}
