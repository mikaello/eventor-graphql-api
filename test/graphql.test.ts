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

test("serializes upstream international classifications as GraphQL enums", async () => {
  const yoga = createApp({
    baseUrl: "https://proxy.example/api",
    fetch: async () =>
      new Response(`
        <Event><EventId>19379</EventId><Name>NC, sprint</Name>
        <EventClassificationId>0</EventClassificationId></Event>
      `),
    logging: false,
  });
  const response = await yoga.fetch("http://localhost/api/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ApiKey: "12345678901234567890123456789012",
    },
    body: JSON.stringify({ query: '{ event(id: "19379") { id classification } }' }),
  });
  const body = (await response.json()) as {
    data?: { event: { id: string; classification: string } };
    errors?: unknown[];
  };

  assert.equal(body.errors, undefined);
  assert.deepEqual(body.data?.event, { id: "19379", classification: "INTERNATIONAL" });
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
  let fetchCalled = false;
  const yoga = createApp({
    baseUrl: "https://proxy.example/api",
    defaultApiKey: "",
    fetch: async () => {
      fetchCalled = true;
      return new Response();
    },
    logging: false,
  });
  const response = await yoga.fetch("http://localhost/api/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "{ events { id } }" }),
  });
  const body = (await response.json()) as {
    errors?: Array<{ message: string; extensions?: { code?: string } }>;
  };

  assert.equal(response.status, 200);
  assert.equal(body.errors?.[0]?.message, "The ApiKey request header is required.");
  assert.equal(body.errors?.[0]?.extensions?.code, "UNAUTHENTICATED");
  assert.equal(fetchCalled, false);
});

test("returns one safe authentication error for rejected Eventor API keys", async () => {
  const upstreamErrors = [
    new Response('{error: "ApiKey header is required and must be 32 alphanumeric characters."}', {
      status: 401,
      statusText: "Unauthorized",
    }),
    new Response(
      "403 - Forbidden: Access is denied. You do not have permission to view this page.",
      { status: 403, statusText: "Forbidden" },
    ),
  ];

  for (const upstreamResponse of upstreamErrors) {
    const yoga = createApp({
      baseUrl: "https://proxy.example/api",
      fetch: async () => upstreamResponse.clone(),
      logging: false,
    });
    const response = await yoga.fetch("http://localhost/api/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ApiKey: "invalid-api-key",
      },
      body: JSON.stringify({ query: "{ events { id } }" }),
    });
    const body = (await response.json()) as {
      errors?: Array<{ message: string; extensions?: { code?: string } }>;
    };

    assert.equal(response.status, 200);
    assert.equal(
      body.errors?.[0]?.message,
      "The ApiKey request header is invalid or not authorized for this resource.",
    );
    assert.equal(body.errors?.[0]?.extensions?.code, "UNAUTHENTICATED");
    assert.doesNotMatch(body.errors?.[0]?.message ?? "", /32 alphanumeric|Access is denied/i);
  }
});

test("continues to mask unexpected upstream errors", async () => {
  const yoga = createApp({
    baseUrl: "https://proxy.example/api",
    fetch: async () =>
      new Response("Private upstream failure details", {
        status: 500,
        statusText: "Internal Server Error",
      }),
    logging: false,
  });
  const response = await yoga.fetch("http://localhost/api/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ApiKey: "12345678901234567890123456789012",
    },
    body: JSON.stringify({ query: "{ events { id } }" }),
  });
  const body = (await response.json()) as {
    errors?: Array<{ message: string; extensions?: { code?: string } }>;
  };

  assert.equal(response.status, 200);
  assert.equal(body.errors?.[0]?.message, "Unexpected error.");
  assert.equal(body.errors?.[0]?.extensions?.code, "INTERNAL_SERVER_ERROR");
  assert.doesNotMatch(body.errors?.[0]?.message ?? "", /Private upstream failure details/);
});

test("returns a GraphQL error before the deployment timeout", async () => {
  const yoga = createApp({
    baseUrl: "https://proxy.example/api",
    fetch: () => new Promise<Response>(() => undefined),
    logging: false,
    requestTimeoutMs: 10,
  });
  const response = await yoga.fetch("http://localhost/api/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ApiKey: "12345678901234567890123456789012",
    },
    body: JSON.stringify({ query: "{ events { id } }" }),
  });
  const body = (await response.json()) as {
    errors?: Array<{ message: string; extensions?: { code?: string } }>;
  };

  assert.equal(response.status, 504);
  assert.match(response.headers.get("Content-Type") ?? "", /^application\/graphql-response\+json/);
  assert.equal(
    body.errors?.[0]?.message,
    "The request timed out while waiting for Eventor. Please try again; the next attempt may be faster because Eventor responses are cached.",
  );
  assert.equal(body.errors?.[0]?.extensions?.code, "GATEWAY_TIMEOUT");
});

