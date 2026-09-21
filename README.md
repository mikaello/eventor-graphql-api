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

Dedicated GraphQL types and queries cover events, organisations, persons, competitors, entries, event classes, entry fees, event documents, and competitor counts.

Event, organisation, and person fields provide useful nested traversal without putting IDs together in the client.

Starts and results are returned as `XmlDocument` values so the complete Eventor response remains accessible while their large IOF schemas evolve.

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

## Example

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
