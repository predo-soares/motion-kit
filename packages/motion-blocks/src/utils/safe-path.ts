import { isAbsolute, relative, resolve } from "node:path";

import { MotionBlocksError } from "./errors.js";

/**
 * Resolves `target` against `cwd` and rejects any path that would escape it,
 * so install/init commands can never write outside the project they target.
 */
export function resolveWithinCwd(cwd: string, target: string): string {
  const resolved = resolve(cwd, target);
  const fromCwd = relative(cwd, resolved);

  if (fromCwd === "" || fromCwd.startsWith("..") || isAbsolute(fromCwd)) {
    throw new MotionBlocksError(
      `Refusing to write outside of "${cwd}": "${target}"\n\nNext: Report this registry item — its \`target\` path must stay inside your project.`,
      "unsafe_path",
    );
  }

  return resolved;
}
