import assert from "node:assert/strict";
import test from "node:test";

import { generateAssetPreview, generateUnifiedDiff } from "./write-preview.js";

// ---------------------------------------------------------------------------
// generateUnifiedDiff
// ---------------------------------------------------------------------------

test("generateUnifiedDiff returns null for identical strings", () => {
  const text = "line one\nline two\nline three\n";
  assert.equal(generateUnifiedDiff(text, text), null);
});

test("generateUnifiedDiff returns null for two empty strings", () => {
  assert.equal(generateUnifiedDiff("", ""), null);
});

test("generateUnifiedDiff returns a non-null string for changed text", () => {
  const existing = "line one\nline two\nline three\n";
  const incoming = "line one\nline TWO\nline three\n";
  const diff = generateUnifiedDiff(existing, incoming);
  assert.ok(diff !== null, "expected a diff string, got null");
});

test("generateUnifiedDiff output contains --- and +++ markers", () => {
  const existing = "alpha\nbeta\ngamma\n";
  const incoming = "alpha\nbeta changed\ngamma\n";
  const diff = generateUnifiedDiff(existing, incoming);
  assert.ok(diff !== null);
  assert.match(diff, /^---/m);
  assert.match(diff, /^\+\+\+/m);
});

test("generateUnifiedDiff output contains @@ hunk header", () => {
  const existing = "a\nb\nc\n";
  const incoming = "a\nB\nc\n";
  const diff = generateUnifiedDiff(existing, incoming);
  assert.ok(diff !== null);
  assert.match(diff, /^@@/m);
});

test("generateUnifiedDiff marks removed lines with - prefix", () => {
  const existing = "keep\nremove me\nkeep\n";
  const incoming = "keep\nkeep\n";
  const diff = generateUnifiedDiff(existing, incoming);
  assert.ok(diff !== null);
  assert.match(diff, /-remove me/);
});

test("generateUnifiedDiff marks added lines with + prefix", () => {
  const existing = "keep\nkeep\n";
  const incoming = "keep\nadded line\nkeep\n";
  const diff = generateUnifiedDiff(existing, incoming);
  assert.ok(diff !== null);
  assert.match(diff, /\+added line/);
});

test("generateUnifiedDiff handles completely different content", () => {
  const existing = "foo\nbar\n";
  const incoming = "baz\nqux\n";
  const diff = generateUnifiedDiff(existing, incoming);
  assert.ok(diff !== null);
  assert.match(diff, /-foo/);
  assert.match(diff, /\+baz/);
});

test("generateUnifiedDiff handles single-line change (no newline)", () => {
  const diff = generateUnifiedDiff("hello world", "hello earth");
  assert.ok(diff !== null);
  assert.match(diff, /-hello world/);
  assert.match(diff, /\+hello earth/);
});

// ---------------------------------------------------------------------------
// generateAssetPreview
// ---------------------------------------------------------------------------

test("generateAssetPreview returns object with all fields for a new asset", () => {
  const result = generateAssetPreview({
    sourceUrl: "https://example.com/assets/logo.png",
    incomingSize: 4096,
    changeKind: "new",
  });

  assert.equal(result.sourceUrl, "https://example.com/assets/logo.png");
  assert.equal(result.incomingSize, 4096);
  assert.equal(result.existingSize, undefined);
  assert.equal(result.changeKind, "new");
});

test("generateAssetPreview returns object with all fields for a replacement", () => {
  const result = generateAssetPreview({
    sourceUrl: "https://cdn.example.com/r/magnetic.wasm",
    incomingSize: 8192,
    existingSize: 7800,
    changeKind: "replace",
  });

  assert.equal(result.sourceUrl, "https://cdn.example.com/r/magnetic.wasm");
  assert.equal(result.incomingSize, 8192);
  assert.equal(result.existingSize, 7800);
  assert.equal(result.changeKind, "replace");
});

test("generateAssetPreview deep-equals the input options", () => {
  const opts = {
    sourceUrl: "file:///local/asset.png",
    incomingSize: 1024,
    existingSize: 512,
    changeKind: "replace" as const,
  };
  assert.deepEqual(generateAssetPreview(opts), opts);
});

test("generateAssetPreview omits existingSize when not provided", () => {
  const result = generateAssetPreview({
    sourceUrl: "https://example.com/new.png",
    incomingSize: 200,
    changeKind: "new",
  });
  assert.ok(!("existingSize" in result) || result.existingSize === undefined);
});
