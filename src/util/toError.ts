export function toError<T = Record<string, never>>(err: unknown): Error & T {
  if (err instanceof Error) return err as Error & T;
  if (err && typeof err === 'object' && 'message' in err && 'stack' in err) {
    return err as Error & T;
  }

  return new Error(`Unknown error: ${err}`) as Error & T;
}
