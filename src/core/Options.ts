import { ExecutionResult } from 'graphql';

export interface Options {
  /**
   * URL of GraphQL API to test
   */
  url: string;

  /**
   * Maximum number of requests to run
   */
  count: number;

  /**
   * Additional parameters for fetch(), e.g. headers
   */
  requestInit?: RequestInit;

  /**
   * Seed for randomization; if set, GQLM will behave deterministically
   */
  seed?: string;

  /**
   * Map of initial data for generating inputs.
   */
  input?: Record<string, unknown>;

  /**
   * Should GQLM exit on the first failed request?
   */
  exit?: boolean;

  /**
   * Callback to determine whether a GraphQL result is considered a failure.
   */
  isFailure?: (result: ExecutionResult) => boolean;

  /**
   * Output directory.
   * Defaults to `__gqlm__`.
   */
  outDir?: string;
}
