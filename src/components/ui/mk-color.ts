import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("mk-color")
export class MkColor extends LitElement {
  static override styles = css`
    :host {
      display: block;
      min-width: 0;
    }

    .wrapper {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      background: rgb(230 234 240);
      padding: 0.25rem;
      border-radius: 0.6rem;
    }

    .lname {
      flex: 1;
      font-size: 0.75rem;
      line-height: 1;
      color: rgb(100 116 139);
      white-space: nowrap;
      padding-left: 0.375rem;
    }

    .pill {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      background: white;
      padding: 0 0.625rem;
      height: 2rem;
      border-radius: 7px;
      box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.05);
      flex-shrink: 0;
    }

    .swatch {
      -webkit-appearance: none;
      appearance: none;
      width: 1.125rem;
      height: 1.125rem;
      min-width: 1.125rem;
      border-radius: 9999px;
      border: none;
      padding: 0;
      cursor: pointer;
      background: none;
      overflow: hidden;
    }
    .swatch::-webkit-color-swatch-wrapper {
      padding: 0;
    }
    .swatch::-webkit-color-swatch {
      border: 1.5px solid rgba(0, 0, 0, 0.1);
      border-radius: 9999px;
    }
    .swatch::-moz-color-swatch {
      border: 1.5px solid rgba(0, 0, 0, 0.1);
      border-radius: 9999px;
    }

    .val {
      font-size: 10px;
      font-family: ui-monospace, "Cascadia Code", "Source Code Pro", monospace;
      color: rgb(100 116 139);
      white-space: nowrap;
    }
  `;

  @property() label = "";
  @property() value = "#000000";

  private _onInput(e: Event) {
    this.value = (e.target as HTMLInputElement).value;
    this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  }

  override render() {
    return html`
      <div class="wrapper">
        <span class="lname">${this.label}</span>
        <div class="pill">
          <input
            type="color"
            class="swatch"
            .value=${this.value}
            @input=${this._onInput}
          />
          <span class="val">${this.value}</span>
        </div>
      </div>
    `;
  }
}
