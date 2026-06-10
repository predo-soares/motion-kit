import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { RegistryFile } from "../producer/types.js";
import type { MotionBlocksConfig } from "../config/types.js";
import type { Logger } from "../utils/logger.js";
import { MotionBlocksError } from "../utils/errors.js";
import { resolveWithinCwd } from "../utils/safe-path.js";
import { resolveWriteDecision } from "../utils/write-policy.js";
import { installDependencies, planDependencyInstall } from "./install-deps.js";
import { resolveAssetUrl, type ResolvedItemSource } from "./resolve-item.js";
import { resolveEffectiveConfig } from "./resolve-config.js";
import {
  mergeRegistryNpmDependencies,
  resolveRegistryInstallPlan,
} from "./resolve-registry-graph.js";
import { formatUsageOutput, resolveUsageSnippet } from "./resolve-usage.js";
import { resolveWriteTarget, resolveWriteTargetLabel } from "./resolve-target.js";
import { ensureExperimentalDecorators } from "./patch-tsconfig.js";
import { ensureReactJsxCustomElements } from "./patch-react-jsx-types.js";

export interface AddItemOptions {
  cwd: string;
  ref: string;
  dryRun: boolean;
  overwrite: boolean;
  noInstall: boolean;
  verbose: boolean;
  interactive: boolean;
  prompt: (target: string) => Promise<boolean>;
  confirm?: (command: string) => Promise<boolean>;
  logger: Logger;
}

export type WriteDecisionOutcome = "created" | "updated" | "skipped" | "identical";

export interface PlannedWrite {
  target: string;
  resolvedPath: string;
  kind: "code" | "asset";
  exists: boolean;
  source: string;
  itemName: string;
  decision: WriteDecisionOutcome;
}

export interface AddItemResult {
  itemName: string;
  source: string;
  writes: PlannedWrite[];
  dependencyPlan: ReturnType<typeof planDependencyInstall>;
  usage: ReturnType<typeof resolveUsageSnippet>;
  installOrder: string[];
}

