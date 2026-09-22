import { GraphQLScalarType, Kind, type ValueNode } from "graphql";
import {
  EventClassification,
  EventClassificationFilter,
  type EventClassificationFilter as EventClassificationFilterValue,
} from "rescript-eventor/Eventor";
import {
  parseCompetitor,
  parseCompetitorCounts,
  parseCompetitors,
  parseDocuments,
  parseEntries,
  parseEntryFees,
  parseEvent,
  parseEventClasses,
  parseEvents,
  parseOrganisation,
  parseOrganisations,
  parsePersons,
  parseDocument,
  type Event,
  type Organisation,
  type Person,
} from "./domain.js";
import type { EventorClient, Query, QueryValue } from "./eventor-client.js";
import { eventorClassificationToId } from "./rescript-eventor.js";

export const typeDefs = /* GraphQL */ `
  scalar JSON

  enum EventClassification {
    INTERNATIONAL
    CHAMPIONSHIP
    NATIONAL
    REGIONAL
    NEARBY
    CLUB
  }

  enum EventClassificationFilter {
    CHAMPIONSHIP
    NATIONAL
    REGIONAL
    NEARBY
    CLUB
  }

  enum Sex {
    MALE
    FEMALE
  }

  enum RawEndpoint {
    EVENTS_IOF_XML
    EVENT_IOF_XML
    ORGANISATIONS_IOF_XML
    STARTS_IOF_XML
    RESULTS_IOF_XML
    ACTIVITIES
    ACTIVITY
    MEMBERSHIPS
    EXPORT_COMPETITORS
    WRS_EVENTS
    WRS_RESULTS
    EXTERNAL_LOGIN_URL
  }

  input EventsInput {
    fromDate: String
    toDate: String
    fromModifyDate: String
    toModifyDate: String
    eventIds: [ID!]
    organisationIds: [ID!]
    classification: [EventClassificationFilter!]
    includeEntryBreaks: Boolean
    includeAttributes: Boolean
    parentIds: [ID!]
  }

  input EntriesInput {
    organisationIds: [ID!]
    eventIds: [ID!]
    eventClassIds: [ID!]
    fromEventDate: String
    toEventDate: String
    fromEntryDate: String
    toEntryDate: String
    fromModifyDate: String
    toModifyDate: String
    includeEntryFees: Boolean
    includePerson: Boolean = true
    includeOrganisation: Boolean = true
    includeEvent: Boolean = true
  }

  input DocumentsInput {
    fromDate: String
    toDate: String
    eventIds: [ID!]
    organisationIds: [ID!]
  }

  input CompetitorCountInput {
    organisationIds: [ID!]!
    eventIds: [ID!]
    personIds: [ID!]
  }

  type XmlDocument {
    root: String!
    data: JSON
    xml: String!
  }

  type Event {
    id: ID!
    name: String!
    startDate: String
    finishDate: String
    classification: EventClassification
    statusId: ID
    disciplineId: ID
    organiserIds: [ID!]!
    eventForm: String
    organisers: [Organisation!]!
    classes(includeEntryFees: Boolean = false): [EventClass!]!
    documents: [EventDocument!]!
    starts: XmlDocument!
    results(includeSplitTimes: Boolean = false, top: Int): XmlDocument!
  }

  type Organisation {
    id: ID!
    name: String!
    shortName: String
    typeId: ID
    countryId: ID
    persons(
      includeContactDetails: Boolean = false
      includeProperties: Boolean = false
      includeIdentifiers: Boolean = false
    ): [Person!]!
    competitors: [Competitor!]!
  }

  type Person {
    id: ID!
    firstName: String!
    lastName: String!
    birthDate: String
    sex: Sex
    nationalityId: ID
    organisationId: ID
    organisation: Organisation
    starts(eventIds: [ID!], fromDate: String, toDate: String): XmlDocument!
    results(
      eventIds: [ID!]
      fromDate: String
      toDate: String
      includeSplitTimes: Boolean = false
      top: Int
    ): XmlDocument!
  }

  type Competitor {
    id: ID!
    person: Person
    organisation: Organisation
    cardIds: [ID!]!
    preselectedClassIds: [ID!]!
    disciplineId: ID
  }

  type Entry {
    id: ID!
    competitorId: ID!
    person: Person
    organisation: Organisation
    cardId: ID
    eventClassId: ID
    event: Event
    eventId: ID
  }

  type EventClass {
    id: ID!
    name: String!
    shortName: String
    lowAge: Int
    highAge: Int
    sex: String
    numberOfEntries: Int
  }

  type EventDocument {
    id: ID!
    referenceId: ID
    name: String
    url: String
    modifyDate: String
    documentType: String
  }

  type EntryFee {
    id: ID!
    name: String
    amount: String
    currency: String
    taxIncluded: String
    entryFeeType: String
    feeType: String
    validToDate: String
  }

  type CompetitorCount {
    eventId: ID!
    numberOfEntries: Int
    numberOfStarts: Int
  }

  type Query {
    events(input: EventsInput): [Event!]!
    event(id: ID!): Event!
    organisations(includeProperties: Boolean = false): [Organisation!]!
    organisation(id: ID!): Organisation!
    organisationByApiKey: Organisation!
    persons(
      organisationId: ID!
      includeContactDetails: Boolean = false
      includeProperties: Boolean = false
      includeIdentifiers: Boolean = false
    ): [Person!]!
    competitors(organisationId: ID!): [Competitor!]!
    competitor(id: ID!): Competitor!
    entries(input: EntriesInput): [Entry!]!
    eventClasses(eventId: ID!, includeEntryFees: Boolean = false): [EventClass!]!
    entryFees(eventId: ID!): [EntryFee!]!
    documents(input: DocumentsInput): [EventDocument!]!
    competitorCounts(input: CompetitorCountInput!): [CompetitorCount!]!
    starts(eventId: ID!): XmlDocument!
    startsForOrganisations(organisationIds: [ID!]!, eventId: ID!): XmlDocument!
    results(eventId: ID!, includeSplitTimes: Boolean = false, top: Int): XmlDocument!
    resultsForOrganisations(
      organisationIds: [ID!]!
      eventId: ID!
      includeSplitTimes: Boolean = false
      top: Int
    ): XmlDocument!
    raw(endpoint: RawEndpoint!, id: ID, query: JSON): XmlDocument!
  }

  type Mutation {
    importStartList(xml: String!): XmlDocument!
    importResultList(xml: String!): XmlDocument!
    updateCompetitor(xml: String!): XmlDocument!
  }
`;

