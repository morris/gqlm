import { Memory } from '../../src/memory/Memory';
import { recordToMap } from '../../src/util/recordToMap';

describe('A memory object', () => {
  it('should allow storing and querying data', () => {
    const memory = new Memory({
      tokenize(key) {
        return [key];
      },
      fuzzify(key, weight, target) {
        target.set(key, weight);
      },
    });

    memory.store(4, recordToMap({ id: 1, customer: 1 }));

    memory.store(5, recordToMap({ id: 1, contract: 1 }));
    memory.store(5, recordToMap({ id: 1, contract: 1 }));

    expect(memory.query(recordToMap({ id: 0.5 }))).toEqual([
      { value: 4, score: 0.5 },
      { value: 5, score: 0.5 },
    ]);

    expect(memory.query(recordToMap({ id: 0.5, contract: 0.25 }))).toEqual([
      { value: 4, score: 0.5 },
      { value: 5, score: 0.75 },
    ]);

    expect(
      memory.query(
        recordToMap({
          id: 0.5,
          contract: 0.25,
          customer: 0.5,
          foo: 1,
        })
      )
    ).toEqual([
      { value: 4, score: 1 },
      { value: 5, score: 0.75 },
    ]);

    expect(memory.serialize()).toEqual([
      {
        value: 4,
        assoc: [
          ['id', 1],
          ['customer', 1],
        ],
      },
      {
        value: 5,
        assoc: [
          ['id', 1],
          ['contract', 1],
        ],
      },
    ]);
  });
});
