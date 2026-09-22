import { createSchema, createYoga } from "graphql-yoga";
import { EventorClient } from "./eventor-client.js";
import { resolvers, typeDefs, type GraphQLContext } from "./schema.js";

export interface AppOptions {
  baseUrl?: string;
  defaultApiKey?: string;
  fetch?: typeof globalThis.fetch;
  graphqlEndpoint?: string;
  logging?: boolean;
}

export function createApp(options: AppOptions = {}) {
  const baseUrl =
    options.baseUrl ?? process.env.EVENTOR_BASE_URL ?? "https://eventor.orientering.no/api";

  return createYoga<GraphQLContext>({
    schema: createSchema({ typeDefs, resolvers }),
    graphqlEndpoint: options.graphqlEndpoint ?? "/api/graphql",
    graphiql: true,
    logging: options.logging ?? true,
    context: ({ request }) => ({
      client: new EventorClient({
        apiKey: request.headers.get("ApiKey") ?? options.defaultApiKey ?? process.env.EVENTOR_API_KEY ?? "",
        baseUrl,
        ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
      }),
    }),
  });
}