export interface GraphQLContext {
  client: EventorClient;
}

function literal(node: ValueNode): unknown {
  switch (node.kind) {
    case Kind.NULL:
      return null;
    case Kind.STRING:
    case Kind.BOOLEAN:
      return node.value;
    case Kind.INT:
    case Kind.FLOAT:
      return Number(node.value);
    case Kind.LIST:
      return node.values.map(literal);
    case Kind.OBJECT:
      return Object.fromEntries(node.fields.map((field) => [field.name.value, literal(field.value)]));
    default:
      return null;
  }
}

const jsonScalar = new GraphQLScalarType({
  name: "JSON",
  description: "A JSON value used for lossless access to less common Eventor XML structures.",
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral: literal,
});

function asQuery(value: unknown): Query {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const query: Query = {};
  for (const [key, item] of Object.entries(value)) {
    if (
      typeof item === "string" ||
      typeof item === "number" ||
      typeof item === "boolean" ||
      item === null ||
      (Array.isArray(item) && item.every((part) => typeof part === "string"))
    ) {
      query[key] = item as QueryValue;
    }
  }
  return query;
}

function eventsQuery(input: Record<string, unknown> | null | undefined): Query {
  const query = asQuery(input);
  const classification = input?.classification;
  if (Array.isArray(classification)) {
    query.classificationIds = classification.map((value) =>
      eventorClassificationToId(value as EventClassificationFilterValue),
    );
    delete query.classification;
  }
  return query;
}

function entriesQuery(input: Record<string, unknown> | null | undefined): Query {
  const query = asQuery(input);
  query.includePersonElement = input?.includePerson === undefined ? true : Boolean(input.includePerson);
  query.includeOrganisationElement =
    input?.includeOrganisation === undefined ? true : Boolean(input.includeOrganisation);
  query.includeEventElement = input?.includeEvent === undefined ? true : Boolean(input.includeEvent);
  delete query.includePerson;
  delete query.includeOrganisation;
  delete query.includeEvent;
  return query;
}

