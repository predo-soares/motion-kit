import type { RegistryFile, RegistryItemType } from "../producer/types.js";
import type { MotionKitConfig } from "../config/types.js";

const DEFAULT_COMPONENT_PREFIXES = [
  "src/components/motion-kit",
  "src/lib/components/motion-kit",
];

const DEFAULT_HELPER_PREFIXES = [
  "src/lib/motion-kit",
  "src/utils/motion-kit",
  "src/lib/helpers",
];

function joinPosix(base: string, suffix: string): string {
  const normalizedBase = base.replace(/\\/g, "/").replace(/\/+$/, "");
  const normalizedSuffix = suffix.replace(/\\/g, "/").replace(/^\/+/, "");
  return normalizedSuffix ? `${normalizedBase}/${normalizedSuffix}` : normalizedBase;
}

function remapWithPrefixes(target: string, prefixes: string[], destination: string): string | null {
  const normalized = target.replace(/\\/g, "/");

  for (const prefix of prefixes) {
    if (normalized === prefix) {
      return destination;
    }
    if (normalized.startsWith(`${prefix}/`)) {
      return joinPosix(destination, normalized.slice(prefix.length + 1));
    }
  }

  return null;
}

export function resolveWriteTarget(
  file: RegistryFile,
  config: MotionKitConfig,
): string {
  if (file.asset === true) {
    return file.target.replace(/\\/g, "/");
  }

  const componentTarget = remapWithPrefixes(file.target, DEFAULT_COMPONENT_PREFIXES, config.componentsDir);
  if (componentTarget) {
    return componentTarget;
  }

  const helperTarget = remapWithPrefixes(file.target, DEFAULT_HELPER_PREFIXES, config.helpersDir);
  if (helperTarget) {
    return helperTarget;
  }

  if (file.type === "registry:lib") {
    const basename = file.target.replace(/\\/g, "/").split("/").pop();
    if (basename) {
      return joinPosix(config.helpersDir, basename);
    }
  }

  return file.target.replace(/\\/g, "/");
}

export function resolveWriteTargetLabel(fileType: RegistryItemType): string {
  if (fileType === "registry:lib") return "helper";
  if (fileType === "registry:file") return "asset";
  return "component";
}
