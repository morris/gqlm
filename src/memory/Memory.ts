import { sum } from '../util/sum';

export type MemoryAssoc = Map<string, number>;

export interface MemoryOptions {
  tokenize: MemoryTokenizer;
  fuzzify: MemoryFuzzifier;
}

export type MemoryTokenizer = (key: string) => string[];

export type MemoryFuzzifier = (
  key: string,
  weight: number,
  target: MemoryAssoc
) => void;

export interface MemoryEntry {
  value: string | number;
  assoc: MemoryAssoc;
}

export interface MemoryResult {
  value: string | number;
  score: number;
}

export interface SerializedMemoryEntry {
  value: string | number;
  assoc: [string, number][];
}

/**
 * Associative fuzzy memory
 */
export class Memory {
  protected tokenize: MemoryTokenizer;
  protected fuzzify: MemoryFuzzifier;
  protected map = new Map<string, MemoryEntry[]>();
  protected guards = new Set<string>();

  constructor({ tokenize, fuzzify }: MemoryOptions) {
    this.tokenize = tokenize;
    this.fuzzify = fuzzify;
  }

  store(value: string | number, assoc: MemoryAssoc) {
    const guardKeyParts = [];

    for (const [key, weight] of assoc) {
      guardKeyParts.push(`${key}:${weight}`);
    }

    const guardKey = `${value}@${guardKeyParts.join(',')}`;

    if (this.guards.has(guardKey)) return;

    this.guards.add(guardKey);

    const entry: MemoryEntry = { value, assoc };

    for (const token of this.tokenizeAssoc(assoc)) {
      const entries = this.map.get(token);

      if (entries) {
        entries.push(entry);
      } else {
        this.map.set(token, [entry]);
      }
    }
  }

  query(assoc: MemoryAssoc) {
    const results: MemoryResult[] = [];
    const visitedEntries = new Set<MemoryEntry>();

    for (const token of this.tokenizeAssoc(assoc)) {
      const entries = this.map.get(token);

      if (entries) {
        for (const entry of entries) {
          if (!visitedEntries.has(entry)) {
            visitedEntries.add(entry);
            const score = this.assocScore(assoc, entry.assoc);
            if (score > 0) {
              results.push({
                value: entry.value,
                score: this.assocScore(assoc, entry.assoc),
              });
            }
          }
        }
      }
    }

    return results;
  }

  protected assocScore(a: MemoryAssoc, b: MemoryAssoc) {
    let score = 0;

    const fa = this.fuzzifyAssoc(a);
    const fb = this.fuzzifyAssoc(b);

    if (fa.size <= fb.size) {
      for (const [key, weight] of fa) {
        score += weight * (fb.get(key) || 0);
      }
    } else {
      for (const [key, weight] of fb) {
        score += weight * (fa.get(key) || 0);
      }
    }

    return score;
  }

  protected tokenizeAssoc(assoc: MemoryAssoc) {
    const tokens = new Set<string>();

    for (const [key] of assoc) {
      for (const token of this.tokenize(key)) {
        if (token === '') {
          throw new Error('Memory tokenizer must not return an empty string');
        }

        tokens.add(token);
      }
    }

    return tokens;
  }

  protected fuzzifyAssoc(assoc: MemoryAssoc) {
    const result: MemoryAssoc = new Map();

    for (const [key, weight] of assoc) {
      this.fuzzify(key, weight, result);
    }

    return result;
  }

  serialize() {
    const map = new Map<string | number, MemoryAssoc[]>();
    const guard = new Set<MemoryAssoc>();

    for (const entries of this.map.values()) {
      for (const { value, assoc } of entries) {
        if (guard.has(assoc)) continue;
        guard.add(assoc);

        const assocs = map.get(value);

        if (assocs) {
          assocs.push(assoc);
        } else {
          map.set(value, [assoc]);
        }
      }
    }

    const serialized: SerializedMemoryEntry[] = [];

    for (const [value, assocs] of map) {
      serialized.push({ value, assoc: this.serializeAssocs(assocs) });
    }

    return serialized;
  }

  protected serializeAssocs(assocs: MemoryAssoc[]) {
    const map = new Map<string, number[]>();

    for (const assoc of assocs) {
      for (const [key, weight] of assoc) {
        const weights = map.get(key);

        if (weights) {
          weights.push(weight);
        } else {
          map.set(key, [weight]);
        }
      }
    }

    const serialized: [string, number][] = [];

    for (const [key, weights] of map) {
      serialized.push([key, sum(weights)]);
    }

    return serialized;
  }
}
