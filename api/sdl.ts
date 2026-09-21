import { typeDefs } from "../src/schema.js";

export default {
  fetch(): Response {
    return new Response(typeDefs, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  },
};
