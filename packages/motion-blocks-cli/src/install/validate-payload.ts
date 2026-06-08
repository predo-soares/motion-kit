import type { RegistryFile, RegistryItem } from "../producer/types.js";
import { MotionBlocksError } from "../utils/errors.js";

const ITEM_TYPES = ["registry:component", "registry:lib", "registry:file"];
const REQUIRED_TOP_LEVEL = ["name", "type", "title", "description", "files"] as const;
const REQUIRED_FILE_FIELDS = ["path", "type", "target"] as const;

function validateFile(entry: RegistryFile, index: number, report: (message: string) => void): void {
  for (const field of REQUIRED_FILE_FIELDS) {
    if (!(field in entry)) {
      report(`files[${index}] missing required field "${field}"`);
    }
  }

  if (entry.asset === true) {
    if (!entry.url) {
      report(`files[${index}] has "asset" but no "url"`);
    }
    if ("content" in entry) {
      report(`files[${index}] has "asset" and inlined "content" (assets must use url)`);
    }
    return;
  }

  if (!entry.content) {
    report(`files[${index}] missing "content" for text/code file`);
  }
}

export function validateConsumerPayload(item: RegistryItem, source: string): void {
  const issues: string[] = [];
  const report = (message: string) => issues.push(message);

  for (const field of REQUIRED_TOP_LEVEL) {
    if (!(field in item)) {
      report(`missing required field "${field}"`);
    }
  }

  if ("type" in item && !ITEM_TYPES.includes(item.type)) {
    report(`unknown type "${item.type}"`);
  }

  if (!Array.isArray(item.files) || item.files.length === 0) {
    report(`"files" must be a non-empty array`);
  } else {
    item.files.forEach((entry, index) => validateFile(entry, index, report));
  }

  if (item.type === "registry:component") {
    if (!Array.isArray(item.usage) || item.usage.length === 0) {
      report(`registry:component "${item.name}" must include a non-empty "usage" array`);
    }
  }

  if (issues.length > 0) {
    throw new MotionBlocksError(
      `Invalid registry item from ${source}:\n${issues.map((issue) => `  - ${issue}`).join("\n")}\n\nNext: This is a registry producer issue. Run \`motion-blocks build --check\` from the Motion Blocks repo to validate source manifests.`,
      "invalid_payload",
    );
  }
}
