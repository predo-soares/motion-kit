export class MotionKitError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "MotionKitError";
    this.code = code;
  }
}

export function isMotionKitError(error: unknown): error is MotionKitError {
  return error instanceof MotionKitError;
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
