import { createInterface } from "node:readline";

export function createYesNoPrompt(question: string, defaultNo = true): Promise<boolean> {
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
