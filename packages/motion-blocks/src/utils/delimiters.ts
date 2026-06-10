export function findMatchingDelimiter(
  content: string,
  startIndex: number,
  openChar: string,
  closeChar: string,
): number {
  let depth = 0;
  let quote: string | null = null;
  let escaped = false;
  let inSingleLineComment = false;
  let inMultiLineComment = false;

  for (let index = startIndex; index < content.length; index += 1) {
    const char = content[index]!;
    const nextChar = content[index + 1];

    // Handle single-line comments (// to newline)
    if (!inSingleLineComment && !inMultiLineComment && !quote && char === "/" && nextChar === "/") {
      inSingleLineComment = true;
      index += 1;
      continue;
    }

    if (inSingleLineComment) {
      if (char === "\n") {
        inSingleLineComment = false;
      }
      continue;
    }

    // Handle multi-line comments (/* to */)
    if (!inMultiLineComment && !quote && char === "/" && nextChar === "*") {
      inMultiLineComment = true;
      index += 1;
      continue;
    }

    if (inMultiLineComment) {
      if (char === "*" && nextChar === "/") {
        inMultiLineComment = false;
        index += 1;
      }
      continue;
    }

    // Handle quotes
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
