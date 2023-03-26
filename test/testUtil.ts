import { buildClientSchema } from 'graphql';
import { GQLM } from '../src/core/GQLM';
import { Options } from '../src/core/Options';
import { introspect } from '../src/util/introspect';

export async function createTestSession(options: Partial<Options> = {}) {
  const o = createTestOptions(options);

  return new GQLM(o, await createTestSchema(options));
}

export async function createTestSchema(options: Partial<Options> = {}) {
  const o = createTestOptions(options);

  return buildClientSchema(await introspect(o.url, o.requestInit));
}

export function createTestOptions(options: Partial<Options> = {}): Options {
  return {
    url: 'http://localhost:4001/graphql',
    count: 3,
    exit: false,
    //aliases: [],
    seed: '4',
    requestInit: {},
    input: {
      id: '6',
      q: 'Dark',
      username: ['artorias'],
      password: ['sif'],
    },
    ...options,
  };
}
