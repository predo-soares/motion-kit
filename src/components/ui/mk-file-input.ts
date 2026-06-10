import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

@customElement("mk-file-input")
export class MkFileInput extends LitElement {
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

    .button-wrapper {
      flex: 0 0 auto;
      position: relative;
    }

    .upload-button {
      height: 2rem;
      min-width: 100px;
      border: none;
      border-radius: 7px;
      background-color: white;
      box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.05);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0 0.75rem;
      transition: all 150ms;
      font-size: 0.75rem;
      font-weight: 500;
      color: rgb(51 65 85);
    }

    .upload-button:hover {
      box-shadow: inset 0 0 0 2px rgb(148 163 184);
      background-color: rgb(248 250 252);
    }

    .upload-button:focus {
      box-shadow: inset 0 0 0 2px rgb(148 163 184);
      outline: none;
    }

    .upload-icon {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
      color: rgb(148 163 184);
    }

    .button-text {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .native-input {
      position: absolute;
      inset: 0;
      opacity: 0;
      cursor: pointer;
      width: 100%;
      height: 100%;
    }
  `;

  @property() label = "";
  @property() accept = "";
  @property({ attribute: "data-target" }) dataTarget = "";
  @property({ attribute: "data-attr" }) dataAttr = "";
  @state() private _fileName = "";

  private _onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this._fileName = file.name;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const content = loadEvent.target?.result as string;
      this.value = content;
      this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    };

    reader.readAsText(file);
  }

  override render() {
    const buttonText = this._fileName ? `File: ${this._fileName}` : 'Upload SVG';
    const uploadIcon = this._fileName
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';

    return html`
      <div class="wrapper">
        <span class="lname">${this.label}</span>
        <div class="button-wrapper">
          <button class="upload-button" type="button">
            <span class="upload-icon" innerHTML="${uploadIcon}"></span>
            <span class="button-text">${buttonText}</span>
            <input
              class="native-input"
              type="file"
              .accept=${this.accept}
              @change=${this._onFileChange}
            />
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "mk-file-input": MkFileInput;
  }
}
