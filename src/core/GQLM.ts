import Chance from 'chance';
import { promises as fs } from 'fs';
import {
  ArgumentNode,
  assertObjectType,
  assertScalarType,
  buildClientSchema,
  DocumentNode,
  getNamedType,
  GraphQLArgument,
  GraphQLEnumType,
  GraphQLEnumValue,
  GraphQLField,
  GraphQLInputField,
  GraphQLInputObjectType,
  GraphQLInputType,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLType,
  GraphQLUnionType,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
  isUnionType,
  print,
  SelectionNode,
  ValueNode,
} from 'graphql';
import * as path from 'path';
import { dirname } from 'path';
import pluralize from 'pluralize';
import { format } from 'prettier';
import { Memory, MemoryAssoc, MemoryResult } from '../memory/Memory';
import { ASTUtil } from '../util/ASTUtil';
import { GraphQLFieldDef } from '../util/GraphQLFieldDef';
import { GraphQLNamedInput } from '../util/GraphQLNamedInput';
import { introspect } from '../util/introspect';
import { sum } from '../util/sum';
import { toError } from '../util/toError';
import { userAgent } from '../util/userAgent';
import { Endpoint } from './Endpoint';
import { Options } from './Options';
import { Result } from './Result';

export class GQLM {
  readonly chance: Chance.Chance;
  readonly memory: Memory;
  readonly outDir: string;
  readonly endpoints: Endpoint[] = [];

  constructor(
    public readonly options: Options,
    public readonly clientSchema: GraphQLSchema
  ) {
    this.chance = options.seed ? new Chance(options.seed) : new Chance();
    this.memory = new Memory({
      tokenize: (key) => this.memoryTokenize(key),
      fuzzify: (key, weight, result) => this.memoryFuzzify(key, weight, result),
    });
    this.outDir = this.options.outDir ?? '__gqlm__';

    const queryType = this.clientSchema.getQueryType();

    if (queryType) {
      for (const field of Object.values(queryType.getFields())) {
        this.addEndpoint(new Endpoint(field));
      }
    }

    if (this.endpoints.length === 0) {
      throw new Error('No operations found');
    }

    this.writeDataToMemory(options.input);
  }

  static async run(options: Options) {
    const introspection = await introspect(options.url, options.requestInit);
    const schema = buildClientSchema(introspection);
    const gqlm = new GQLM(options, schema);

    await gqlm.run();
  }

  addEndpoint(endpoint: Endpoint) {
    if (
      endpoint &&
      !this.endpoints.find((it) => it.getId() === endpoint.getId())
    ) {
      this.endpoints.push(endpoint);
    }
  }

  getResults() {
    return this.endpoints.flatMap((endpoint) => endpoint.results);
  }

  async run() {
    await this.clearOutDir();

    for (let i = 1; i <= this.options.count; ++i) {
      const endpoint = this.chance.weighted(
        this.endpoints,
        this.endpoints.map((it) => 1 / this.getRank(it))
      );

      const operation = this.generateEndpointOperation(endpoint);
      const result = await this.runOperation(operation);

      endpoint.results.push(result);

      await this.writeResult(i, result);

      this.logResult(i, result);

      if (this.options.exit && result.failed) {
        break;
      }

      for (const e of endpoint.expand(this.clientSchema)) {
        this.addEndpoint(e);
      }
    }

    await this.writeMemory();
  }

  async runOperation(ast: DocumentNode): Promise<Result> {
    const { url, requestInit } = this.options;

    const operation = print(ast);
    const t = Date.now();

    try {
      const response = await fetch(url, {
        ...requestInit,
        method: 'POST',
        headers: {
          'user-agent': `gqlm/${userAgent}`,
          'content-type': 'application/json',
          ...requestInit?.headers,
        },
        body: JSON.stringify({ query: operation }),
      });

      const { data, errors, extensions } = await response.json();

      if (data) {
        this.writeDataToMemory(data);
      }

      const failed = this.options.isFailure
        ? this.options.isFailure({ data, errors, extensions })
        : errors?.length > 0;

      return {
        operation,
        ast,
        status: response.status,
        responseTime: Date.now() - t,
        failed,
        data,
        errors,
        extensions,
      };
    } catch (err_) {
      const err = toError(err_);

      return {
        operation,
        ast,
        status: 0,
        responseTime: Date.now() - t,
        failed: true,
        requestError: err.message,
      };
    }
  }

