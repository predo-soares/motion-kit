/**
 * Utilities for generating read-only previews of pending file changes.
 * Nothing in this module writes to disk.
 */

export interface AssetPreviewOptions {
  sourceUrl: string;
  incomingSize: number;
  existingSize?: number;
  changeKind: "new" | "replace";
}

export interface AssetPreview {
  sourceUrl: string;
  incomingSize: number;
  existingSize?: number;
  changeKind: "new" | "replace";
}

/**
 * Generates a unified diff string between `existing` and `incoming` text.
 * Returns `null` when the two strings are identical (no diff to show).
 */
export function generateUnifiedDiff(existing: string, incoming: string): string | null {
  if (existing === incoming) {
    return null;
  }

  const existingLines = splitDiffLines(existing);
  const incomingLines = splitDiffLines(incoming);

  const lcs = buildLcs(existingLines, incomingLines);
  const hunks = buildHunks(existingLines, incomingLines, lcs);

  if (hunks.length === 0) {
    return null;
  }

  const header = `--- existing\n+++ incoming\n`;
  return header + hunks.join("\n");
}

function splitDiffLines(content: string): string[] {
  if (content === "") {
    return [];
  }

  return content.replace(/\n+$/, "").split("\n");
}

/**
 * Returns structured asset preview metadata. This is a pure data function —
 * no I/O is performed.
 */
export function generateAssetPreview(opts: AssetPreviewOptions): AssetPreview {
  return {
    sourceUrl: opts.sourceUrl,
    incomingSize: opts.incomingSize,
    existingSize: opts.existingSize,
    changeKind: opts.changeKind,
  };
}

// ---------------------------------------------------------------------------
// Internal unified-diff helpers
// ---------------------------------------------------------------------------

/**
 * Builds the longest-common-subsequence table for two line arrays.
 * Returns a 2-D array where `lcs[i][j]` is the LCS length of the first `i`
 * lines of `a` and the first `j` lines of `b`.
 */
function buildLcs(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const table: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        table[i]![j] = table[i - 1]![j - 1]! + 1;
      } else {
        table[i]![j] = Math.max(table[i - 1]![j]!, table[i]![j - 1]!);
      }
    }
  }

  return table;
}

type DiffKind = "context" | "remove" | "add";

interface DiffLine {
  kind: DiffKind;
  line: string;
  /** 1-based line number in the `a` (existing) file, or undefined for additions. */
  aLine?: number;
  /** 1-based line number in the `b` (incoming) file, or undefined for removals. */
  bLine?: number;
}

/**
 * Iteratively traces back through the LCS table and produces an ordered list
 * of diff operations (context / remove / add).
 */
function buildDiffLines(a: string[], b: string[], lcs: number[][]): DiffLine[] {
  // Walk the LCS table from the bottom-right to the top-left, collecting
  // decisions into a stack, then reverse to get forward order.
  type Op = { kind: "context"; ai: number; bi: number } | { kind: "add"; bi: number } | { kind: "remove"; ai: number };
  const stack: Op[] = [];

  let ci = a.length;
  let cj = b.length;

  while (ci > 0 || cj > 0) {
    if (ci > 0 && cj > 0 && a[ci - 1] === b[cj - 1]) {
      stack.push({ kind: "context", ai: ci, bi: cj });
      ci -= 1;
      cj -= 1;
    } else if (cj > 0 && (ci === 0 || lcs[ci]![cj - 1]! >= lcs[ci - 1]![cj]!)) {
      stack.push({ kind: "add", bi: cj });
      cj -= 1;
    } else {
      stack.push({ kind: "remove", ai: ci });
      ci -= 1;
    }
  }

  stack.reverse();

  return stack.map((op) => {
    if (op.kind === "context") {
      return { kind: "context" as const, line: a[op.ai - 1]!, aLine: op.ai, bLine: op.bi };
    }
    if (op.kind === "add") {
      return { kind: "add" as const, line: b[op.bi - 1]!, bLine: op.bi };
    }
    return { kind: "remove" as const, line: a[op.ai - 1]!, aLine: op.ai };
  });
}

const CONTEXT_LINES = 3;

/**
 * Groups diff lines into unified-diff hunk strings.
 */
function buildHunks(a: string[], b: string[], lcs: number[][]): string[] {
  const diffLines = buildDiffLines(a, b, lcs);

  if (diffLines.length === 0) {
    return [];
  }

  // Identify the indices of changed lines (non-context).
  const changedIndices: number[] = [];
  for (let i = 0; i < diffLines.length; i += 1) {
    if (diffLines[i]!.kind !== "context") {
      changedIndices.push(i);
    }
  }

  if (changedIndices.length === 0) {
    return [];
  }

  // Build hunk ranges by grouping nearby changes.
  const ranges: Array<{ start: number; end: number }> = [];
  let hunkStart = Math.max(0, changedIndices[0]! - CONTEXT_LINES);
  let hunkEnd = Math.min(diffLines.length - 1, changedIndices[0]! + CONTEXT_LINES);

  for (let k = 1; k < changedIndices.length; k += 1) {
    const idx = changedIndices[k]!;
    const gapStart = Math.max(0, idx - CONTEXT_LINES);
    const nextEnd = Math.min(diffLines.length - 1, idx + CONTEXT_LINES);

    if (gapStart <= hunkEnd + 1) {
      // Overlapping or adjacent — extend the current hunk.
      hunkEnd = nextEnd;
    } else {
      ranges.push({ start: hunkStart, end: hunkEnd });
      hunkStart = gapStart;
      hunkEnd = nextEnd;
    }
  }
  ranges.push({ start: hunkStart, end: hunkEnd });

  return ranges.map(({ start, end }) => {
    const slice = diffLines.slice(start, end + 1);

    // Compute hunk header numbers.
    const firstA = slice.find((dl) => dl.aLine !== undefined)?.aLine ?? start + 1;
    const firstB = slice.find((dl) => dl.bLine !== undefined)?.bLine ?? start + 1;
    const aCount = slice.filter((dl) => dl.kind !== "add").length;
    const bCount = slice.filter((dl) => dl.kind !== "remove").length;

    const header = `@@ -${firstA},${aCount} +${firstB},${bCount} @@`;
    const body = slice
      .map((dl) => {
        if (dl.kind === "add") return `+${dl.line}`;
        if (dl.kind === "remove") return `-${dl.line}`;
        return ` ${dl.line}`;
      })
      .join("\n");

    return `${header}\n${body}`;
  });
}
