import { createApp } from "../src/app.js";

const yoga = createApp({ requestTimeoutMs: 55_000 });

export default {
  fetch(request: Request) {
    return yoga.fetch(request);
  },
};