  // operations

  generateEndpointOperation(endpoint: Endpoint): DocumentNode {
    const type = getNamedType(endpoint.field.type);
    const selections = this.generateEndpointSelections(type);
    const args = this.generateArguments(endpoint);
    const fieldNode = ASTUtil.makeFieldNode(
      endpoint.field.name,
      args,
      selections
    );
    const pathSelections = endpoint.on
      ? [
          ASTUtil.makeFieldNode('__typename'),
          ASTUtil.makeInlineFragmentNode(endpoint.on, [fieldNode]),
        ]
      : [fieldNode];

    if (endpoint.parent) {
      const nonNullResults = endpoint.on
        ? endpoint.parent.getNonNullResultsOfType(endpoint.on)
        : endpoint.parent.getNonNullResults();

      if (nonNullResults.length === 0) {
        throw new Error(
          'Trying to generate query without non-null parent results'
        );
      }

      const parentQueryAst = this.chance.pickone(nonNullResults).ast;

      return ASTUtil.rewriteSelections(
        parentQueryAst,
        endpoint.parent.getPath(),
        pathSelections
      );
    }

    return ASTUtil.makeDocumentNode(pathSelections);
  }

  generateEndpointSelections(type: GraphQLType): SelectionNode[] {
    if (isInterfaceType(type) || isUnionType(type)) {
      return this.generateUnionEndpointSelections(type).concat([
        ASTUtil.makeFieldNode('__typename'),
      ]);
    } else if (isObjectType(type)) {
      return this.generateObjectEndpointSelections(type).concat([
        ASTUtil.makeFieldNode('__typename'),
      ]);
    } else {
      return [];
    }
  }

  generateUnionEndpointSelections(
    type: GraphQLInterfaceType | GraphQLUnionType
  ): SelectionNode[] {
    const possibleTypes = this.clientSchema.getPossibleTypes(type);

    return possibleTypes
      .filter(isObjectType)
      .map((possibleType) =>
        ASTUtil.makeInlineFragmentNode(
          possibleType.name,
          this.generateObjectEndpointSelections(possibleType)
        )
      );
  }

  generateObjectEndpointSelections(type: GraphQLObjectType) {
    return Object.values(type.getFields())
      .filter(ASTUtil.isSimpleField)
      .map((f) => ASTUtil.makeFieldNode(f.name));
  }

  generateArguments(endpoint: Endpoint): ArgumentNode[] {
    return endpoint.field.args
      .map((arg) => {
        return ASTUtil.makeArgumentNode(
          arg.name,
          this.generateInput(arg.type, arg, [], endpoint.field)
        );
      })
      .filter((node) => node.value.kind !== 'NullValue');
  }

  generateInput(
    type: GraphQLInputType,
    input: GraphQLArgument | GraphQLInputField,
    ancestors: GraphQLInputField[],
    field: GraphQLFieldDef
  ): ValueNode {
    if (isNonNullType(type)) {
      return this.generateNonNullInput(type.ofType, input, ancestors, field);
    }

    // TODO should the chance of null here be configurable?
    if (this.chance.floating({ min: 0, max: 1 }) < 0.5) {
      return ASTUtil.makeNullValueNode();
    }

    return this.generateNonNullInput(type, input, ancestors, field);
  }

  generateNonNullInput(
    type: GraphQLInputType,
    input: GraphQLArgument | GraphQLInputField,
    ancestors: GraphQLInputField[],
    field: GraphQLFieldDef
  ): ValueNode {
    if (isInputObjectType(type)) {
      return this.generateInputObject(type, input, ancestors, field);
    } else if (isListType(type)) {
      return this.generateInputList(type, input, ancestors, field);
    } else if (isEnumType(type)) {
      return this.generateInputEnum(type);
    } else if (isScalarType(type)) {
      return this.generateInputScalar(type, input, ancestors, field);
    } else {
      // this should never happen
      throw new Error('Cannot generate non-null type of non-null type');
    }
  }

