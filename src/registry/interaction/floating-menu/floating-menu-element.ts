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
      --ink: #0f172a;
      --ink-soft: #334155;
      --ink-muted: #94a3b8;
      --border: rgba(226, 232, 240, 0.9);
      --border-strong: rgba(203, 213, 225, 0.95);
      --surface: rgba(255, 255, 255, 0.94);
      --surface-strong: rgba(255, 255, 255, 0.99);
      --shadow:
        0 28px 90px rgba(15, 23, 42, 0.08),
        0 10px 30px rgba(15, 23, 42, 0.04);

      display: block;
      position: relative;
      width: 100%;
      min-height: 28rem;
      overflow: hidden;
      color: var(--ink);
      border-radius: 2rem;
      background: #f8fafc;
      font-family:
        "Open Runde",
        ui-sans-serif,
        system-ui,
        -apple-system,
        sans-serif;
    }

    * {
      box-sizing: border-box;
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
      border: 1px solid var(--border);
      border-radius: 1.75rem;
      background: var(--surface-strong);
      backdrop-filter: blur(20px);
      box-shadow: var(--shadow);
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

    /* ── Toggle ── */
    .toggleButton {
      position: relative;
      display: inline-flex;
      height: 2.25rem;
      width: 2.25rem;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      justify-self: start;
      border: 1px solid var(--border);
      border-radius: 0.625rem;
      background: rgba(241, 245, 249, 0.92);
      cursor: pointer;
      padding: 0;
      transition:
        background 0.2s,
        border-color 0.2s,
        transform 0.2s;
    }

    .toggleButton:hover {
      background: #fff;
      border-color: var(--border-strong);
      transform: translateY(-1px);
    }

    .toggleIcon {
      position: relative;
      display: flex;
      height: 2.25rem;
      width: 2.25rem;
      align-items: center;
      justify-content: center;
    }

    .toggleLine {
      position: absolute;
      height: 1px;
      width: 1rem;
      background: var(--ink);
      border-radius: 1px;
      transform-origin: center;
    }

    /* ── Logo ── */
    .logoWrap {
      position: relative;
      justify-self: center;
      pointer-events: none;
      min-width: 0;
      max-width: 100%;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      max-width: 100%;
      white-space: nowrap;
      color: var(--ink);
    }

    /* ── Actions ── */
    .actions {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      justify-self: end;
      min-width: 0;
    }

    .secondaryButton {
      display: none;
      height: 2.25rem;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 0 1rem;
      font-size: 0.8125rem;
      font-weight: 500;
      letter-spacing: -0.01em;
      text-decoration: none;
      color: var(--ink-soft);
      background: rgba(255, 255, 255, 0.78);
      white-space: nowrap;
      transition:
        background 0.2s,
        border-color 0.2s,
        color 0.2s,
        transform 0.2s;
    }

    .secondaryButton:hover {
      background: #fff;
      border-color: var(--border-strong);
      color: var(--ink);
      transform: translateY(-1px);
    }

    .primaryButton {
      display: inline-flex;
      height: 2.25rem;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(15, 23, 42, 0.9);
      border-radius: 999px;
      padding: 0 1rem;
      font-size: 0.8125rem;
      font-weight: 500;
      letter-spacing: -0.01em;
      text-decoration: none;
      background: rgba(15, 23, 42, 0.96);
      color: #fff;
      white-space: nowrap;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
      transition:
        background 0.2s,
        border-color 0.2s,
        transform 0.2s;
    }

    .primaryButton:hover {
      background: #1e293b;
      border-color: #1e293b;
      transform: translateY(-1px);
    }

    /* ── Menu panel ── */
    .menuWrapper {
      height: 0;
      width: 100%;
      overflow: hidden;
      opacity: 0;
      border-top: 1px solid var(--border);
      border-bottom-left-radius: 1.75rem;
      border-bottom-right-radius: 1.75rem;
      background: rgba(255, 255, 255, 0.92);
    }

    .grid {
      display: grid;
      grid-template-columns: 1fr;
      padding: 1.25rem 1.25rem 1.75rem;
    }

    /* ── Group ── */
    .group {
      display: flex;
      flex-direction: column;
      gap: 0.625rem;
      padding: 1rem 0;
      border-bottom: 1px solid var(--border);
    }

    .group.muted {
      opacity: 0.92;
    }

    .group:first-child {
      padding-top: 0;
    }

    .group:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    .groupHeader {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .groupNumber {
      font-size: 0.5625rem;
      font-weight: 500;
      letter-spacing: 0.1em;
      color: #cbd5e1;
    }

    .groupTitle {
      margin: 0;
      font-size: 0.625rem;
      font-weight: 500;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--ink-muted);
    }

    .group.muted .groupNumber {
      color: var(--ink-muted);
      opacity: 0.78;
    }

    .group.muted .groupTitle {
      color: var(--ink-soft);
      opacity: 0.72;
      font-weight: 600;
    }

    /* ── Links ── */
    .linkList {
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .link {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
      padding: 0.25rem 0;
      color: #475569;
      text-decoration: none;
      font-size: 1.375rem;
      font-weight: 500;
      letter-spacing: -0.03em;
      line-height: 1.15;
      transition:
        color 0.2s,
        transform 0.2s;
    }

    .group.muted .link {
      color: var(--ink-muted);
      font-weight: 450;
    }

    .link:hover {
      color: var(--ink);
      transform: translateX(3px);
    }

    .group.muted .link:hover {
      color: var(--ink-soft);
    }

    .linkTextOuter {
      position: relative;
      z-index: 10;
      display: block;
      line-height: 1.1;
      overflow: hidden;
      flex: 1;
      min-width: 0;
    }

    .linkText {
      display: block;
      white-space: nowrap;
    }

    .linkArrow {
      flex-shrink: 0;
      padding-left: 0.5rem;
      font-size: 0.625rem;
      letter-spacing: 0.06em;
      color: #cbd5e1;
      opacity: 0;
      transform: translateX(-4px);
      transition:
        opacity 0.2s,
        transform 0.2s,
        color 0.2s;
    }

    .link:hover .linkArrow {
      opacity: 1;
      transform: translateX(0);
      color: #94a3b8;
    }

    /* ── Responsive ── */
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
        grid-template-columns: repeat(3, minmax(0, 1fr));
        padding: 1.5rem 1.5rem 2rem;
      }

      .group {
        padding: 0 1.5rem 0 0;
        border-bottom: none;
        border-right: 1px solid var(--border);
      }

      .group:first-child {
        padding-left: 0;
        padding-top: 0;
      }

      .group:last-child {
        border-right: none;
        padding-right: 0;
        padding-left: 1.5rem;
      }

      .group:not(:first-child):not(:last-child) {
        padding-left: 1.5rem;
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
              (group, i) => html`
                <div
                  data-slot="group"
                  class=${`group${group.variant === "muted" ? " muted" : ""}`}
                >
                  <div class="groupHeader">
                    <span class="groupNumber"
                      >${String(i + 1).padStart(2, "0")}</span
                    >
                    <h3 class="groupTitle">${group.title}</h3>
                  </div>
                  <div class="linkList">
                    ${group.links.map(
                      (link) => html`
                        <a href=${link.href} data-slot="link" class="link">
                          <span class="linkTextOuter">
                            <span data-slot="link-text" class="linkText">
                              ${link.label}
                            </span>
                          </span>
                          <span class="linkArrow">↗</span>
                        </a>
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
