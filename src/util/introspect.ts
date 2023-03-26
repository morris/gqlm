import {
  getIntrospectionQuery,
  GraphQLError,
  IntrospectionQuery,
} from 'graphql';
import { toError } from './toError';
import { userAgent } from './userAgent';

export async function introspect(url: string, init?: RequestInit) {
  try {
    const response = await fetch(url, {
      ...init,
      method: 'POST',
      headers: {
        'user-agent': userAgent,
        'content-type': 'application/json',
        ...(init ? init.headers : undefined),
      },
      body: JSON.stringify({
        query: getIntrospectionQuery({ descriptions: false }),
      }),
    });

    const json = await response.json();

    const { data, errors } = json;

    if (errors?.length > 0) {
      throw new Error(
        `Introspection failed: ${errors
          .map((err: GraphQLError) => err.message)
          .join('; ')}`
      );
    }

    if (!data) {
      throw new Error('Introspection failed: No data');
    }

    return data as IntrospectionQuery;
  } catch (err_) {
    const err = toError(err_);

    err.message = `Introspection failed: ${err.message}`;

    throw err;
  }
}
