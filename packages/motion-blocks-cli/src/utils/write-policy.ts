import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

export type WriteDecision = "write" | "skip" | "identical-skip";

export interface ResolveWriteDecisionOptions {
  resolvedPath: string;
  incomingContent: Buffer | string;
  flags: {
    dryRun: boolean;
    overwrite: boolean;
    interactive: boolean;
  };
  prompt: (target: string) => Promise<boolean>;
}

/**
 * Centralises the per-file write decision.
 *
 * Decision tree (in evaluation order):
 *  1. File does not exist           → "write"          (no prompt)
 *  2. --overwrite flag              → "write"          (no prompt)
 *  3. Incoming content identical    → "identical-skip" (no prompt)
 *  4. --dry-run flag                → "write"          (no prompt; caller logs, doesn't write)
 *  5. Non-interactive + conflict    → "skip"           (no prompt)
 *  6. Interactive + conflict        → call prompt → "write" | "skip"
 */
export async function resolveWriteDecision(opts: ResolveWriteDecisionOptions): Promise<WriteDecision> {
  const { resolvedPath, incomingContent, flags, prompt } = opts;

  // 1. File doesn't exist → always write
  if (!existsSync(resolvedPath)) {
    return "write";
  }

  // 2. --overwrite → write without prompting
  if (flags.overwrite) {
    return "write";
  }

  // 3. Identical content → silently skip
  const existingContent = await readFile(resolvedPath);
  const incomingBuffer =
    typeof incomingContent === "string"
      ? Buffer.from(incomingContent, "utf-8")
      : incomingContent;

  if (existingContent.equals(incomingBuffer)) {
    return "identical-skip";
  }

  // 4. --dry-run → treat as write (caller logs but doesn't write)
  if (flags.dryRun) {
    return "write";
  }

  // 5. Non-interactive + conflict → skip without prompting
  if (!flags.interactive) {
    return "skip";
  }

  // 6. Interactive + conflict → ask the user
  const confirmed = await prompt(resolvedPath);
  return confirmed ? "write" : "skip";
}
