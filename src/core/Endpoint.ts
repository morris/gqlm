import {
  getNamedType,
  GraphQLSchema,
  isInterfaceType,
  isObjectType,
  isUnionType,
} from 'graphql';
import { asRecord } from '../util/asRecord';
import { ASTUtil } from '../util/ASTUtil';
import { getPossibleValuesAtPath } from '../util/getPossibleValuesAtPath';
import { GraphQLFieldDef } from '../util/GraphQLFieldDef';
import { Result } from './Result';

// An endpoint represents a non-trivial field in a graphql schema
// Non-trivial = has arguments or is an object field
// Also holds data about test results
export class Endpoint {
  readonly field: GraphQLFieldDef;
  readonly parent?: Endpoint;
  readonly on?: string;
  readonly results: Result[] = [];

  constructor(field: GraphQLFieldDef, parent?: Endpoint, on?: string) {
    this.field = field;
    this.parent = parent;
    this.on = on;
  }

  getId(): string {
    const suffix = this.on ? `${this.field.name}<${this.on}>` : this.field.name;

    return this.parent ? `${this.parent.getId()}.${suffix}` : suffix;
  }

  expand(schema: GraphQLSchema): Endpoint[] {
    const type = getNamedType(this.field.type);

    if (isObjectType(type) && this.getNonNullResults().length > 0) {
      return Object.values(type.getFields())
        .filter((it) => !ASTUtil.isSimpleField(it))
        .map((field) => new Endpoint(field, this));
    }

    if (isInterfaceType(type) || isUnionType(type)) {
      const possibleTypes = schema.getPossibleTypes(type);

      return possibleTypes.flatMap((possibleType) => {
        if (
          !isObjectType(possibleType) ||
          this.getNonNullResultsOfType(possibleType.name).length === 0
        ) {
          return [];
        }

        return Object.values(possibleType.getFields())
          .filter((it) => !ASTUtil.isSimpleField(it))
          .map((field) => new Endpoint(field, this, possibleType.name));
      });
    }

    return [];
  }

  getSuccessfulResults() {
    return this.results.filter((result) => !result.failed);
  }

  getPath(): string[] {
    return this.parent
      ? this.parent.getPath().concat([this.field.name])
      : [this.field.name];
  }

  getErrors() {
    return this.results.flatMap((result) => result.errors ?? []);
  }

  getSpecificErrors() {
    return this.getErrors().filter(
      (error) => (error.path ?? []).join('.') === this.getPath().join('.')
    );
  }

  getNonNullResultsOfType(typename: string) {
    const path = this.getPath();

    return this.getNonNullResults().filter(
      (result) =>
        getPossibleValuesAtPath(result.data, path.concat('__typename')).indexOf(
          typename
        ) >= 0
    );
  }

  getNonNullResults() {
    const path = this.getPath();

    return this.results.filter((result) => {
      if (!this.on) {
        return getPossibleValuesAtPath(result.data, path).length > 0;
      }

      const possibleParents = getPossibleValuesAtPath(
        result.data,
        path.slice(0, -1)
      ).filter((value) => asRecord(value).__typename === this.on);

      return (
        getPossibleValuesAtPath(possibleParents, path.slice(-1)).length > 0
      );
    });
  }
}
