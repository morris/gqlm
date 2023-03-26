import { getNamedType, parse, print } from 'graphql';
import { Endpoint } from '../../src/core/Endpoint';
import { recordToMap } from '../../src/util/recordToMap';
import { requireTestApp } from '../testApp';
import { createTestSession } from '../testUtil';

describe('Session', () => {
  requireTestApp();

  it('should be able to generate operations for endpoints', async () => {
    const session = await createTestSession({ input: {} });

    const endpoint = session.endpoints.find(
      (it) => it.field.name === 'customer'
    );

    if (!endpoint) throw new Error('No endpoint found for field "customer"');

    expect(print(session.generateEndpointOperation(endpoint))).toEqual(
      print(
        parse(`{
          customer(id: "Fetuto ezuc tocop zikog.") {
            ... on Individual {
              id
              type
              name
            }
            ... on Company {
              id
              type
              name
              form
            }
            __typename
          }
        }`)
      )
    );

    session.memory.store('4', recordToMap({ id: 1 }));

    expect(print(session.generateEndpointOperation(endpoint))).toEqual(
      print(
        parse(`{
          customer(id: "4") {
            ... on Individual {
              id
              type
              name
            }
            ... on Company {
              id
              type
              name
              form
            }
            __typename
          }
        }`)
      )
    );
  });

  it('should be able to generate operations for endpoints (2)', async () => {
    const session = await createTestSession({ input: {} });

    const endpoint = session.endpoints.find(
      (it) => it.field.name === 'customers'
    );

    if (!endpoint) throw new Error('No endpoint found for field "customers"');

    expect(print(session.generateEndpointOperation(endpoint))).toEqual(
      print(
        parse(`{
          customers(limit: 17) {
            ... on Individual {
              id
              type
              name
            }
            ... on Company {
              id
              type
              name
              form
            }
            __typename
          }
        }`)
      )
    );
  });

  it('should be able to determine if a field can be guessed', async () => {
    const session = await createTestSession({ input: {} });

    const endpoint = session.endpoints.find(
      (it) => it.field.name === 'login'
    ) as Endpoint;

    expect(session.canGuessField(endpoint.field)).toEqual(0);

    session.memory.store('siegmeyer', recordToMap({ username: 0.2 }));
    session.memory.store('catarina', recordToMap({ password: 0.4 }));

    expect(session.canGuessField(endpoint.field).toFixed(2)).toEqual('0.20');
  });

  it('should be able to determine if a field can be guessed (2)', async () => {
    const session = await createTestSession({ input: {} });

    const endpoint = session.endpoints.find(
      (it) => it.field.name === 'customer'
    ) as Endpoint;

    expect(session.canGuessField(endpoint.field)).toEqual(0);

    session.memory.store('4', recordToMap({ id: 0.2, 'customer id': 0.7 }));

    expect(session.canGuessField(endpoint.field).toFixed(2)).toEqual('0.90');
  });

  it('should build correct memory operations for inputs', async () => {
    const session = await createTestSession({ input: {} });

    const endpoint = session.endpoints.find(
      (it) => it.field.name === 'customer'
    ) as Endpoint;

    expect(
      Array.from(
        session
          .buildAssocForInput(
            getNamedType(endpoint.field.args[0].type),
            endpoint.field.args[0],
            [],
            endpoint.field
          )
          .entries()
      )
    ).toEqual([
      ['id', 1],
      ['ID', 0.5],
      ['customer id', 1],
    ]);
  });

  it('should be able to run tests', async () => {
    const session = await createTestSession({
      input: {
        username: 'artorias',
        password: 'sif',
      },
      count: 1,
    });

    for (let i = 0; i < 100; ++i) {
      await session.run();
    }

    console.log(
      session.endpoints.map((it) => ({
        id: it.getId(),
        rank: session.getRank(it),
        nn: it.getNonNullResults().length,
      }))
    );

    for (const result of session.getResults()) {
      expect(result.requestError).toBeUndefined();
    }
  });
});
