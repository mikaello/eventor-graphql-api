# Eventor API references

- The OpenAPI specification is available at [orienteering-oss/eventor-api-openapi-spec](https://github.com/orienteering-oss/eventor-api-openapi-spec).
- JavaScript and TypeScript types for Eventor are available at [mikaello/rescript-eventor](https://github.com/mikaello/rescript-eventor/).
- Use the types and parsers from `rescript-eventor` instead of creating duplicate types or parsers in this library.
- If a required type or parser does not exist in `rescript-eventor`, consider adding it there before implementing it in this library.
- The Eventor XML API schema is available at [eventor.orientering.se/api/schema](https://eventor.orientering.se/api/schema).
- A local copy of the IOF XML schema is available at [IOF.xsd](IOF.xsd).
- [mikaello/rescript-iof-xml](https://github.com/mikaello/rescript-iof-xml) is the JavaScript/TypeScript version of the IOF XML schema; use it when needed.
- Use [mikaello/eventor-proxy](https://github.com/mikaello/eventor-proxy) for Eventor API requests when possible because it caches requests and helps avoid overloading the Eventor API.
