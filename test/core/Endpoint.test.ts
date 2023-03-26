import { assertObjectType } from 'graphql';
import { Endpoint } from '../../src/core/Endpoint';
import { Result } from '../../src/core/Result';
import { requireTestApp } from '../testApp';
import { createTestSchema } from '../testUtil';

describe('Endpoint', () => {
  requireTestApp();

  it('should have IDs and be able to compute their non-null results', async () => {
    const schema = await createTestSchema();
    const queryType = assertObjectType(schema.getQueryType());
    const customersField = queryType.getFields().customers;
    const customersEndpoint = new Endpoint(customersField);
    const individualType = assertObjectType(schema.getType('Individual'));
    const individualContractsField = individualType.getFields().contracts;
    const individualContractsEndpoint = new Endpoint(
      individualContractsField,
      customersEndpoint,
      'Individual'
    );
    const companyType = assertObjectType(schema.getType('Company'));
    const companyContractsField = companyType.getFields().contracts;
    const companyContractsEndpoint = new Endpoint(
      companyContractsField,
      customersEndpoint,
      'Company'
    );

    expect(customersEndpoint.getId()).toEqual('customers');
    expect(individualContractsEndpoint.getId()).toEqual(
      'customers.contracts<Individual>'
    );
    expect(companyContractsEndpoint.getId()).toEqual(
      'customers.contracts<Company>'
    );

    const resultBoth = {
      data: {
        customers: [
          {
            __typename: 'Individual',
            contracts: [{ id: '4' }],
          },
          {
            __typename: 'Company',
            form: 'lol',
            contracts: [{ id: '5' }, { id: '6' }, { list: ['wut', null] }],
          },
        ],
      },
    } as unknown as Result;

    const resultIndividual = {
      data: {
        customers: [
          {
            __typename: 'Individual',
            contracts: [{ id: '4' }],
          },
        ],
      },
    } as unknown as Result;

    const resultCompany = {
      data: {
        customers: [
          {
            __typename: 'Company',
            form: 'lol',
            contracts: [{ id: '5' }, { id: '6' }, { list: ['wut', null] }],
          },
        ],
      },
    } as unknown as Result;

    customersEndpoint.results.push(resultBoth, resultIndividual, resultCompany);

    expect(customersEndpoint.getNonNullResults()).toEqual([
      resultBoth,
      resultIndividual,
      resultCompany,
    ]);

    individualContractsEndpoint.results.push(
      resultBoth,
      resultIndividual,
      resultCompany
    );

    expect(individualContractsEndpoint.getNonNullResults()).toEqual([
      resultBoth,
      resultIndividual,
    ]);

    companyContractsEndpoint.results.push(
      resultBoth,
      resultIndividual,
      resultCompany
    );

    expect(companyContractsEndpoint.getNonNullResults()).toEqual([
      resultBoth,
      resultCompany,
    ]);
  });
});