test("traverses event entries, people, starts, and related events in one operation", async () => {
  const urls: URL[] = [];
  const fetch = async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input);
    urls.push(url);
    if (url.pathname.endsWith("/event/7")) {
      return new Response("<Event><EventId>7</EventId><Name>Forest race</Name></Event>");
    }
    if (url.pathname.endsWith("/entries")) {
      return new Response(`
        <EntryList>
          <Entry><EntryId>10</EntryId><Competitor><CompetitorId>20</CompetitorId>
            <Person><PersonId>30</PersonId><PersonName><Given>Ola</Given><Family>Nordmann</Family></PersonName></Person>
          </Competitor><Event><EventId>7</EventId><Name>Forest race</Name></Event></Entry>
          <Entry><EntryId>11</EntryId><Competitor><CompetitorId>21</CompetitorId>
            <Person><PersonId>30</PersonId><PersonName><Given>Ola</Given><Family>Nordmann</Family></PersonName></Person>
          </Competitor><Event><EventId>7</EventId><Name>Forest race</Name></Event></Entry>
        </EntryList>
      `);
    }
    if (url.pathname.endsWith("/starts/person")) {
      return new Response(`
        <StartListList>
          <StartList><Event><EventId>7</EventId><Name>Forest race</Name></Event>
            <ClassStart><PersonStart><Person><PersonId>30</PersonId></Person>
              <Start><StartTime><Date>2026-09-20</Date><Clock>10:00:00</Clock></StartTime></Start>
            </PersonStart></ClassStart>
          </StartList>
          <StartList><Event><EventId>8</EventId><Name>City sprint</Name></Event>
            <ClassStart><PersonStart><Person><PersonId>30</PersonId></Person>
              <Start><StartTime><Date>2026-09-21</Date><Clock>12:00:00</Clock></StartTime></Start>
            </PersonStart></ClassStart>
          </StartList>
        </StartListList>
      `);
    }
    if (url.pathname.endsWith("/events") && url.searchParams.get("eventIds") === "8") {
      return new Response("<EventList><Event><EventId>8</EventId><Name>City sprint</Name></Event></EventList>");
    }
    return new Response(`<Error>Unexpected URL: ${url.toString()}</Error>`, { status: 404 });
  };
  const yoga = createApp({ baseUrl: "https://proxy.example/api", fetch, logging: false });
  const response = await yoga.fetch("http://localhost/api/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ApiKey: "12345678901234567890123456789012",
    },
    body: JSON.stringify({
      query: `{
        event(id: "7") {
          entries {
            id
            person {
              id
              startRecords {
                startTime
                event { id name }
              }
            }
          }
        }
      }`,
    }),
  });
  const body = (await response.json()) as {
    data?: { event: { entries: unknown[] } };
    errors?: Array<{ message: string }>;
  };

  assert.equal(body.errors, undefined);
  assert.equal(body.data?.event.entries.length, 2);
  assert.deepEqual(body.data?.event.entries[0], {
    id: "10",
    person: {
      id: "30",
      startRecords: [
        {
          startTime: "2026-09-20T10:00:00",
          event: { id: "7", name: "Forest race" },
        },
        {
          startTime: "2026-09-21T12:00:00",
          event: { id: "8", name: "City sprint" },
        },
      ],
    },
  });
  assert.equal(urls.filter((url) => url.pathname.endsWith("/starts/person")).length, 1);
  assert.equal(urls.filter((url) => url.pathname.endsWith("/events")).length, 1);
});

test("batches nested entries and competitor counts across parent events", async () => {
  const urls: URL[] = [];
  const fetch = async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input);
    urls.push(url);
    if (url.pathname.endsWith("/events")) {
      return new Response(`
        <EventList>
          <Event><EventId>7</EventId><Name>Forest race</Name></Event>
          <Event><EventId>8</EventId><Name>City sprint</Name></Event>
        </EventList>
      `);
    }
    if (url.pathname.endsWith("/entries")) {
      return new Response(`
        <EntryList>
          <Entry><EntryId>10</EntryId><Competitor><CompetitorId>20</CompetitorId></Competitor><EventId>7</EventId></Entry>
          <Entry><EntryId>11</EntryId><Competitor><CompetitorId>21</CompetitorId></Competitor><EventId>8</EventId></Entry>
        </EntryList>
      `);
    }
    if (url.pathname.endsWith("/competitorcount")) {
      return new Response(`
        <CompetitorCountList>
          <CompetitorCount eventId="7" numberOfEntries="4" numberOfStarts="3" />
          <CompetitorCount eventId="8" numberOfEntries="6" numberOfStarts="5" />
        </CompetitorCountList>
      `);
    }
    return new Response(`<Error>Unexpected URL: ${url.toString()}</Error>`, { status: 404 });
  };
  const yoga = createApp({ baseUrl: "https://proxy.example/api", fetch, logging: false });
  const response = await yoga.fetch("http://localhost/api/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ApiKey: "12345678901234567890123456789012",
    },
    body: JSON.stringify({
      query: `{
        events {
          id
          entries { id }
          competitorCount(organisationIds: ["273"]) {
            numberOfEntries
            event { id }
          }
        }
      }`,
    }),
  });
  const body = (await response.json()) as { data?: unknown; errors?: Array<{ message: string }> };

  assert.equal(body.errors, undefined);
  assert.deepEqual(body.data, {
    events: [
      {
        id: "7",
        entries: [{ id: "10" }],
        competitorCount: { numberOfEntries: 4, event: { id: "7" } },
      },
      {
        id: "8",
        entries: [{ id: "11" }],
        competitorCount: { numberOfEntries: 6, event: { id: "8" } },
      },
    ],
  });
  const entriesRequests = urls.filter((url) => url.pathname.endsWith("/entries"));
  const countRequests = urls.filter((url) => url.pathname.endsWith("/competitorcount"));
  assert.equal(entriesRequests.length, 1);
  assert.equal(entriesRequests[0]?.searchParams.get("eventIds"), "7,8");
  assert.equal(countRequests.length, 1);
  assert.equal(countRequests[0]?.searchParams.get("eventIds"), "7,8");
});
