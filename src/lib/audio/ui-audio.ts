import { definePatch, ensureReady } from "@web-kits/audio";
import { _patch } from "../../../.web-kits/minimal";

const patch = definePatch(_patch);
const wiredElements = new WeakSet<HTMLElement>();
const lastPlayedAt = new Map<string, number>();

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

function unlockAudio() {
  if (isReady) return Promise.resolve();

  readyPromise ??= ensureReady()
    .then(() => {
      isReady = true;
    })
    .catch(() => {
      readyPromise = undefined;
    });

  return readyPromise;
}

function play(soundName: string, volume = 1) {
  if (!isReady) return;

  try {
    patch.play(soundName, {
      volume,
      jitter: { detune: 24, volume: 0.03 },
    });
  } catch {
    // Audio feedback should never block navigation or button actions.
  }
}

function playThrottled(soundName: string, key: string, intervalMs: number, volume = 1) {
  const now = performance.now();
  const last = lastPlayedAt.get(key) ?? 0;
  if (now - last < intervalMs) return;

  lastPlayedAt.set(key, now);
  play(soundName, volume);
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
    if (hoverSound) play(hoverSound, 0.65);
  });

  element.addEventListener("pointerdown", () => {
    void unlockAudio();
  });

  element.addEventListener("click", () => {
    const clickSound = inferClickSound(element);
    if (clickSound) {
      void unlockAudio().then(() => play(clickSound));
    }
  });

  wiredElements.add(element);
}

function wireAudioTargets(root: ParentNode = document) {
  root
    .querySelectorAll<HTMLElement>(audioTargetSelector)
    .forEach(wireElement);
}

wireAudioTargets();

document.addEventListener("astro:page-load", () => wireAudioTargets());

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