async function fetchAssetBuffer(url: string): Promise<Buffer> {
  if (url.startsWith("file:")) {
    return readFile(fileURLToPath(url));
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new MotionBlocksError(
      `Failed to fetch asset from ${url}: ${response.status} ${response.statusText}\n\nNext: Check your network connection and the \`registry\` URL in motion-blocks.json.`,
      "asset_fetch_failed",
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function planFileWrite(
  file: RegistryFile,
  config: MotionBlocksConfig,
  cwd: string,
  resolved: ResolvedItemSource,
): Promise<PlannedWrite> {
  const target = resolveWriteTarget(file, config);
  const resolvedPath = resolveWithinCwd(cwd, target);
  const exists = existsSync(resolvedPath);

  if (file.asset === true) {
    const assetUrl = resolveAssetUrl(file.url!, resolved.origin);
    return {
      target,
      resolvedPath,
      kind: "asset",
      exists,
      source: assetUrl,
      itemName: resolved.item.name,
      decision: "created",
    };
  }

  return {
    target,
    resolvedPath,
    kind: "code",
    exists,
    source: resolved.source,
    itemName: resolved.item.name,
    decision: "created",
  };
}

function mapDecisionToOutcome(
  rawDecision: "write" | "skip" | "identical-skip",
  existed: boolean,
): WriteDecisionOutcome {
  if (rawDecision === "identical-skip") return "identical";
  if (rawDecision === "skip") return "skipped";
  return existed ? "updated" : "created";
}

async function writeCodeFile(
  write: PlannedWrite,
  content: string,
  fileType: RegistryFile["type"],
  options: Pick<AddItemOptions, "dryRun" | "overwrite" | "interactive" | "prompt" | "logger">,
): Promise<WriteDecisionOutcome> {
  const { dryRun, overwrite, interactive, prompt, logger } = options;

  const raw = await resolveWriteDecision({
    resolvedPath: write.resolvedPath,
    incomingContent: content,
    flags: { dryRun, overwrite, interactive },
    prompt,
  });

  const outcome = mapDecisionToOutcome(raw, write.exists);

  if (raw === "identical-skip") {
    logger.verbose(`identical, skipping ${write.target}`);
    return outcome;
  }

  if (raw === "skip") {
    logger.info(`skipped (conflict) ${write.target}`);
    return outcome;
  }

  if (dryRun) {
    const action = write.exists ? "would overwrite" : "would write";
    logger.info(`${action} ${resolveWriteTargetLabel(fileType)} file: ${write.target}`);
    return outcome;
  }

  await mkdir(dirname(write.resolvedPath), { recursive: true });
  await writeFile(write.resolvedPath, content, "utf-8");
  logger.info(`wrote ${write.target}`);
  return outcome;
}

async function copyAssetFile(
  write: PlannedWrite,
  options: Pick<AddItemOptions, "dryRun" | "overwrite" | "interactive" | "prompt" | "logger">,
): Promise<WriteDecisionOutcome> {
  const { dryRun, overwrite, interactive, prompt, logger } = options;

  let incomingBuffer: Buffer | undefined;
  if (write.exists) {
    incomingBuffer = await fetchAssetBuffer(write.source);
  }

  const raw = await resolveWriteDecision({
    resolvedPath: write.resolvedPath,
    incomingContent: incomingBuffer ?? Buffer.alloc(0),
    flags: { dryRun, overwrite, interactive },
    prompt,
  });

  const outcome = mapDecisionToOutcome(raw, write.exists);

  if (raw === "identical-skip") {
    logger.verbose(`identical asset, skipping ${write.target}`);
    return outcome;
  }

  if (raw === "skip") {
    logger.info(`skipped (conflict) asset: ${write.target}`);
    return outcome;
  }

  if (dryRun) {
    const action = write.exists ? "would overwrite asset" : "would copy asset";
    logger.info(`${action}: ${write.source} -> ${write.target}`);
    return outcome;
  }

  const buffer = incomingBuffer ?? (await fetchAssetBuffer(write.source));
  await mkdir(dirname(write.resolvedPath), { recursive: true });
  await writeFile(write.resolvedPath, buffer);
  logger.info(`copied asset -> ${write.target}`);
  return outcome;
}

async function installResolvedItem(
  resolved: ResolvedItemSource,
  config: MotionBlocksConfig,
  options: Pick<AddItemOptions, "cwd" | "dryRun" | "overwrite" | "interactive" | "prompt" | "logger">,
): Promise<PlannedWrite[]> {
  const { cwd, dryRun, overwrite, interactive, prompt, logger } = options;
  const { item } = resolved;

  logger.verbose(`installing registry item "${item.name}" from ${resolved.source}`);

  const writes = await Promise.all(
    item.files.map((file) => planFileWrite(file, config, cwd, resolved)),
  );

  if (writes.length === 0) {
    logger.warn(`item "${item.name}" has no files to install`);
  }

  for (let index = 0; index < item.files.length; index += 1) {
    const file = item.files[index]!;
    const write = writes[index]!;

    if (file.asset === true) {
      write.decision = await copyAssetFile(write, { dryRun, overwrite, interactive, prompt, logger });
      continue;
    }

    write.decision = await writeCodeFile(write, file.content!, file.type, {
      dryRun,
      overwrite,
      interactive,
      prompt,
      logger,
    });
  }

  return writes;
}

export async function addItems(options: AddItemOptions & { refs: string[] }): Promise<AddItemResult[]> {
  const { cwd, refs, dryRun, overwrite, noInstall, interactive, prompt, confirm, logger } = options;

  const config = await resolveEffectiveConfig(cwd);
  const plan = await resolveRegistryInstallPlan(refs, config, cwd);

  if (plan.installOrder.length > 0) {
    logger.info(`registry install order: ${plan.installOrder.join(" → ")}`);
  }

  const allWrites: PlannedWrite[] = [];

  for (const resolved of plan.items) {
    const writes = await installResolvedItem(resolved, config, {
      cwd,
      dryRun,
      overwrite,
      interactive,
      prompt,
      logger,
    });
    allWrites.push(...writes);
  }

  await ensureExperimentalDecorators({
    cwd,
    framework: config.framework,
    dryRun,
    logger,
  });

  if (config.framework === "react") {
    await ensureReactJsxCustomElements({
      cwd,
      dryRun,
      logger,
      items: plan.items.map(({ item }) => item),
    });
  }

  const npmDeps = mergeRegistryNpmDependencies(plan.items.map(({ item }) => item));
  const dependencyPlan = planDependencyInstall(
    npmDeps.dependencies,
    config.packageManager ?? "npm",
    npmDeps.devDependencies,
  );

  if (dependencyPlan) {
    await installDependencies(dependencyPlan, { cwd, dryRun, noInstall, confirm, logger });
  } else {
    logger.verbose("resolved registry tree has no npm dependencies");
  }

  const requestedNameSet = new Set(plan.requestedNames);
  const results: AddItemResult[] = [];

  for (const resolved of plan.items.filter(({ item }) => requestedNameSet.has(item.name))) {
    const usage = resolveUsageSnippet(resolved.item, config);
    if (usage) {
      logger.info(formatUsageOutput(usage));
      logger.verbose(`usage source: ${usage.source}`);
    }

    results.push({
      itemName: resolved.item.name,
      source: resolved.source,
      writes: allWrites.filter((write) => write.itemName === resolved.item.name),
      dependencyPlan,
      usage,
      installOrder: plan.installOrder,
    });
  }

  return results;
}

export async function addItem(options: AddItemOptions): Promise<AddItemResult> {
  const results = await addItems({ ...options, refs: [options.ref] });
  return results[0]!;
}
