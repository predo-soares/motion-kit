export class MotionBlocksError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "MotionBlocksError";
    this.code = code;
  }
}

export function isMotionBlocksError(error: unknown): error is MotionBlocksError {
  return error instanceof MotionBlocksError;
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
