import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";

test("serves typed GraphQL data and nested Eventor relationships", async () => {
  const urls: string[] = [];
  const fetch = async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input);
    urls.push(url.toString());
    if (url.pathname.endsWith("/events")) {
      return new Response(`
        <EventList><Event><EventId>7</EventId><Name>Forest race</Name>
        <EventClassificationId>2</EventClassificationId>
        <Organiser><OrganisationId>273</OrganisationId></Organiser></Event></EventList>
      `);
    }
    if (url.pathname.endsWith("/organisation/273")) {
      return new Response(
        "<Organisation><OrganisationId>273</OrganisationId><Name>Example OK</Name></Organisation>",
      );
    }
    return new Response("<Error>Unexpected URL</Error>", { status: 404 });
  };
  const yoga = createApp({ baseUrl: "https://proxy.example/api", fetch, logging: false });
  const response = await yoga.fetch("http://localhost/api/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ApiKey: "12345678901234567890123456789012",
    },
    body: JSON.stringify({
      query:
        "{ events(input: { classification: [NATIONAL] }) { id name classification organisers { id name } } }",
    }),
  });
  const body = (await response.json()) as {
    data?: { events: unknown[] };
    errors?: unknown[];
  };

  assert.equal(response.status, 200);
  assert.equal(body.errors, undefined);
  assert.deepEqual(body.data?.events, [
    {
      id: "7",
      name: "Forest race",
      classification: "NATIONAL",
      organisers: [{ id: "273", name: "Example OK" }],
    },
  ]);
  assert.equal(urls.length, 2);
  assert.match(urls[0] ?? "", /classificationIds=2/);
});

test("allows schema introspection without an Eventor API key", async () => {
  const yoga = createApp({
    baseUrl: "https://proxy.example/api",
    fetch: async () => new Response(),
    logging: false,
  });
  const response = await yoga.fetch("http://localhost/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "{ __schema { queryType { name } } }" }),
  });
  const body = (await response.json()) as {
    data?: { __schema: { queryType: { name: string } } };
    errors?: Array<{ message: string }>;
  };

  assert.equal(response.status, 200);
  assert.equal(body.errors, undefined);
  assert.equal(body.data?.__schema.queryType.name, "Query");
});

test("rejects upstream fields without an Eventor API key", async () => {
  const yoga = createApp({
    baseUrl: "https://proxy.example/api",
    fetch: async () => new Response(),
    logging: false,
  });
  const response = await yoga.fetch("http://localhost/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "{ events { id } }" }),
  });
  const body = (await response.json()) as { errors?: Array<{ message: string }> };

  assert.equal(response.status, 200);
  assert.match(body.errors?.[0]?.message ?? "", /unexpected error|ApiKey/i);
});
