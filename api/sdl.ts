import { ServerRequest } from "https://deno.land/std@0.105.0/http/server.ts";
import graphQLSchema from "../schema.ts";

export default async (req: ServerRequest) => {
  await req.respond({ body: graphQLSchema.loc?.source.body ?? "" });
};
