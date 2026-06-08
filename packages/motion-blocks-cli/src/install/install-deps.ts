import { spawn } from "node:child_process";

import type { PackageManager } from "../config/types.js";
import { getAddCommand } from "../detection/detect-pm.js";
import type { Logger } from "../utils/logger.js";
import { MotionBlocksError } from "../utils/errors.js";

export interface DependencyInstallPlan {
  dependencies: string[];
  devDependencies: string[];
  command: string;
}

export function planDependencyInstall(
  dependencies: string[] | undefined,
  packageManager: PackageManager,
  devDependencies: string[] | undefined = [],
): DependencyInstallPlan | null {
  const deps = [...new Set((dependencies ?? []).filter(Boolean))];
  const devDeps = [...new Set((devDependencies ?? []).filter(Boolean))];

  if (deps.length === 0 && devDeps.length === 0) {
    return null;
  }

  const parts: string[] = [];
  if (deps.length > 0) {
    parts.push(getAddCommand(packageManager, deps.join(" ")));
  }
  if (devDeps.length > 0) {
    parts.push(getAddCommand(packageManager, devDeps.join(" "), ["-D"]));
  }

  return {
    dependencies: deps,
    devDependencies: devDeps,
    command: parts.join(" && "),
  };
}

function runCommand(command: string, cwd: string, logger: Logger): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    logger.verbose(`running: ${command}`);
    const child = spawn(command, {
      cwd,
      stdio: "inherit",
      shell: true,
    });

    child.on("error", (error) => {
      reject(
        new MotionBlocksError(
          `Failed to run "${command}": ${error.message}\n\nNext: Run the command manually, or retry with \`--no-install\` and install dependencies yourself.`,
          "install_failed",
        ),
      );
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(
        new MotionBlocksError(
          `Dependency install failed with exit code ${code}: ${command}\n\nNext: Fix the package manager error above, or retry with \`--no-install\` and run the command manually.`,
          "install_failed",
        ),
      );
    });
  });
}

export async function installDependencies(
  plan: DependencyInstallPlan,
  options: {
    cwd: string;
    dryRun: boolean;
    noInstall: boolean;
    logger: Logger;
  },
): Promise<void> {
  const { cwd, dryRun, noInstall, logger } = options;

  if (dryRun) {
    const depSummary = [
      plan.dependencies.length > 0 ? `dependencies: ${plan.dependencies.join(", ")}` : null,
      plan.devDependencies.length > 0 ? `devDependencies: ${plan.devDependencies.join(", ")}` : null,
    ].filter(Boolean).join("; ");
    logger.info(`would install ${depSummary}`);
    logger.info(`would run: ${plan.command}`);
    return;
  }

  if (noInstall) {
    const depSummary = [
      plan.dependencies.length > 0 ? `dependencies: ${plan.dependencies.join(", ")}` : null,
      plan.devDependencies.length > 0 ? `devDependencies: ${plan.devDependencies.join(", ")}` : null,
    ].filter(Boolean).join("; ");
    logger.info(depSummary);
    logger.info(`run manually: ${plan.command}`);
    return;
  }

  logger.info(`installing ${[
    plan.dependencies.length > 0 ? plan.dependencies.join(", ") : null,
    plan.devDependencies.length > 0 ? `dev: ${plan.devDependencies.join(", ")}` : null,
  ].filter(Boolean).join("; ")}`);
  await runCommand(plan.command, cwd, logger);
}
