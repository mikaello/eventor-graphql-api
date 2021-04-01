import { ServerRequest } from "https://deno.land/std@0.90.0/http/server.ts";
import { GraphQLHTTP } from "https://deno.land/x/gql/mod.ts";
import { makeExecutableSchema } from "https://deno.land/x/graphql_tools/mod.ts";
import { gql } from "https://deno.land/x/graphql_tag/mod.ts";

const typeDefs = gql`
  type Query {
    hello: String
  }
`;

const resolvers = {
  Query: {
    hello: () => `Hello World!`,
  },
};

const schema = makeExecutableSchema({ resolvers, typeDefs });

export default async (req: ServerRequest) => {
  await GraphQLHTTP({ schema, graphiql: true })(req);
};