  generateInputObject(
    type: GraphQLInputObjectType,
    input: GraphQLArgument | GraphQLInputField,
    ancestors: GraphQLInputField[],
    field: GraphQLFieldDef
  ) {
    const fields = Object.values(type.getFields()).map((inputField) =>
      ASTUtil.makeObjectFieldNode(
        inputField.name,
        this.generateInput(
          inputField.type,
          inputField,
          ancestors.concat([input]),
          field
        )
      )
    );

    return ASTUtil.makeObjectValueNode(fields);
  }

  generateInputList(
    type: GraphQLList<GraphQLInputType>,
    input: GraphQLArgument | GraphQLInputField,
    ancestors: GraphQLInputField[],
    field: GraphQLFieldDef
  ) {
    // TODO should the size range here be configurable?
    const size = this.chance.integer({ min: 0, max: 3 });
    const values = [];

    while (values.length < size) {
      values.push(this.generateInput(type.ofType, input, ancestors, field));
    }

    return ASTUtil.makeListValueNode(values);
  }

  generateInputEnum(type: GraphQLEnumType) {
    return ASTUtil.makeEnumValueNode(
      this.chance.pickone(type.getValues() as GraphQLEnumValue[]).name
    );
  }

  generateInputScalar(
    type: GraphQLScalarType,
    input: GraphQLArgument | GraphQLInputField,
    ancestors: GraphQLInputField[],
    field: GraphQLFieldDef
  ): ValueNode {
    const assoc = this.buildAssocForInput(type, input, ancestors, field);
    const candidates = this.memory.query(assoc);

    switch (type.name) {
      case 'Float':
        return this.generateInputFloat(candidates);
      case 'Boolean':
        return ASTUtil.makeBooleanValueNode(this.chance.bool());
      case 'ID':
        return this.generateInputId(input, candidates);
      case 'Int':
        return this.generateInputInt(input, candidates);
      default:
        // including String
        return this.generateInputString(input, candidates);
    }
  }

  generateInputFloat(candidates: MemoryResult[]) {
    return ASTUtil.makeFloatValueNode(
      candidates.length === 0 || this.p(0.1)
        ? this.generateRandomFloat()
        : (this.chance.weighted(
            candidates.map((it) => it.value),
            candidates.map((it) => it.score)
          ) as number)
    );
  }

  generateInputId(
    input: GraphQLArgument | GraphQLInputField,
    candidates: MemoryResult[]
  ) {
    return ASTUtil.makeStringValueNode(
      candidates.length === 0 || this.p(0.1)
        ? this.generateRandomString(input.name)
        : (this.chance.weighted(
            candidates.map((it) => it.value),
            candidates.map((it) => it.score)
          ) as string)
    );
  }

  generateInputString(
    input: GraphQLArgument | GraphQLInputField,
    candidates: MemoryResult[]
  ) {
    return ASTUtil.makeStringValueNode(
      candidates.length === 0 || this.p(0.1)
        ? this.generateRandomString(input.name)
        : (this.chance.weighted(
            candidates.map((it) => it.value),
            candidates.map((it) => it.score)
          ) as string)
    );
  }

  generateInputInt(
    input: GraphQLArgument | GraphQLInputField,
    candidates: MemoryResult[]
  ) {
    return ASTUtil.makeIntValueNode(
      candidates.length === 0 || this.p(0.1)
        ? this.generateRandomInteger(input.name)
        : (this.chance.weighted(
            candidates.map((it) => it.value),
            candidates.map((it) => it.score)
          ) as number)
    );
  }

  //

