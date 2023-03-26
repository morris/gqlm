# gqlm

A framework for fully automatic monkey testing of GraphQL APIs.
Explores GraphQL schemas with almost zero human input,
discovering bugs, edge cases, and security leaks.

## Installation

In an existing Node.js project:

```sh
npm install gqlm
```

Or, if you want to set up a new project just for running tests on an API,
create a new directory and inside that directory, run:

```sh
npm init -y
npm install gqlm
```

## Usage

Create a file `test.gqlm.mjs` with the following contents:

```ts
import { GQLM } from 'gqlm';

GQLM.run({
  url: 'https://my.graphql.api/graphql',
  count: 5,
});
```

Then, run `node test.gqlm.mjs`.
This will start automatic, explorative testing of your API with up to 5 requests.

- Test results with requests and responses are written to `__gqlm__/<n>.mjs`.
- Collected memory is written to `__gqlm__/memory.mjs`.
- Inspect these files to determine fitness. A good idea is

## Authentication

For secured GraphQL APIs, you are free to authenticate in any way
and pass headers to the GQLM options. For example:

```ts
import { GQLM } from 'gqlm';

async function run() {
  const authResponse = await fetch('https://my.oauth.api/token', {
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'password',
      username: 'foo',
      password: 'bar',
    }),
  });

  const { access_token } = await authResponse.json();

  await GQLM.run({
    url: 'https://my.graphql.api/graphql',
    requestInit: {
      headers: {
        authorization: `Bearer ${access_token}`,
      },
    },
    count: 5,
  });
}
```

## Options

GQLM accepts the following options:

- `url: string` | URL of GraphQL API to test
- `count: number` | Maximum number of requests to run
- `requestInit?: RequestInit` | Additional parameters for fetch(), e.g. headers
- `seed?: string` | Seed for randomization; if set, GQLM will behave deterministically
- `input?: Record<string, unknown>` | Map of initial data for generating inputs.
- `exit?: boolean` | Should GQLM exit on the first failed request?
- `isFailure?: (result: ExecutionResult) => boolean` | Callback to determine whether a GraphQL result is considered a failure.
- `outDir?: string` | Output directory; defaults to `__gqlm__`.

## Advanced Usage

Expanding the pattern for authentication above,
it's possible to design arbitrary environments around GQLM, e.g.

- starting a local server to test,
- seeding data,
- running with multiple users of different access levels,
- load testing,
- etc.

## Mutations

Currently, only GraphQL queries are supported. Mutations need some discovery
as to how to test them safely and make the results useful. PRs welcome!

## TypeScript

Test files can also be written in TypeScript (`.ts` extension).
Just install and use `ts-node` instead of `node`.

```

```