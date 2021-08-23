# Eventor GraphQL API

This project aims at exposing the [Eventor API](https://eventor.orienteering.org/api/documentation) as a GraphQL API.

Current GraphQL playground is available here: https://eventor-graphql-api-mikaello.vercel.app/api/graphql .
Currently this is tied to the Norwegian API of Eventor, and you need to bring your own ApiKey (add it to the _HTTP HEADERS_
section).

## What is Eventor?

Eventor is an event organisation platform for [orienteering](https://en.wikipedia.org/wiki/Orienteering) events, and the Eventor platform has a great REST API for fetching all kinds of things related to the orienteering events hosted on their platform.

Data types on the Eventor platform (and what is communicated by their REST API) are [documented in XSD documents](https://github.com/mikaello/iof-orienteering-data-schemas).

## Technically

This is a Deno (TypeScript) project, running as [Vercel Serverless Functions](https://vercel.com/docs/serverless-functions/introduction).

For the GraphQL implementation [deno-libs/gql](https://github.com/deno-libs/gql) is used.

## Run locally

You need the Vercel CLI, check out how to install at https://vercel.com/cli.

You can then start the API by running `vercel dev` in your terminal, and access localhost at `http://localhost:3000/api/graphql`.
