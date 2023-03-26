import { DocumentNode, GraphQLError } from 'graphql';

export interface Result {
  operation: string;
  ast: DocumentNode; // private
  status: number;
  responseTime: number;
  failed: boolean;
  requestError?: string;
  data?: unknown;
  errors?: GraphQLError[];
  extensions?: unknown;
}
