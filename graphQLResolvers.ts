import { IResolvers } from "https://deno.land/x/graphql_tools@0.0.0/utils/interfaces.ts";
import { GraphQLResolveInfo } from "https://raw.githubusercontent.com/adelsz/graphql-deno/v15.0.0/mod.ts";
import { ServerRequest } from "https://deno.land/std@0.91.0/http/server.ts";

type ContextValue = {
  request: ServerRequest;
};
const getApiHeader = (context: ContextValue) => {
  let apiKey = context.request.headers.get("ApiKey") ?? "";
  console.log("ApiKey: " + apiKey);

  const headers = new Headers();
  headers.set("ApiKey", apiKey);
  return { headers };
};

type Query = Record<string, string | number | boolean | undefined>;
const myURLSearchParams = (init: Query) =>
  new URLSearchParams(init as Record<string, string>).toString();

const eventor = "https://eventor.orientering.no/";
const createUrl = (path: string, query?: Query) => {
  const url = new URL(path, eventor);
  const queryString = query != null ? myURLSearchParams(query) : "";
  return `${url}?${queryString}`;
};

export const resolvers: IResolvers = {
  Query: {
    organisation: async (
      source: any,
      args: { id: number },
      contextValue: ContextValue,
      info: GraphQLResolveInfo
    ) => {
      const res = await fetch(
        createUrl("api/organisation/" + args.id),
        getApiHeader(contextValue)
      );
      const data = await res.text();

      return data;
    },

    apiKey: async (
      source: any,
      args: { [key: string]: any },
      contextValue: ContextValue,
      iinfo: GraphQLResolveInfo
    ) => {
      const res = await fetch(
        createUrl("/api/organisation/apiKey"),
        getApiHeader(contextValue)
      );
      const data = await res.text();

      return data;
    },

    eventClasses: async (
      source: any,
      args: { eventId: number; includeEntryFees?: boolean },
      contextValue: ContextValue,
      info: GraphQLResolveInfo
    ) => {
      const res = await fetch(
        createUrl("api/eventclasses", args),
        getApiHeader(contextValue)
      );
      const data = await res.text();

      return data;
    },
  },
};
