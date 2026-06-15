import { definePatch, ensureReady } from "@web-kits/audio";
import { _patch } from "../../../.web-kits/minimal";

const patch = definePatch(_patch);
const wiredElements = new WeakSet<HTMLElement>();
const lastPlayedAt = new Map<string, number>();
const AUDIO_UNLOCKED_KEY = "motion-kit:audio-unlocked";

const audioTargetSelector = [
  "[data-audio-hover]",
  "[data-audio-click]",
  "[data-component-card] button",
  "[data-copy-text]",
  "[data-globe-focus]",
  "mk-slider",
  "mk-color",
  "mk-select",
  "mk-text-input",
  "mk-file-input",
].join(", ");

const cardActionSounds: Record<string, string> = {
  replay: "pop",
  fullscreen: "expand",
  "reset-props": "undo",
};

let isReady = false;
let readyPromise: Promise<void> | undefined;

function markAudioUnlocked() {
  try {
    sessionStorage.setItem(AUDIO_UNLOCKED_KEY, "1");
  } catch {
    // sessionStorage may be unavailable in private mode.
  }
}

function unlockAudio() {
  if (isReady) return Promise.resolve();

  readyPromise ??= ensureReady()
    .then(() => {
      isReady = true;
      markAudioUnlocked();
    })
    .catch(() => {
      readyPromise = undefined;
    });

  return readyPromise;
}

function playSound(soundName: string, volume = 1, allowBeforeReady = false) {
  if (!isReady && !allowBeforeReady) return;

  try {
    patch.play(soundName, {
      volume,
      jitter: { detune: 24, volume: 0.03 },
    });
  } catch {
    // Audio feedback should never block navigation or button actions.
  }
}

function playFromGesture(soundName: string, volume = 1) {
  void unlockAudio();
  playSound(soundName, volume, true);
}

function play(soundName: string, volume = 1) {
  playSound(soundName, volume);
}

function playThrottled(soundName: string, key: string, intervalMs: number, volume = 1) {
  const now = performance.now();
  const last = lastPlayedAt.get(key) ?? 0;
  if (now - last < intervalMs) return;

  lastPlayedAt.set(key, now);
  play(soundName, volume);
}

function isNavigationLink(element: HTMLElement) {
  if (!(element instanceof HTMLAnchorElement)) return false;
  if (!element.href || element.hasAttribute("download")) return false;
  if (element.target && element.target !== "_self") return false;
  if (element.getAttribute("href")?.startsWith("#")) return false;
  if (element.getAttribute("aria-disabled") === "true") return false;

  try {
    const url = new URL(element.href);
    if (url.origin !== window.location.origin) return false;

    const current = new URL(window.location.href);
    if (
      url.pathname === current.pathname &&
      url.search === current.search &&
      url.hash &&
      !url.search
    ) {
      return false;
    }

    return url.href !== current.href;
  } catch {
    return false;
  }
}

function inferClickSound(element: HTMLElement) {
  if (element.dataset.audioClick) return element.dataset.audioClick;
  if (element.dataset.copyText) return "copy";
  if (element.dataset.globeFocus) return "select";

  const cardAction = element.dataset.cardAction;
  if (cardAction) return cardActionSounds[cardAction] ?? "click";

  if (element.matches("mk-file-input")) return "select";
  if (element.matches("mk-select")) return "select";
  if (element.matches("mk-slider, mk-color")) return "tap";

  return undefined;
}

function inferHoverSound(element: HTMLElement) {
  if (element.dataset.audioHover) return element.dataset.audioHover;
  if (element.matches(audioTargetSelector)) return "hover";
  return undefined;
}

function inferInputSound(element: HTMLElement) {
  if (element.matches("mk-slider")) return { name: "slide", interval: 120, volume: 0.55 };
  if (element.matches("mk-text-input")) {
    return { name: "key-press", interval: 70, volume: 0.45 };
  }
  if (element.matches("mk-color")) return { name: "select", interval: 140, volume: 0.5 };
  if (element.matches("mk-select")) return { name: "tab-switch", interval: 120, volume: 0.7 };
  if (element.matches("mk-file-input")) return { name: "success", interval: 120, volume: 0.8 };

  return undefined;
}

function wireElement(element: HTMLElement) {
  if (wiredElements.has(element)) return;

  element.addEventListener("pointerenter", () => {
    const hoverSound = inferHoverSound(element);
    if (hoverSound) void unlockAudio().then(() => play(hoverSound, 0.65));
  });

  element.addEventListener("pointerdown", () => {
    if (!isNavigationLink(element)) {
      void unlockAudio();
      return;
    }

    const clickSound = inferClickSound(element);
    playFromGesture("page-exit");
    if (clickSound) playFromGesture(clickSound);
    markAudioUnlocked();
  });

  element.addEventListener("click", () => {
    if (isNavigationLink(element)) return;

    const clickSound = inferClickSound(element);
    if (clickSound) void unlockAudio().then(() => play(clickSound));
  });

  wiredElements.add(element);
}

function wireAudioTargets(root: ParentNode = document) {
  root
    .querySelectorAll<HTMLElement>(audioTargetSelector)
    .forEach(wireElement);
}

function restoreAudioUnlock() {
  try {
    if (sessionStorage.getItem(AUDIO_UNLOCKED_KEY) !== "1") return;
  } catch {
    return;
  }

  void unlockAudio().then(() => play("page-enter"));
}

function initAudio() {
  wireAudioTargets();
  restoreAudioUnlock();
}

initAudio();

document.addEventListener("astro:page-load", initAudio);

document.addEventListener("input", (event) => {
  const element = event.target;
  if (!(element instanceof HTMLElement)) return;

  const sound = inferInputSound(element);
  if (!sound) return;

  void unlockAudio().then(() => {
    playThrottled(
      sound.name,
      `${sound.name}:${element.tagName}:${element.dataset.attr ?? ""}`,
      sound.interval,
      sound.volume,
    );
  });
});
