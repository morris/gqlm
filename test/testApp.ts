import * as bodyParser from 'body-parser';
import express from 'express';
import { GraphQLServer } from 'graphqlade';
import { AddressInfo } from 'net';

interface Contract {
  id: string;
}

interface Person {
  firstname: string;
  lastname: string;
  birthdate: string;
}

export async function createTestApp() {
  const customers = [
    {
      type: 'INDIVIDUAL',
      id: '4',
      name: 'Siegmeyer of Catarina',
      person: {
        firstname: 'Siegmeyer',
        lastname: 'of Catarina',
        birthdate: '2011-09-22',
      },
      contracts: [{ id: '41' }, { id: '42' }],
    },
    {
      type: 'COMPANY',
      id: '5',
      name: 'Blades of the Darkmoon',
      form: 'Covenant',
      employees: [
        {
          firstname: 'Dark Sun Gwyndolin',
          lastname: '?',
          birthdate: '2011-09-23',
        },
        {
          firstname: 'Darkmoon Knightess',
          lastname: '?',
          birthdate: '2011-09-24',
        },
      ],
      contracts: [{ id: '51' }, { id: '52' }, { id: '53' }],
    },
  ];

  const resolvers = {
    Query: {
      hello() {
        return 'Hello world!';
      },
      login(root: unknown, args: { username: string; password: string }) {
        if (args.username === 'artorias' && args.password === 'sif') {
          return true;
        } else {
          throw new Error('Invalid credentials');
        }
      },
      customers(
        root: unknown,
        args: { limit: number | undefined; offset: number | undefined }
      ) {
        return customers.slice(
          args.offset ?? 0,
          (args.offset ?? 0) + (args.limit ?? 10)
        );
      },
      customer(root: unknown, args: { id: string }) {
        const customer = customers.find((it) => it.id === args.id);
        if (!customer) {
          throw new Error('Not found');
        }
        return customer;
      },
      search(root: unknown, args: { q: string }) {
        const a = customers.filter((it) => {
          return it.id.match(args.q) || it.name.match(args.q);
        });

        const b = customers
          .reduce<Contract[]>((contracts, it) => {
            return contracts.concat(it.contracts);
          }, [])
          .filter((it) => {
            return it.id.match(args.q);
          })
          .map((it) => {
            return { ...it, type: 'CONTRACT' };
          });

        const c = customers
          .reduce<Person[]>((persons, it) => {
            return persons
              .concat(it.person ? [it.person] : [])
              .concat(it.employees || []);
          }, [])
          .filter((it) => {
            return (
              it.firstname.match(args.q) ||
              it.lastname.match(args.q) ||
              it.birthdate.match(args.q)
            );
          })
          .map((it) => {
            return { ...it, type: 'PERSON' };
          });

        return (a as unknown[]).concat(b).concat(c);
      },
    },
    Customer: {
      __resolveType(customer: { type: string }) {
        switch (customer.type) {
          case 'INDIVIDUAL':
            return 'Individual';
          case 'COMPANY':
            return 'Company';
        }
      },
    },
    Contract: {
      customer(contract: { id: string }) {
        return customers.find(
          (it) => it.contracts.map((c) => c.id).indexOf(contract.id) >= 0
        );
      },
    },
    SearchResult: {
      __resolveType(data: { type: string }) {
        switch (data.type) {
          case 'INDIVIDUAL':
            return 'Individual';
          case 'COMPANY':
            return 'Company';
          case 'CONTRACT':
            return 'Contract';
          case 'PERSON':
            return 'Person';
        }
      },
    },
  };

  const gqlServer = await GraphQLServer.bootstrap<0>({
    schema: 'test/fixtures',
    resolvers,
    createContext() {
      return 0;
    },
  });

  const app = express();

  app.post('/graphql', bodyParser.json(), gqlServer.http.expressHandler());

  const server = app.listen(4001, () => {
    console.log(
      `Test app listening on port ${(server.address() as AddressInfo).port}`
    );
  });

  return { server };
}

export function requireTestApp() {
  const ready = createTestApp();

  beforeAll(async () => {
    await ready;
  });

  afterAll(async () => {
    const { server } = await ready;

    server.close();
  });
}
