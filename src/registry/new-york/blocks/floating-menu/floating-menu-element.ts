import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { gsap } from "gsap";
import { ensureMotionCoreEase } from "@/lib/helpers/gsap";

type MenuVariant = "default" | "muted";

type MenuLink = {
  label: string;
  href: string;
};

type MenuButton = {
  label: string;
  href: string;
};

type MenuGroup = {
  title: string;
  variant?: MenuVariant;
  links: MenuLink[];
};

@customElement("motion-floating-menu")
export class MotionFloatingMenu extends LitElement {
  static override styles = css`
    :host {
      --menu-ink: #0f172a;
      --menu-ink-soft: #334155;
      --menu-muted: #64748b;
      --menu-border: rgba(226, 232, 240, 0.9);
      --menu-border-strong: rgba(203, 213, 225, 0.95);
      --menu-surface: rgba(255, 255, 255, 0.92);
      --menu-surface-strong: rgba(255, 255, 255, 0.98);
      --menu-surface-muted: rgba(248, 250, 252, 0.94);
      --menu-shadow:
        0 28px 90px rgba(15, 23, 42, 0.08), 0 10px 30px rgba(15, 23, 42, 0.04);
      display: block;
      position: relative;
      width: 100%;
      min-height: 28rem;
      overflow: hidden;
      color: var(--menu-ink);
      border-radius: 2rem;
      background: #f8fafc;
    }

    * {
      corner-shape: var(--corner-shape-default);
    }

    .overlay {
      position: absolute;
      inset: 0;
      z-index: 40;
      pointer-events: none;
      opacity: 0;
      background: rgba(248, 250, 252, 0.72);
      backdrop-filter: blur(12px);
    }

    .root {
      position: absolute;
      left: 50%;
      top: 0.875rem;
      z-index: 50;
      width: 100%;
      min-width: min(calc(100% - 1rem), 5rem);
      max-width: min(10rem, calc(100% - 1rem));
      transform: translateX(-50%);
      border: 1px solid var(--menu-border);
      border-radius: 1.75rem;
      background: var(--menu-surface-strong);
      color: var(--menu-ink);
      box-shadow: var(--menu-shadow);
      backdrop-filter: blur(20px);
      overflow: visible;
    }

    .header {
      position: relative;
      z-index: 20;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
      width: 100%;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem;
      min-height: calc(2.5rem + 1.25rem);
      box-sizing: border-box;
    }

    .toggleButton {
      position: relative;
      display: flex;
      height: 2.5rem;
      align-items: center;
      justify-content: center;
      gap: 0.125rem;
      border: 1px solid transparent;
      border-radius: 999px;
      padding: 0 0.875rem 0 0.25rem;
      background: transparent;
      color: var(--menu-ink);
      cursor: pointer;
      transition:
        background-color 0.25s ease,
        border-color 0.25s ease,
        color 0.25s ease,
        transform 0.25s ease;
      justify-self: start;
    }

    .toggleButton:hover {
      border-color: var(--menu-border);
      background: rgba(248, 250, 252, 0.98);
      transform: translateY(-1px);
    }

    .toggleButton:hover .toggleLine,
    .toggleButton:hover .toggleLabel {
      color: var(--menu-ink);
      background-color: var(--menu-ink);
    }

    .toggleIcon {
      position: relative;
      display: flex;
      height: 2.5rem;
      width: 2.5rem;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      background: rgba(241, 245, 249, 0.92);
      box-shadow: inset 0 0 0 1px rgba(226, 232, 240, 0.9);
    }

    .toggleLine {
      position: absolute;
      height: 1px;
      width: 1rem;
      background: var(--menu-ink);
      transition:
        background-color 0.25s ease,
        color 0.25s ease;
    }

    .toggleLabel {
      margin-left: 0.25rem;
      font-size: 0.8125rem;
      font-weight: 500;
      letter-spacing: -0.01em;
      transition: color 0.25s ease;
    }

    .logoWrap {
      position: relative;
      justify-self: center;
      backface-visibility: hidden;
      pointer-events: none;
      align-self: center;
      min-width: 0;
      max-width: 100%;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      max-width: 100%;
      white-space: nowrap;
    }

    .actions {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      justify-self: end;
      min-width: 0;
    }

    .secondaryButton,
    .primaryButton {
      display: inline-flex;
      height: 2.5rem;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--menu-border);
      border-radius: 999px;
      padding: 0 1rem;
      font-size: 0.8125rem;
      font-weight: 500;
      text-decoration: none;
      letter-spacing: -0.01em;
      box-sizing: border-box;
      transition:
        background-color 0.25s ease,
        border-color 0.25s ease,
        color 0.25s ease,
        transform 0.25s ease;
    }

    .secondaryButton {
      display: none;
      background: rgba(255, 255, 255, 0.78);
      color: var(--menu-ink-soft);
    }

    .secondaryButton:hover {
      border-color: var(--menu-border-strong);
      background: rgba(248, 250, 252, 1);
      color: var(--menu-ink);
      transform: translateY(-1px);
    }

    .primaryButton {
      border-color: rgba(15, 23, 42, 0.9);
      background: rgba(15, 23, 42, 0.96);
      color: white;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
    }

    .primaryButton:hover {
      background: rgba(30, 41, 59, 1);
      border-color: rgba(30, 41, 59, 1);
      transform: translateY(-1px);
    }

    .menuWrapper {
      height: 0;
      width: 100%;
      overflow: hidden;
      opacity: 0;
      border-top: 1px solid var(--menu-border);
      border-bottom-left-radius: 1.75rem;
      border-bottom-right-radius: 1.75rem;
      box-sizing: border-box;
      background: var(--menu-surface);
    }

    .grid {
      display: grid;
      max-height: 65vh;
      grid-template-columns: 1fr;
      gap: 0.875rem;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: 1rem;
      box-sizing: border-box;
    }

    .group {
      display: flex;
      flex-direction: column;
      gap: 0.875rem;
      min-height: 100%;
      border: 1px solid transparent;
      border-radius: 1.5rem;
      padding: 1rem;
      background: rgba(255, 255, 255, 0.64);
      transition:
        background-color 0.25s ease,
        border-color 0.25s ease,
        transform 0.25s ease;
    }

    .group:hover {
      border-color: var(--menu-border);
      background: rgba(255, 255, 255, 0.96);
      transform: translateY(-1px);
    }

    .groupMuted {
      border-color: var(--menu-border);
      background: var(--menu-surface-muted);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
    }

    .groupTitle {
      margin: 0;
      font-size: 0.75rem;
      font-weight: 500;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: rgba(100, 116, 139, 0.88);
    }

    .linkList {
      margin-top: 0.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.875rem;
    }

    .link {
      position: relative;
      display: block;
      width: 100%;
      border-radius: 1rem;
      color: rgba(71, 85, 105, 1);
      text-decoration: none;
      font-size: 1.375rem;
      font-weight: 500;
      letter-spacing: -0.03em;
      padding: 0.25rem 0;
      transition:
        color 0.25s ease,
        opacity 0.25s ease,
        transform 0.25s ease;
    }

    .link:hover {
      color: var(--menu-ink);
      transform: translateX(3px);
    }

    .linkTextOuter {
      position: relative;
      z-index: 10;
      display: block;
      line-height: 1.1;
      overflow: hidden;
    }

    .linkText {
      display: block;
      white-space: nowrap;
    }

    .underline {
      position: absolute;
      left: 0;
      bottom: -0.05rem;
      height: 1px;
      width: 100%;
      transform: scaleX(0);
      transform-origin: right;
      background: rgba(15, 23, 42, 0.8);
      transition: transform 0.3s ease;
    }

    .link:hover .underline {
      transform: scaleX(1);
      transform-origin: left;
    }

    .divider {
      margin: 0;
      border: 0;
      border-top: 1px solid rgba(226, 232, 240, 0.9);
    }

    @media (min-width: 768px) {
      .root {
        top: 1rem;
        min-width: min(calc(100% - 2rem), 20rem);
        max-width: min(20rem, calc(100% - 2rem));
      }

      .header {
        padding: 0.75rem;
      }

      .secondaryButton {
        display: inline-flex;
      }

      .grid {
        max-height: none;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1rem;
        padding: 1.125rem;
        overflow: visible;
      }
    }

    @media (min-width: 1024px) {
      .root {
        min-width: min(calc(100% - 2rem), 20rem);
        max-width: min(26rem, calc(100% - 2rem));
      }
    }
  `;

