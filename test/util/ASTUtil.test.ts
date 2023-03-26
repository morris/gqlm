import { parse, print } from 'graphql';
import { ASTUtil } from '../../src/util/ASTUtil';

describe('ASTUtil', () => {
  describe('rewriteSelection', () => {
    it('should rewrite selections', () => {
      const input = parse(`{
        customers {
          contracts {
            id
          }
        }
      }`);

      const output = ASTUtil.rewriteSelections(
        input,
        ['customers', 'contracts'],
        [
          ASTUtil.makeFieldNode('foo'),
          ASTUtil.makeInlineFragmentNode('Bar', [ASTUtil.makeFieldNode('bar')]),
        ]
      );

      const expected = parse(`{
        customers {
          contracts {
            foo
            ... on Bar {
              bar
            }
          }
        }
      }`);

      expect(print(output)).toEqual(print(expected));
    });

    it('should rewrite selections in fragments', () => {
      const input = parse(`{
        customers {
          ... on Individual {
            contracts {
              id
            }
          }
          ... on Company {
            contracts {
              id
            }
          }
        }
      }`);

      const output = ASTUtil.rewriteSelections(
        input,
        ['customers', 'contracts'],
        [
          ASTUtil.makeFieldNode('foo'),
          ASTUtil.makeInlineFragmentNode('Bar', [ASTUtil.makeFieldNode('bar')]),
        ]
      );

      const expected = parse(`{
        customers {
          ... on Individual {
            contracts {
              foo
              ... on Bar {
                bar
              }
            }
          }
          ... on Company {
            contracts {
              foo
              ... on Bar {
                bar
              }
            }
          }
        }
      }`);

      expect(print(output)).toEqual(print(expected));
    });
  });
});