  generateRandomString(name: string): string {
    if (name.match(/postcode|postal|zip/i)) {
      return this.chance.zip();
    }

    if (name.match(/street/i)) {
      return this.chance.street({ country: 'us' });
    }

    if (name.match(/city|locality/i)) {
      return this.chance.city();
    }

    if (name.match(/house/i)) {
      let houseNumber = this.chance.string({
        pool: '0123456789',
        length: this.chance.integer({ min: 1, max: 4 }),
      });
      if (this.chance.bool()) {
        if (this.chance.bool()) {
          houseNumber += ' ';
        }
        houseNumber += this.chance.string({ pool: 'aAbBcCdDeEfF', length: 1 });
      }
      return houseNumber;
    }

    if (name.match(/lastname|familyname|surname/i)) {
      return this.chance.last({ nationality: 'it' });
    }

    if (name.match(/firstname|forename|givenname/i)) {
      return this.chance.first({ nationality: 'en' });
    }

    if (name.match(/birthdate|dateofbirth/i)) {
      const t = this.chance.birthday();
      return `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`;
    }

    if (name.match(/date/i)) {
      return this.chance.date().toISOString();
    }

    if (name.match(/mail/i)) {
      return this.chance.email();
    }

    return this.chance.sentence({
      words: this.chance.integer({ min: 1, max: 4 }),
    });
  }

  generateRandomInteger(name: string) {
    if (name.match(/limit|top|max/i)) {
      return this.chance.integer({ min: 0, max: 20 });
    }

    if (name.match(/offset|skip/i)) {
      return this.chance.integer({ min: 0, max: 20 });
    }

    return this.chance.integer({ min: -100, max: 100 });
  }

  generateRandomFloat() {
    return this.chance.floating({ min: -100, max: 100 });
  }

  p(m: number) {
    return this.chance.floating({ min: 0, max: 1 }) <= m;
  }

  // ranking

  getRank(endpoint: Endpoint) {
    let rank = 0;

    // TODO should we support calibration in config?
    const guessable = this.canGuessField(endpoint.field);
    rank += guessable > 0 ? 1 / guessable : 12;
    rank += endpoint.results.length * 4;
    rank += endpoint.getSpecificErrors().length * 4;
    rank += endpoint.getSuccessfulResults().length * 2;
    rank += endpoint.getNonNullResults().length * 8;
    rank += endpoint.getPath().length * 7;

    return rank;
  }

  canGuessField(field: GraphQLFieldDef) {
    if (field.args.length === 0) return 1;

    return (
      Math.min(
        ...field.args.map((arg) => this.canGuessInput(arg, [], field))
      ) || 0
    );
  }

  canGuessInput(
    input: GraphQLNamedInput,
    ancestors: GraphQLNamedInput[],
    field: GraphQLField<unknown, unknown>
  ): number {
    const scores = [];

    // if there's a default value we can definitely guess the input
    // bias towards actually guessable fields
    if (
      typeof input.defaultValue !== 'undefined' &&
      input.defaultValue !== null
    ) {
      scores.push(0.5);
    }

    // if the input is nullable we can definitely guess at least null
    // bias towards actually guessable fields
    if (!isNonNullType(input.type)) {
      scores.push(0.25);
    }

    const namedType = getNamedType(input.type);

    if (namedType.name === 'Boolean' || isEnumType(namedType)) {
      // booleans and enums are definitely guessable
      scores.push(1);
    } else if (isScalarType(namedType)) {
      const assoc = this.buildAssocForInput(namedType, input, ancestors, field);
      const results = this.memory.query(assoc);

      scores.push(...results.map((it) => it.score));
    } else if (isInputObjectType(namedType)) {
      const fields = namedType.getFields();

      for (const fieldName of Object.keys(fields)) {
        scores.push(
          this.canGuessInput(
            fields[fieldName],
            ancestors.concat([input]),
            field
          )
        );
      }
    }

    return sum(scores);
  }

  // memory

