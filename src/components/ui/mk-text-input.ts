import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

@customElement("mk-text-input")
export class MkTextInput extends LitElement {
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

    .input {
      flex: 1;
      font-size: 0.75rem;
      color: rgb(51 65 85);
      border: none;
      border-radius: 7px;
      padding: 0 0.75rem;
      height: 2rem;
      outline: none;
      background-color: white;
      box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.05);
      transition: box-shadow 150ms;
      font-family: ui-monospace, "Cascadia Code", "Source Code Pro", monospace;
      min-width: 0;
    }

    .input:focus {
      box-shadow: inset 0 0 0 2px rgb(148 163 184);
    }

    .input::placeholder {
      color: rgb(148 163 184);
      opacity: 0.7;
    }
  `;

  @property() label = "";
  @property() value = "";
  @property() placeholder = "";

  @state() private _inputValue = "";

  override connectedCallback() {
    super.connectedCallback();
    this._inputValue = this.value;
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has("value")) this._inputValue = this.value;
  }

  private _onInput(e: Event) {
    this._inputValue = (e.target as HTMLInputElement).value;
    this.value = this._inputValue;
    this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  }

  override render() {
    return html`
      <div class="wrapper">
        <span class="lname">${this.label}</span>
        <input
          class="input"
          type="text"
          .value=${this._inputValue}
          .placeholder=${this.placeholder}
          @input=${this._onInput}
        />
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "mk-text-input": MkTextInput;
  }
}
