import { GQLM } from '../../src/core/GQLM';
import { createTestApp } from '../testApp';

async function run() {
  const { server } = await createTestApp();

  await GQLM.run({
    url: 'http://localhost:4001/graphql',
    seed: 'test',
    count: 50,
  });

  server.close();
}

run();
