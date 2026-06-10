export function findMatchingDelimiter(
  content: string,
  startIndex: number,
  openChar: string,
  closeChar: string,
): number {
  let depth = 0;
  let quote: string | null = null;
  let escaped = false;

  for (let index = startIndex; index < content.length; index += 1) {
    const char = content[index]!;

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === openChar) {
      depth += 1;
      continue;
    }

    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}
