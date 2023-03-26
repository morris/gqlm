export function asRecord<T>(data: unknown) {
  if (typeof data === 'object' && data) {
    return data as Record<string, T>;
  } else {
    throw new Error('Not a record');
  }
}
