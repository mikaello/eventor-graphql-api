# Eventor GraphQL API

A working GraphQL facade for the [Eventor REST API](https://eventor.orientering.no/api/documentation).

It exposes typed Eventor entities, nested relationships, GraphiQL, an SDL endpoint, request-local deduplication, and lossless JSON access to XML structures that do not yet have dedicated GraphQL types.

## What is Eventor?

Eventor is an event management platform for [orienteering](https://en.wikipedia.org/wiki/Orienteering) events.

Its REST API exposes events, entries, start lists, results, organisations, people, and related race data as XML.

## Architecture

The service uses [rescript-eventor](https://github.com/mikaello/rescript-eventor) for typed parsing of compatible native Eventor responses.

The GraphQL layer applies schema-specific normalization and retains lossless parsing for raw or richer XML structures.

By default, this service calls the Norwegian Eventor API directly.

To use the optional [eventor-proxy](https://github.com/mikaello/eventor-proxy), set `EVENTOR_BASE_URL` to the proxy's `/api` URL.

The proxy is not bundled or required; it adds shared caching, CORS, cache controls, and observability while preserving the original XML response.

```text
GraphQL client -> eventor-graphql-api -> eventor-proxy -> Eventor REST API
                     XML -> typed data      cached XML
```

## API coverage

Dedicated GraphQL types and queries cover events, organisations, persons, competitors, entries, event classes, entry fees, event documents, competitor counts, starts, and results.

Relationship fields reuse parent IDs so clients can traverse between these resources without assembling follow-up requests.

Request-scoped loaders batch multi-ID endpoints, deduplicate repeated reads, and bound concurrent upstream GET requests.

The existing `XmlDocument` fields remain available for complete Eventor responses, while `startRecords` and `resultRecords` expose their commonly used relationships as GraphQL types.

The `raw` query covers the IOF XML variants, activities, memberships, exports, WRS endpoints, and external login URLs through a fixed endpoint allowlist.

Mutations wrap start-list imports, result-list imports, and competitor updates with XML string inputs.

Password-based `/authenticatePerson` is intentionally not exposed because forwarding user passwords through GraphQL would expand the service's security responsibilities.

## Run locally

Install dependencies and start the server.

```sh
npm install
npm run dev
```

Open `http://localhost:4000/api/graphql`.

Pass an Eventor API key in the `ApiKey` request header, or set `EVENTOR_API_KEY` for a trusted server-side deployment.

Copy `.env.example` if you want to change the upstream URL.

```sh
EVENTOR_BASE_URL=https://your-eventor-proxy.example/api npm run dev
```

## Connected graph example

```graphql
query EventEntrantsAndTheirStarts {
  event(id: "19379") {
    entries {
      person {
        id
        firstName
        startRecords {
          startTime
          event {
            id
            name
            competitorCount(organisationIds: ["273"]) {
              numberOfEntries
              numberOfStarts
            }
          }
        }
      }
    }
  }
}
```

`Event` also links to entries, organisers, classes, fees, documents, starts, and results.

`Organisation` links to events, documents, people, competitors, entries, counts, starts, results, activities, memberships, and exports.

`Person` links to its organisation, competitor settings, counts, starts, and results.

## Upcoming events example

```graphql
query UpcomingEvents {
  events(input: { fromDate: "2026-09-01", toDate: "2026-10-01" }) {
    id
    name
    startDate
    classification
    organisers {
      id
      name
    }
    classes {
      id
      name
      numberOfEntries
    }
  }
}
```

## Verification

```sh
npm run check
```

The check runs strict TypeScript validation and the parser, transport, and GraphQL integration tests.

## Deployment

The `api` directory contains Web-standard Vercel functions for `/api/graphql` and `/api/sdl`.

Vercel uses the Node.js runtime and installs the exact dependency versions in `package-lock.json`.

Configure `EVENTOR_BASE_URL` and optionally `EVENTOR_API_KEY` in the deployment environment.

## Timing logs

Each GraphQL request writes one structured `graphql_timing` log in deployed and default local configurations.

The log records total execution, the initial `events` fetch, the wall-clock child-fetch phase, the number of child fetches, accumulated XML parsing, and result serialization in milliseconds.

Requests without an `events` root field report `null` for the initial fetch and child-fetch phase.

Set `logging: false` or `timingLogger: false` when constructing the app to disable timing logs.
