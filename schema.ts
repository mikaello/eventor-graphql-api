import { gql } from "https://deno.land/x/graphql_tag/mod.ts";

export default gql`
  type Query {
    hello: String
  }
`;
