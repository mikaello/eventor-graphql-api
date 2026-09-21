import assert from "node:assert/strict";
import test from "node:test";
import { EventorClient, EventorHttpError } from "../src/eventor-client.js";

test("forwards authentication, serializes query values and deduplicates GETs", async () => {
  const requests: Request[] = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    requests.push(new Request(input, init));
    return new Response("<EventList />", { status: 200 });
  };
  const client = new EventorClient({
    apiKey: "12345678901234567890123456789012",
    baseUrl: "https://proxy.example/api",
    fetch,
  });

  const first = client.get("events", { eventIds: ["1", "2"], includeAttributes: true });
  const second = client.get("events", { eventIds: ["1", "2"], includeAttributes: true });
  await Promise.all([first, second]);

  assert.equal(requests.length, 1);
  assert.equal(
    requests[0]?.url,
    "https://proxy.example/api/events?eventIds=1%2C2&includeAttributes=true",
  );
  assert.equal(requests[0]?.headers.get("ApiKey"), "12345678901234567890123456789012");
});

test("returns useful upstream errors without exposing credentials", async () => {
  const client = new EventorClient({
    apiKey: "secret-key",
    baseUrl: "https://eventor.example/api",
    fetch: async () => new Response("<Error>Invalid request</Error>", { status: 400 }),
  });

  await assert.rejects(
    client.get("events"),
    (error: unknown) =>
      error instanceof EventorHttpError &&
      error.message.includes("Invalid request") &&
      !error.message.includes("secret-key"),
  );
});
