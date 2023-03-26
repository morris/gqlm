import {
  ArgumentNode,
  ASTNode,
  BooleanValueNode,
  DocumentNode,
  EnumValueNode,
  FieldNode,
  FloatValueNode,
  getNamedType,
  InlineFragmentNode,
  IntValueNode,
  isLeafType,
  Kind,
  ListValueNode,
  NullValueNode,
  ObjectFieldNode,
  ObjectValueNode,
  OperationTypeNode,
  SelectionNode,
  StringValueNode,
  ValueNode,
  visit,
} from 'graphql';
import { GraphQLFieldDef } from './GraphQLFieldDef';

export class ASTUtil {
  static rewriteSelections<T extends ASTNode>(
    op: T,
    path: string[],
    selections: SelectionNode[]
  ): T {
    let index = 0;

    return visit(op, {
      Field: {
        enter(node) {
          if (node.name.value !== path[index]) {
            return false;
          }

          ++index;
        },
        leave(node) {
          --index;

          if (index === path.length - 1) {
            return {
              ...node,
              selectionSet: {
                kind: Kind.SELECTION_SET,
                selections,
              },
            };
          }
        },
      },
    });
  }

  static isSimpleField(field: GraphQLFieldDef) {
    return field.args.length === 0 && isLeafType(getNamedType(field.type));
  }

  static makeDocumentNode(
    selections: SelectionNode[] | ReadonlyArray<SelectionNode>
  ): DocumentNode {
    return {
      kind: Kind.DOCUMENT,
      definitions: [
        {
          kind: Kind.OPERATION_DEFINITION,
          operation: OperationTypeNode.QUERY,
          selectionSet: {
            kind: Kind.SELECTION_SET,
            selections,
          },
        },
      ],
    };
  }

  static makeFieldNode(
    name: string,
    args: ArgumentNode[] | ReadonlyArray<ArgumentNode> = [],
    selections: SelectionNode[] | ReadonlyArray<SelectionNode> = []
  ): FieldNode {
    return {
      kind: Kind.FIELD,
      name: {
        kind: Kind.NAME,
        value: name,
      },
      arguments: args,
      selectionSet: {
        kind: Kind.SELECTION_SET,
        selections,
      },
    };
  }

  static makeInlineFragmentNode(
    on: string,
    selections: SelectionNode[] | ReadonlyArray<SelectionNode>
  ): InlineFragmentNode {
    return {
      kind: Kind.INLINE_FRAGMENT,
      typeCondition: {
        kind: Kind.NAMED_TYPE,
        name: {
          kind: Kind.NAME,
          value: on,
        },
      },
      selectionSet: {
        kind: Kind.SELECTION_SET,
        selections,
      },
    };
  }

  static makeArgumentNode(name: string, value: ValueNode): ArgumentNode {
    return {
      kind: Kind.ARGUMENT,
      name: {
        kind: Kind.NAME,
        value: name,
      },
      value,
    };
  }

  static makeObjectValueNode(fields: ObjectFieldNode[]): ObjectValueNode {
    return {
      kind: Kind.OBJECT,
      fields,
    };
  }

  static makeObjectFieldNode(name: string, value: ValueNode): ObjectFieldNode {
    return {
      kind: Kind.OBJECT_FIELD,
      name: {
        kind: Kind.NAME,
        value: name,
      },
      value,
    };
  }

  static makeListValueNode(values: ValueNode[]): ListValueNode {
    return {
      kind: Kind.LIST,
      values,
    };
  }

  static makeStringValueNode(value: string): StringValueNode {
    return {
      kind: Kind.STRING,
      value,
    };
  }

  static makeIntValueNode(value: number): IntValueNode {
    return {
      kind: Kind.INT,
      value: value.toString(),
    };
  }

  static makeFloatValueNode(value: number): FloatValueNode {
    return {
      kind: Kind.FLOAT,
      value: value.toString(),
    };
  }

  static makeBooleanValueNode(value: boolean): BooleanValueNode {
    return {
      kind: Kind.BOOLEAN,
      value,
    };
  }

  static makeEnumValueNode(value: string): EnumValueNode {
    return {
      kind: Kind.ENUM,
      value,
    };
  }

  static makeNullValueNode(): NullValueNode {
    return {
      kind: Kind.NULL,
    };
  }
}
