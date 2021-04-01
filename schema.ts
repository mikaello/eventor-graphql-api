import { gql } from "https://deno.land/x/graphql_tag/mod.ts";

export default gql`
  type Query {
    apiKey: String
    organisation(id: Int!): String
    eventClasses(eventId: Int!, includeEntryFees: Boolean): String
  }
`;
