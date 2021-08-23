import { ServerRequest } from "https://deno.land/std@0.105.0/http/server.ts";
import { GraphQLHTTP } from "https://deno.land/x/gql@0.2.1/mod.ts";
import { makeExecutableSchema } from "https://deno.land/x/graphql_tools@0.0.2/mod.ts";
import { resolvers } from "../graphQLResolvers.ts";

import typeDefs from "../schema.ts";

const schema = makeExecutableSchema({ resolvers, typeDefs });

export default async (req: ServerRequest) => {
  await GraphQLHTTP({ schema, graphiql: true })(req);
};