  @property({ attribute: "menu-groups" }) menuGroups = "[]";
  @property({ attribute: "logo-html" }) logoHtml = "";
  @property({ attribute: "primary-button" }) primaryButton = "";
  @property({ attribute: "secondary-button" }) secondaryButton = "";

  private _isOpen = false;
  private _timeline: gsap.core.Timeline | null = null;
  private _ctx: gsap.Context | null = null;
  private _listeningForEscape = false;
  private _resizeHandler = () => {
    void this._initTimeline();
  };
  private _handleDocumentKeydown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !this._isOpen) return;
    event.preventDefault();
    this._toggle();
  };

  override connectedCallback() {
    super.connectedCallback();
    ensureMotionCoreEase();
    window.addEventListener("resize", this._resizeHandler);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("resize", this._resizeHandler);
    this._setDocumentEscapeListener(false);
    this._cleanupAnimation();
  }

  override firstUpdated() {
    void this._initTimeline();
  }

  override updated(changed: Map<string, unknown>) {
    if (
      changed.has("menuGroups") ||
      changed.has("logoHtml") ||
      changed.has("primaryButton") ||
      changed.has("secondaryButton")
    ) {
      void this.updateComplete.then(() => this._initTimeline());
    }
  }

  replay() {
    if (!this._timeline) return;

    this._timeline.pause(0);
    this._isOpen = false;
    this._setOverlayInteractivity(false);
    requestAnimationFrame(() => {
      this._isOpen = true;
      this._setOverlayInteractivity(true);
      this._timeline?.play(0);
    });
  }

  private _parseGroups() {
    try {
      const parsed = JSON.parse(this.menuGroups) as MenuGroup[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private _parseButton(source: string) {
    if (!source) return null;

    try {
      const parsed = JSON.parse(source) as MenuButton;
      if (parsed?.label && parsed?.href) return parsed;
    } catch {
      return null;
    }

    return null;
  }

  private _cleanupAnimation() {
    this._setDocumentEscapeListener(false);
    this._timeline?.kill();
    this._timeline = null;
    this._ctx?.revert();
    this._ctx = null;
  }

  private _setDocumentEscapeListener(active: boolean) {
    if (active === this._listeningForEscape) return;
    this._listeningForEscape = active;
    if (active) {
      document.addEventListener("keydown", this._handleDocumentKeydown);
      return;
    }
    document.removeEventListener("keydown", this._handleDocumentKeydown);
  }

  private _setOverlayInteractivity(active: boolean) {
    const overlay = this.renderRoot.querySelector<HTMLElement>(
      "[data-slot='overlay']",
    );
    if (!overlay) return;
    overlay.style.pointerEvents = active ? "auto" : "none";
  }

  private async _initTimeline() {
    const groups = this._parseGroups();
    if (!groups.length) return;

    await document.fonts.ready;
    this._cleanupAnimation();

    const root =
      this.renderRoot.querySelector<HTMLElement>("[data-slot='root']");
    const overlay = this.renderRoot.querySelector<HTMLElement>(
      "[data-slot='overlay']",
    );
    const menuWrapper = this.renderRoot.querySelector<HTMLElement>(
      "[data-slot='menu-wrapper']",
    );
    const header = this.renderRoot.querySelector<HTMLElement>(
      "[data-slot='header']",
    );
    const line1 = this.renderRoot.querySelector<HTMLElement>(
      "[data-slot='line-1']",
    );
    const line2 = this.renderRoot.querySelector<HTMLElement>(
      "[data-slot='line-2']",
    );

    if (!root || !overlay || !menuWrapper || !header || !line1 || !line2)
      return;

    const width = window.innerWidth;
    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1024;

    let maxWidthOpenRatio = 0.82;
    let maxWidthInitialRatio = 0.62;

    if (isMobile) {
      maxWidthOpenRatio = 1;
      maxWidthInitialRatio = 0.98;
    } else if (isTablet) {
      maxWidthOpenRatio = 0.9;
      maxWidthInitialRatio = 0.82;
    }

    const hostWidth = this.getBoundingClientRect().width;
    if (!hostWidth) return;

    const horizontalInset = isMobile ? 16 : 32;
    const headerMinWidth = Math.ceil(header.scrollWidth + horizontalInset);

    // GSAP resolves percentage width values against the parent node, which is a
    // ShadowRoot here. Use explicit pixel widths so setup never asks
    // `getComputedStyle()` for a non-Element parent.
    const maxWidthInitial = `${Math.max(
      Math.round(hostWidth * maxWidthInitialRatio),
      headerMinWidth,
    )}px`;
    const maxWidthOpen = `${Math.max(
      Math.round(hostWidth * maxWidthOpenRatio),
      headerMinWidth,
    )}px`;

    this._ctx = gsap.context(() => {
      gsap.set(overlay, { autoAlpha: 0 });
      gsap.set(root, { maxWidth: maxWidthInitial });
      gsap.set(menuWrapper, { height: 0, autoAlpha: 0 });
      gsap.set(line1, { y: 4, rotation: 0 });
      gsap.set(line2, { y: -4, rotation: 0 });

      const linkElements = Array.from(
        menuWrapper.querySelectorAll<HTMLElement>("[data-slot='link-text']"),
      );
      gsap.set(linkElements, { yPercent: 100, autoAlpha: 0 });

      this._timeline = gsap.timeline({
        paused: true,
        defaults: { ease: "motion-kit-ease", duration: 0.5 },
        onReverseComplete: () => {
          this._setOverlayInteractivity(false);
          this._isOpen = false;
          this._setDocumentEscapeListener(false);
        },
        onComplete: () => {
          this._setOverlayInteractivity(true);
          this._isOpen = true;
          this._setDocumentEscapeListener(true);
        },
      });

      this._timeline
        .to(
          root,
          {
            maxWidth: maxWidthOpen,
            ...(isMobile
              ? {
                  top: 0,
                  paddingTop: "0.5rem",
                  borderTopLeftRadius: 0,
                  borderTopRightRadius: 0,
                }
              : {}),
          },
          0,
        )
        .to(overlay, { autoAlpha: 1 }, 0)
        .to(menuWrapper, { height: "auto", autoAlpha: 1 }, 0.2)
        .to([line1, line2], { y: 0, duration: 0.4 }, 0.2)
        .to(line1, { rotation: 45, duration: 0.4 }, 0.2)
        .to(line2, { rotation: -45, duration: 0.4 }, 0.2)
        .to(
          linkElements,
          {
            yPercent: 0,
            autoAlpha: 1,
            stagger: 0.02,
          },
          0.3,
        );
    }, root);

    if (this._isOpen) {
      this._timeline?.progress(1);
      this._setOverlayInteractivity(true);
      this._setDocumentEscapeListener(true);
      return;
    }

    this._setDocumentEscapeListener(false);
    this._setOverlayInteractivity(false);
  }

  private _toggle = async () => {
    if (!this._timeline) {
      await this._initTimeline();
    }
    if (!this._timeline) return;

    if (this._isOpen) {
      this._timeline.reverse();
      return;
    }

    this._setOverlayInteractivity(true);
    this._timeline.play();
  };

  private _handleOverlayKeydown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !this._isOpen) return;
    event.preventDefault();
    this._toggle();
  };

  override render() {
    const groups = this._parseGroups();
    const primaryButton = this._parseButton(this.primaryButton);
    const secondaryButton = this._parseButton(this.secondaryButton);

    return html`
      <div
        data-slot="overlay"
        class="overlay"
        @click=${this._toggle}
        role="button"
        tabindex="-1"
        aria-label="Close menu"
      ></div>

      <div data-slot="root" class="root">
        <div data-slot="header" class="header">
          <button
            data-slot="toggle-button"
            class="toggleButton"
            @click=${this._toggle}
            aria-label="Toggle menu"
          >
            <div class="toggleIcon">
              <span data-slot="line-1" class="toggleLine"></span>
              <span data-slot="line-2" class="toggleLine"></span>
            </div>
            <span class="toggleLabel">Menu</span>
          </button>

          <div class="logoWrap">
            ${this.logoHtml
              ? html`<div data-slot="logo" class="logo">
                  ${unsafeHTML(this.logoHtml)}
                </div>`
              : null}
          </div>

          <div data-slot="actions" class="actions">
            ${secondaryButton
              ? html`<a
                  href=${secondaryButton.href}
                  data-slot="secondary-button"
                  class="secondaryButton"
                >
                  ${secondaryButton.label}
                </a>`
              : null}
            ${primaryButton
              ? html`<a
                  href=${primaryButton.href}
                  data-slot="primary-button"
                  class="primaryButton"
                >
                  ${primaryButton.label}
                </a>`
              : null}
          </div>
        </div>

        <div data-slot="menu-wrapper" class="menuWrapper">
          <div data-slot="grid" class="grid">
            ${groups.map(
              (group) => html`
                <div
                  data-slot="group"
                  class=${group.variant === "muted"
                    ? "group groupMuted"
                    : "group"}
                >
                  <h3 data-slot="group-title" class="groupTitle">
                    ${group.title}
                  </h3>
                  <div class="linkList">
                    ${group.links.map(
                      (link, index) => html`
                        <a href=${link.href} data-slot="link" class="link">
                          <span class="linkTextOuter">
                            <span data-slot="link-text" class="linkText">
                              ${link.label}
                            </span>
                          </span>
                          <span
                            data-slot="link-underline"
                            class="underline"
                          ></span>
                        </a>
                        ${index < group.links.length - 1
                          ? html`<hr data-slot="divider" class="divider" />`
                          : null}
                      `,
                    )}
                  </div>
                </div>
              `,
            )}
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "motion-floating-menu": MotionFloatingMenu;
  }
}