async function xmlDocument(client: EventorClient, path: string, query: Query = {}) {
  return parseDocument(await client.get(path, query));
}

const rawPaths: Record<string, string> = {
  EVENTS_IOF_XML: "events/iofxml",
  ORGANISATIONS_IOF_XML: "organisations/iofxml",
  STARTS_IOF_XML: "starts/event/iofxml",
  RESULTS_IOF_XML: "results/event/iofxml",
  ACTIVITIES: "activities",
  ACTIVITY: "activity",
  MEMBERSHIPS: "memberships",
  EXPORT_COMPETITORS: "export/competitors",
  WRS_EVENTS: "wrsevents",
  WRS_RESULTS: "wrsresults/event",
  EXTERNAL_LOGIN_URL: "externalLoginUrl",
};

export const resolvers = {
  JSON: jsonScalar,
  EventClassification: {
    INTERNATIONAL: EventClassification.International,
    CHAMPIONSHIP: EventClassification.Championship,
    NATIONAL: EventClassification.National,
    REGIONAL: EventClassification.Regional,
    NEARBY: EventClassification.Nearby,
    CLUB: EventClassification.Club,
  },
  EventClassificationFilter: {
    CHAMPIONSHIP: EventClassificationFilter.Championship,
    NATIONAL: EventClassificationFilter.National,
    REGIONAL: EventClassificationFilter.Regional,
    NEARBY: EventClassificationFilter.Nearby,
    CLUB: EventClassificationFilter.Club,
  },
  Query: {
    events: async (_: unknown, { input }: { input?: Record<string, unknown> }, { client }: GraphQLContext) =>
      parseEvents(await client.get("events", eventsQuery(input))),
    event: async (_: unknown, { id }: { id: string }, { client }: GraphQLContext) =>
      parseEvent(await client.get(`event/${encodeURIComponent(id)}`)),
    organisations: async (
      _: unknown,
      { includeProperties }: { includeProperties: boolean },
      { client }: GraphQLContext,
    ) => parseOrganisations(await client.get("organisations", { includeProperties })),
    organisation: async (_: unknown, { id }: { id: string }, { client }: GraphQLContext) =>
      parseOrganisation(await client.get(`organisation/${encodeURIComponent(id)}`)),
    organisationByApiKey: async (_: unknown, __: unknown, { client }: GraphQLContext) =>
      parseOrganisation(await client.get("organisation/apiKey")),
    persons: async (_: unknown, args: Record<string, QueryValue>, { client }: GraphQLContext) => {
      const { organisationId, ...query } = args;
      return parsePersons(
        await client.get(`persons/organisations/${encodeURIComponent(String(organisationId))}`, {
          includeContactDetails: query.includeContactDetails,
          includePersonProperties: query.includeProperties,
          includePersonIdentifiers: query.includeIdentifiers,
        }),
      );
    },
    competitors: async (
      _: unknown,
      { organisationId }: { organisationId: string },
      { client }: GraphQLContext,
    ) => parseCompetitors(await client.get("competitors", { organisationId })),
    competitor: async (_: unknown, { id }: { id: string }, { client }: GraphQLContext) =>
      parseCompetitor(await client.get(`competitor/${encodeURIComponent(id)}`)),
    entries: async (_: unknown, { input }: { input?: Record<string, unknown> }, { client }: GraphQLContext) =>
      parseEntries(await client.get("entries", entriesQuery(input))),
    eventClasses: async (
      _: unknown,
      args: { eventId: string; includeEntryFees: boolean },
      { client }: GraphQLContext,
    ) => parseEventClasses(await client.get("eventclasses", args)),
    entryFees: async (_: unknown, { eventId }: { eventId: string }, { client }: GraphQLContext) =>
      parseEntryFees(await client.get(`entryfees/events/${encodeURIComponent(eventId)}`)),
    documents: async (_: unknown, { input }: { input?: Record<string, unknown> }, { client }: GraphQLContext) =>
      parseDocuments(await client.get("events/documents", asQuery(input))),
    competitorCounts: async (
      _: unknown,
      { input }: { input: Record<string, unknown> },
      { client }: GraphQLContext,
    ) => parseCompetitorCounts(await client.get("competitorcount", asQuery(input))),
    starts: async (_: unknown, { eventId }: { eventId: string }, { client }: GraphQLContext) =>
      xmlDocument(client, "starts/event", { eventId }),
    startsForOrganisations: async (_: unknown, args: Query, { client }: GraphQLContext) =>
      xmlDocument(client, "starts/organisation", args),
    results: async (_: unknown, args: Query, { client }: GraphQLContext) =>
      xmlDocument(client, "results/event", args),
    resultsForOrganisations: async (_: unknown, args: Query, { client }: GraphQLContext) =>
      xmlDocument(client, "results/organisation", args),
    raw: async (
      _: unknown,
      { endpoint, id, query }: { endpoint: string; id?: string; query?: unknown },
      { client }: GraphQLContext,
    ) => {
      const path =
        endpoint === "EVENT_IOF_XML"
          ? id === undefined
            ? null
            : `event/iofxml/${encodeURIComponent(id)}`
          : rawPaths[endpoint];
      if (path === null) throw new Error("id is required for EVENT_IOF_XML");
      if (path === undefined) throw new Error(`Unsupported raw endpoint: ${endpoint}`);
      return xmlDocument(client, path, asQuery(query));
    },
  },
  Mutation: {
    importStartList: async (_: unknown, { xml }: { xml: string }, { client }: GraphQLContext) =>
      parseDocument(await client.post("import/startlist", xml)),
    importResultList: async (_: unknown, { xml }: { xml: string }, { client }: GraphQLContext) =>
      parseDocument(await client.post("import/resultlist", xml)),
    updateCompetitor: async (_: unknown, { xml }: { xml: string }, { client }: GraphQLContext) =>
      parseDocument(await client.put("competitor", xml)),
  },
  Event: {
    organisers: async (event: Event, _: unknown, { client }: GraphQLContext) =>
      Promise.all(
        event.organiserIds.map(async (id) =>
          parseOrganisation(await client.get(`organisation/${encodeURIComponent(id)}`)),
        ),
      ),
    classes: async (
      event: Event,
      { includeEntryFees }: { includeEntryFees: boolean },
      { client }: GraphQLContext,
    ) => parseEventClasses(await client.get("eventclasses", { eventId: event.id, includeEntryFees })),
    documents: async (event: Event, _: unknown, { client }: GraphQLContext) =>
      parseDocuments(await client.get("events/documents", { eventIds: [event.id] })),
    starts: async (event: Event, _: unknown, { client }: GraphQLContext) =>
      xmlDocument(client, "starts/event", { eventId: event.id }),
    results: async (
      event: Event,
      args: { includeSplitTimes: boolean; top?: number },
      { client }: GraphQLContext,
    ) => xmlDocument(client, "results/event", { eventId: event.id, ...args }),
  },
  Organisation: {
    persons: async (organisation: Organisation, args: Query, { client }: GraphQLContext) =>
      parsePersons(
        await client.get(`persons/organisations/${encodeURIComponent(organisation.id)}`, {
          includeContactDetails: args.includeContactDetails,
          includePersonProperties: args.includeProperties,
          includePersonIdentifiers: args.includeIdentifiers,
        }),
      ),
    competitors: async (organisation: Organisation, _: unknown, { client }: GraphQLContext) =>
      parseCompetitors(await client.get("competitors", { organisationId: organisation.id })),
  },
  Person: {
    organisation: async (person: Person, _: unknown, { client }: GraphQLContext) =>
      person.organisationId === null
        ? null
        : parseOrganisation(
            await client.get(`organisation/${encodeURIComponent(person.organisationId)}`),
          ),
    starts: async (person: Person, args: Query, { client }: GraphQLContext) =>
      xmlDocument(client, "starts/person", { personId: person.id, ...args }),
    results: async (person: Person, args: Query, { client }: GraphQLContext) =>
      xmlDocument(client, "results/person", { personId: person.id, ...args }),
  },
};
