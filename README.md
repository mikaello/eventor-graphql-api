# Eventor GraphQL API

A working GraphQL facade for the [Eventor REST API](https://eventor.orientering.no/api/documentation).

It exposes typed Eventor entities, nested relationships, GraphiQL, an SDL endpoint, request-local deduplication, and lossless JSON access to XML structures that do not yet have dedicated GraphQL types.

## Architecture

The GraphQL service owns XML parsing because it is the layer that understands GraphQL field names, nullability, lists, and relationships.

The optional [eventor-proxy](https://github.com/mikaello/eventor-proxy) stays byte-preserving and is responsible for shared response caching, CORS, cache controls, and observability.

Set `EVENTOR_BASE_URL` to the proxy's `/api` URL to enable shared caching without changing this application.

```text
GraphQL client -> eventor-graphql-api -> eventor-proxy -> Eventor REST API
                     XML -> typed data      cached XML
```

The old [eventor-api-json-types](https://github.com/mikaello/eventor-api-json-types) project is not used because it only parses part of `Competitor` and has been superseded by the maintained parser work in [rescript-eventor](https://github.com/mikaello/rescript-eventor) and [rescript-iof-xml](https://github.com/mikaello/rescript-iof-xml).

This server has its own small adapter for native Eventor XML because `rescript-eventor` is currently published as a ReScript-source package without a public JavaScript or TypeScript entry point.

`rescript-iof-xml` does provide tested TypeScript subpath exports, but it covers the standard IOF document variants rather than Eventor's native XML responses.

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
