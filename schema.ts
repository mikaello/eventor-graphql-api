import { gql } from "https://deno.land/x/graphql_tag@0.0.1/mod.ts";

export default gql`
  type Query {
    apiKey: String
    organisation(id: Int!): String
    eventClasses(eventId: Int!, includeEntryFees: Boolean): String
  }
`;
