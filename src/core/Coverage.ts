export interface Coverage {
  totalFields: number;
  discoveredFields: number;
  nonNullFields: number;
  types: Record<string, Record<string, [number, number]>>;
}
