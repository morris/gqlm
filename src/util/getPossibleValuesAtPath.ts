import { asRecord } from './asRecord';

export function getPossibleValuesAtPath(
  data: unknown,
  path: string[]
): unknown[] {
  if (data === null || typeof data === 'undefined') {
    return [];
  } else if (Array.isArray(data)) {
    return data.flatMap((it) => getPossibleValuesAtPath(it, path));
  } else if (path.length === 0) {
    return [data];
  } else if (typeof data === 'object') {
    return getPossibleValuesAtPath(asRecord(data)[path[0]], path.slice(1));
  } else {
    return [];
  }
}
