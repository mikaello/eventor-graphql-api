import { createServer } from "node:http";
import { createApp } from "./app.js";

const port = Number.parseInt(process.env.PORT ?? "4000", 10);
const yoga = createApp();

createServer(yoga).listen(port, () => {
  console.log(`Eventor GraphQL API listening at http://localhost:${port}/api/graphql`);
});
