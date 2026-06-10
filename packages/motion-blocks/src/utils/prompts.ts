import { createInterface } from "node:readline";

export function createYesNoPrompt(question: string, defaultNo = true): Promise<boolean> {
  // In non-interactive environments (CI, piped stdin), return default immediately
  if (!process.stdin.isTTY) {
    return Promise.resolve(!defaultNo);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();

      if (trimmed === "") {
        resolve(!defaultNo);
        return;
      }

      resolve(trimmed === "y" || trimmed === "yes");
    });
  });
}
