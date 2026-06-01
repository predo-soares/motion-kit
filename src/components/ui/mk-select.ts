import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

@customElement("mk-select")
export class MkSelect extends LitElement {
  static override styles = css`
    :host {
      display: block;
      min-width: 0;
    }

    .wrapper {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: rgb(230 234 240);
      padding: 0.25rem;
      border-radius: 0.6rem;
    }

    .lname {
      flex: 0 0 auto;
      font-size: 0.75rem;
      line-height: 1;
      color: rgb(100 116 139);
      white-space: nowrap;
      padding-left: 0.375rem;
    }

    .select {
      flex: 1;
      -webkit-appearance: none;
      appearance: none;
      font-size: 11px;
      color: rgb(51 65 85);
      border: none;
      border-radius: 7px;
      padding: 0 24px 0 10px;
      height: 2rem;
      cursor: pointer;
      outline: none;
      background-color: white;
      box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.05);
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C%2Fsvg%3E");
      background-repeat: no-repeat;
      background-position: right 8px center;
      font-family: inherit;
    }
  `;

  @property() label = "";
  @property() value = "";

  @state() private _options: { value: string; label: string }[] = [];

  override connectedCallback() {
    super.connectedCallback();
    this._readOptions();
  }

  private _readOptions() {
    const opts = Array.from(
      this.querySelectorAll("option"),
    ) as HTMLOptionElement[];
    this._options = opts.map((o) => ({
      value: o.value,
      label: o.textContent ?? o.value,
    }));
    const selected = opts.find((o) => o.selected || o.hasAttribute("selected"));
    if (selected) this.value = selected.value;
    else if (opts.length) this.value = opts[0]!.value;
  }

  private _onChange(e: Event) {
    this.value = (e.target as HTMLSelectElement).value;
    this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  }

  override render() {
    return html`
      <div class="wrapper">
        <span class="lname">${this.label}</span>
        <select class="select" .value=${this.value} @change=${this._onChange}>
          ${this._options.map(
            (o) =>
              html`<option value=${o.value} ?selected=${o.value === this.value}>
                ${o.label}
              </option>`,
          )}
        </select>
      </div>
    `;
  }
}
