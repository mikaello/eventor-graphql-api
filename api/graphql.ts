import { createApp } from "../src/app.js";

const yoga = createApp();

export default {
  fetch(request: Request) {
    return yoga.fetch(request);
  },
};