  writeDataToMemory(
    data: unknown,
    ancestors: Array<{
      data: { __typename?: string; [key: string]: unknown };
      key: string;
    }> = []
  ) {
    if (Array.isArray(data)) {
      for (const value of data) {
        this.writeDataToMemory(value, ancestors);
      }
    } else if (typeof data === 'object' && data) {
      const d = data as { __typename?: string; [key: string]: unknown };

      for (const key of Object.keys(data)) {
        this.writeDataToMemory(d[key], ancestors.concat([{ data: d, key }]));
      }
    } else if (typeof data === 'string' || typeof data === 'number') {
      const parent = ancestors[ancestors.length - 1];

      if (!parent) {
        throw new Error('Trying to write scalar to memory without parent');
      }

      if (parent.key === '__typename') return;

      const assoc: MemoryAssoc = new Map();

      if (parent.data.__typename) {
        // if we know the typename, we can infer more details from introspection
        const parentType = assertObjectType(
          this.clientSchema.getType(parent.data.__typename)
        );
        const field = parentType.getFields()[parent.key];
        const type = getNamedType(field.type);

        if (isEnumType(type)) return;

        const fieldType = assertScalarType(type);

        assoc.set(`${parent.data.__typename} ${parent.key}`, 1);
        assoc.set(parent.data.__typename, 0.3);

        switch (fieldType.name) {
          case 'Float':
          case 'Int':
          case 'String':
            assoc.set(fieldType.name, 0.1);
            break;
          default:
            assoc.set(fieldType.name, 0.4);
        }
      }

      assoc.set(parent.key, 1);

      this.memory.store(data, assoc);
    }
  }

  buildAssocForInput(
    type: GraphQLNamedType,
    input: GraphQLNamedInput,
    ancestors: GraphQLNamedInput[],
    field: GraphQLField<unknown, unknown>
  ) {
    const assoc: MemoryAssoc = new Map();

    assoc.set(input.name, 1);
    assoc.set(type.name, 0.5);
    assoc.set(`${field.name} ${input.name}`, 1 / (ancestors.length + 1));

    if (ancestors.length > 0) {
      assoc.set(
        ancestors
          .map((it) => it.name)
          .concat([input.name])
          .join(' '),
        1
      );
    }

    return assoc;
  }

  memoryFuzzify(key: string, weight: number, target: MemoryAssoc) {
    const tokens = this.memoryTokenize(key);

    // exact match
    target.set(key, weight);

    // normalized suffixes
    for (let n = 0; n < tokens.length - 1; ++n) {
      const suffix = tokens.slice(n).join(' ');
      if (!target.has(suffix)) {
        target.set(suffix, weight / (n + 1.1));
      }
    }
  }

  memoryTokenize(key: string) {
    return key
      .split(/(?=[A-Z])|[\s_\-\.\/]+/)
      .map((it) => pluralize(it.toLocaleLowerCase(), 1))
      .filter((it) => it !== '');
  }

  // logging

  logResult(i: number, result: Result) {
    if (result.failed) {
      if (result.errors && result.errors.length > 0) {
        const e = result.errors.map((error) => error.message).join('; ');

        console.log(`${i} FAILED ${result.status} ${e}`);
      } else if (result.requestError) {
        console.log(`${i} FAILED ${result.status} ${result.requestError}`);
      } else {
        console.log(`${i} FAILED ${result.status}`);
      }
    } else {
      console.log(`${i} OK`);
    }
  }

  // i/o

  async writeResult(i: number, result: Result) {
    await this.writeFile(
      `${i}.mjs`,
      format(
        `
          export const operation = \`${result.operation}\`;

          export const result = ${JSON.stringify({
            status: result.status,
            responseTime: result.responseTime,
            failed: result.failed,
            requestError: result.requestError,
            data: result.data,
            errors: result.errors,
            extensions: result.extensions,
          })};
        `,
        { parser: 'babel' }
      )
    );
  }

  async writeMemory() {
    await this.writeFile(
      'memory.mjs',
      format(
        `
          export const memory = ${JSON.stringify(this.memory.serialize())};
        `,
        { parser: 'babel' }
      )
    );
  }

  async writeFile(file: string, contents: string) {
    await fs.mkdir(path.join(this.outDir, dirname(file)), { recursive: true });
    await fs.writeFile(path.join(this.outDir, file), contents);
  }

  async clearOutDir() {
    await fs.rm(this.outDir, { recursive: true });
  }
}
