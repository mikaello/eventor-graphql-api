import { ServerRequest } from "https://deno.land/std@0.91.0/http/server.ts";

const graphQLSchema = await Deno.readTextFile("../schema.graphql");

export default async (req: ServerRequest) => {
  await req.respond({ body: graphQLSchema });
};
