import { getPossibleValuesAtPath } from '../../src/util/getPossibleValuesAtPath';

describe('getPossibleValuesAtPath', () => {
  it('should list possible values at a path in JSON data', async () => {
    const data = {
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
    };

    expect(getPossibleValuesAtPath(data, [])).toEqual([data]);

    expect(getPossibleValuesAtPath(data, ['customers'])).toEqual(
      data.customers
    );

    expect(getPossibleValuesAtPath(data, ['customers', 'contracts'])).toEqual([
      { id: '4' },
      { id: '5' },
      { id: '6' },
      { list: ['wut', null] },
    ]);

    expect(
      getPossibleValuesAtPath(data, ['customers', 'contracts', 'id'])
    ).toEqual(['4', '5', '6']);

    expect(getPossibleValuesAtPath(data, ['customers', 'form'])).toEqual([
      'lol',
    ]);

    expect(
      getPossibleValuesAtPath(data, ['customers', 'contracts', 'list'])
    ).toEqual(['wut']);
  });
});
