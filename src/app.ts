import { useRequestDeadline } from "@whatwg-node/server";
import { GraphQLError } from "graphql";
import { createSchema, createYoga, maskError } from "graphql-yoga";
import {
  EventorApiKeyRequiredError,
  EventorClient,
  EventorHttpError,
} from "./eventor-client.js";
import { createRequestLoaders } from "./loaders.js";
import { resolvers, typeDefs, type GraphQLContext } from "./schema.js";

export interface AppOptions {
  baseUrl?: string;
  defaultApiKey?: string;
  fetch?: typeof globalThis.fetch;
  graphqlEndpoint?: string;
  logging?: boolean;
  maxConcurrentGets?: number;
  requestTimeoutMs?: number;
}

function originalError(error: unknown): unknown {
  return error instanceof GraphQLError ? (error.originalError ?? error) : error;
}

function authenticationError(error: unknown, message: string): GraphQLError {
  const graphqlError = error instanceof GraphQLError ? error : undefined;
  return new GraphQLError(message, {
    nodes: graphqlError?.nodes,
    source: graphqlError?.source,
    positions: graphqlError?.positions,
    path: graphqlError?.path,
    extensions: { code: "UNAUTHENTICATED" },
  });
}

export function createApp(options: AppOptions = {}) {
  const baseUrl =
    options.baseUrl ?? process.env.EVENTOR_BASE_URL ?? "https://eventor.orientering.no/api";

  return createYoga<GraphQLContext>({
    schema: createSchema({ typeDefs, resolvers }),
    graphqlEndpoint: options.graphqlEndpoint ?? "/api/graphql",
    graphiql: true,
    logging: options.logging ?? true,
    plugins:
      options.requestTimeoutMs === undefined
        ? []
        : [
            useRequestDeadline({
              timeout: options.requestTimeoutMs,
              response: () =>
                Response.json(
                  {
                    errors: [
                      {
                        message:
                          "The request timed out while waiting for Eventor. Please try again; the next attempt may be faster because Eventor responses are cached.",
                        extensions: { code: "GATEWAY_TIMEOUT" },
                      },
                    ],
                  },
                  {
                    status: 504,
                    headers: { "Content-Type": "application/graphql-response+json; charset=utf-8" },
                  },
                ),
            }),
          ],
    maskedErrors: {
      maskError: (error, message, isDev) => {
        const cause = originalError(error);
        if (cause instanceof EventorApiKeyRequiredError) {
          return authenticationError(error, "The ApiKey request header is required.");
        }
        if (cause instanceof EventorHttpError && (cause.status === 401 || cause.status === 403)) {
          return authenticationError(
            error,
            "The ApiKey request header is invalid or not authorized for this resource.",
          );
        }
        return maskError(error, message, isDev);
      },
    },
    context: ({ request }) => {
      const client = new EventorClient({
        apiKey: request.headers.get("ApiKey") ?? options.defaultApiKey ?? process.env.EVENTOR_API_KEY ?? "",
        baseUrl,
        ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
        ...(options.maxConcurrentGets === undefined
          ? {}
          : { maxConcurrentGets: options.maxConcurrentGets }),
      });
      return { client, loaders: createRequestLoaders(client) };
    },
  });
}
