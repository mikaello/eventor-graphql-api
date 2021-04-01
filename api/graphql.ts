import { ServerRequest } from "https://deno.land/std@0.91.0/http/server.ts";
import { GraphQLHTTP } from "https://deno.land/x/gql/mod.ts";
import { makeExecutableSchema } from "https://deno.land/x/graphql_tools/mod.ts";
import { resolvers } from "../graphQLResolvers.ts";

import typeDefs from "../schema.ts";

const schema = makeExecutableSchema({ resolvers, typeDefs });

export default async (req: ServerRequest) => {
  await GraphQLHTTP({ schema, graphiql: true })(req);
};
