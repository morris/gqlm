export function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (err && typeof err === 'object' && 'message' in err && 'stack' in err) {
    return err as Error;
  }

  return new Error(`Unknown error: ${err}`);
}
