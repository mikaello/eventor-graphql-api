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
  parseEventResults,
  parseEventStarts,
  parseEvents,
  parseOrganisation,
  parseOrganisations,
  parsePersons,
  parseDocument,
  parsePersonEventStarts,
  type Competitor,
  type CompetitorCount,
  type Entry,
  type EntryFee,
  type Event,
  type EventClass,
  type EventDocument,
  type EventResult,
  type EventStart,
  type Organisation,
  type Person,
} from "./domain.js";
import type { EventorClient, Query, QueryValue } from "./eventor-client.js";
import type { RequestLoaders } from "./loaders.js";
import { eventorClassificationToId } from "./rescript-eventor.js";
import { markInitialEventsResolved, measureInitialEventsFetch } from "./timing.js";

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
    entries: [Entry!]!
    classes(includeEntryFees: Boolean = false): [EventClass!]!
    entryFees: [EntryFee!]!
    documents: [EventDocument!]!
    competitorCount(organisationIds: [ID!]!, personIds: [ID!]): CompetitorCount
    startRecords: [EventStart!]!
    resultRecords(includeSplitTimes: Boolean = false, top: Int): [EventResult!]!
    iofXml: XmlDocument!
    startsIofXml(eventRaceId: ID): XmlDocument!
    resultsIofXml(
      eventRaceId: ID
      includeSplitTimes: Boolean = false
      totalResult: Boolean = false
    ): XmlDocument!
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
    events(input: EventsInput): [Event!]!
    documents(input: DocumentsInput): [EventDocument!]!
    entries(eventIds: [ID!]!, eventClassIds: [ID!]): [Entry!]!
    competitorCounts(eventIds: [ID!], personIds: [ID!]): [CompetitorCount!]!
    startRecords(eventId: ID!): [EventStart!]!
    resultRecords(
      eventId: ID!
      includeSplitTimes: Boolean = false
      top: Int
    ): [EventResult!]!
    activities(from: String!, to: String!, includeRegistrations: Boolean = false): XmlDocument!
    activity(id: ID!, includeRegistrations: Boolean = false): XmlDocument!
    memberships(
      year: Int!
      includeChildOrganisations: Boolean = false
      includeContactDetails: Boolean = false
    ): XmlDocument!
    exportedCompetitors(
      version: String = "3.0"
      includePreselectedClasses: Boolean = false
    ): XmlDocument!
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
    competitor: Competitor
    startRecords(eventIds: [ID!], fromDate: String, toDate: String): [EventStart!]!
    resultRecords(
      eventIds: [ID!]
      fromDate: String
      toDate: String
      includeSplitTimes: Boolean = false
      top: Int
    ): [EventResult!]!
    competitorCounts(eventIds: [ID!]): [CompetitorCount!]!
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
    competitor: Competitor!
    person: Person
    organisation: Organisation
    cardId: ID
    eventClassId: ID
    eventClass: EventClass
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
    event: Event
    wrsResultRecords: [EventResult!]!
    wrsResults: XmlDocument!
  }

  type EventDocument {
    id: ID!
    referenceId: ID
    name: String
    url: String
    modifyDate: String
    documentType: String
    event: Event
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
    event: Event
  }

  type CompetitorCount {
    eventId: ID!
    numberOfEntries: Int
    numberOfStarts: Int
    event: Event!
  }

  type EventStart {
    personId: ID
    person: Person
    organisationId: ID
    organisation: Organisation
    eventId: ID!
    event: Event!
    eventClassId: ID
    eventClass: EventClass
    className: String
    classShortName: String
    controlCardId: ID
    startTime: String
    startId: ID
  }

  type EventResult {
    personId: ID
    person: Person
    organisationId: ID
    organisation: Organisation
    eventId: ID!
    event: Event!
    eventClassId: ID
    eventClass: EventClass
    time: String
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
  loaders: RequestLoaders;
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
    events: async (
      _: unknown,
      { input }: { input?: Record<string, unknown> },
      { client, loaders }: GraphQLContext,
    ) => {
      const xml = await measureInitialEventsFetch(() => client.get("events", eventsQuery(input)));
      const events = parseEvents(xml);
      events.forEach((event) => loaders.eventsById.prime(event));
      markInitialEventsResolved();
      return events;
    },
    event: async (
      _: unknown,
      { id }: { id: string },
      { client, loaders }: GraphQLContext,
    ) => loaders.eventsById.prime(parseEvent(await client.get(`event/${encodeURIComponent(id)}`))),
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
    ) =>
      parseEventClasses(await client.get("eventclasses", args)).map((eventClass) => ({
        ...eventClass,
        eventId: args.eventId,
      })),
    entryFees: async (_: unknown, { eventId }: { eventId: string }, { client }: GraphQLContext) =>
      parseEntryFees(await client.get(`entryfees/events/${encodeURIComponent(eventId)}`)).map(
        (entryFee) => ({ ...entryFee, eventId }),
      ),
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
    entries: async (event: Event, _: unknown, { loaders }: GraphQLContext) =>
      loaders.entriesByEvent.load(event.id),
    classes: async (
      event: Event,
      { includeEntryFees }: { includeEntryFees: boolean },
      { client }: GraphQLContext,
    ) =>
      parseEventClasses(
        await client.get("eventclasses", { eventId: event.id, includeEntryFees }),
      ).map((eventClass) => ({ ...eventClass, eventId: event.id })),
    entryFees: async (event: Event, _: unknown, { client }: GraphQLContext) =>
      parseEntryFees(await client.get(`entryfees/events/${encodeURIComponent(event.id)}`)).map(
        (entryFee) => ({ ...entryFee, eventId: event.id }),
      ),
    documents: async (event: Event, _: unknown, { client }: GraphQLContext) =>
      parseDocuments(await client.get("events/documents", { eventIds: [event.id] })),
    competitorCount: async (
      event: Event,
      { organisationIds, personIds }: { organisationIds: string[]; personIds?: string[] },
      { loaders }: GraphQLContext,
    ) => loaders.competitorCountsByEvent.load({ eventId: event.id, organisationIds, personIds }),
    startRecords: async (event: Event, _: unknown, { client }: GraphQLContext) =>
      parseEventStarts(await client.get("starts/event", { eventId: event.id })),
    resultRecords: async (
      event: Event,
      args: { includeSplitTimes: boolean; top?: number },
      { client }: GraphQLContext,
    ) => parseEventResults(await client.get("results/event", { eventId: event.id, ...args })),
    iofXml: async (event: Event, _: unknown, { client }: GraphQLContext) =>
      xmlDocument(client, `event/iofxml/${encodeURIComponent(event.id)}`),
    startsIofXml: async (event: Event, args: Query, { client }: GraphQLContext) =>
      xmlDocument(client, "starts/event/iofxml", { eventId: event.id, ...args }),
    resultsIofXml: async (event: Event, args: Query, { client }: GraphQLContext) =>
      xmlDocument(client, "results/event/iofxml", { eventId: event.id, ...args }),
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
    events: async (
      organisation: Organisation,
      { input }: { input?: Record<string, unknown> },
      { client, loaders }: GraphQLContext,
    ) => {
      const events = parseEvents(
        await client.get("events", {
          ...eventsQuery(input),
          organisationIds: [organisation.id],
        }),
      );
      events.forEach((event) => loaders.eventsById.prime(event));
      return events;
    },
    documents: async (
      organisation: Organisation,
      { input }: { input?: Record<string, unknown> },
      { client }: GraphQLContext,
    ) =>
      parseDocuments(
        await client.get("events/documents", {
          ...asQuery(input),
          organisationIds: [organisation.id],
        }),
      ),
    entries: async (
      organisation: Organisation,
      { eventIds, eventClassIds }: { eventIds: string[]; eventClassIds?: string[] },
      { client }: GraphQLContext,
    ) =>
      parseEntries(
        await client.get("entries", {
          organisationIds: [organisation.id],
          eventIds,
          eventClassIds,
          includePersonElement: true,
          includeOrganisationElement: true,
          includeEventElement: true,
        }),
      ),
    competitorCounts: async (
      organisation: Organisation,
      { eventIds, personIds }: { eventIds?: string[]; personIds?: string[] },
      { client }: GraphQLContext,
    ) =>
      parseCompetitorCounts(
        await client.get("competitorcount", {
          organisationIds: [organisation.id],
          eventIds,
          personIds,
        }),
      ),
    startRecords: async (
      organisation: Organisation,
      { eventId }: { eventId: string },
      { client }: GraphQLContext,
    ) =>
      parseEventStarts(
        await client.get("starts/organisation", {
          organisationIds: [organisation.id],
          eventId,
        }),
      ),
    resultRecords: async (
      organisation: Organisation,
      args: { eventId: string; includeSplitTimes: boolean; top?: number },
      { client }: GraphQLContext,
    ) =>
      parseEventResults(
        await client.get("results/organisation", {
          organisationIds: [organisation.id],
          ...args,
        }),
      ),
    activities: async (organisation: Organisation, args: Query, { client }: GraphQLContext) =>
      xmlDocument(client, "activities", { organisationId: organisation.id, ...args }),
    activity: async (organisation: Organisation, args: Query, { client }: GraphQLContext) =>
      xmlDocument(client, "activity", { organisationId: organisation.id, ...args }),
    memberships: async (organisation: Organisation, args: Query, { client }: GraphQLContext) =>
      xmlDocument(client, "memberships", { organisationId: organisation.id, ...args }),
    exportedCompetitors: async (
      organisation: Organisation,
      args: Query,
      { client }: GraphQLContext,
    ) =>
      xmlDocument(client, "export/competitors", {
        organisationIds: [organisation.id],
        ...args,
        zip: false,
      }),
  },
  Person: {
    organisation: async (person: Person, _: unknown, { client }: GraphQLContext) =>
      person.organisationId === null
        ? null
        : parseOrganisation(
            await client.get(`organisation/${encodeURIComponent(person.organisationId)}`),
          ),
    competitor: async (person: Person, _: unknown, { client }: GraphQLContext) => {
      if (person.organisationId === null) return null;
      return (
        parseCompetitors(
          await client.get("competitors", { organisationId: person.organisationId }),
        ).find((competitor) => competitor.person?.id === person.id) ?? null
      );
    },
    startRecords: async (person: Person, args: Query, { client }: GraphQLContext) =>
      parsePersonEventStarts(
        await client.get("starts/person", { personId: person.id, ...args }),
        person,
      ),
    resultRecords: async (person: Person, args: Query, { client }: GraphQLContext) =>
      parseEventResults(
        await client.get("results/person", { personId: person.id, ...args }),
        person,
      ),
    competitorCounts: async (
      person: Person,
      { eventIds }: { eventIds?: string[] },
      { client }: GraphQLContext,
    ) =>
      person.organisationId === null
        ? []
        : parseCompetitorCounts(
            await client.get("competitorcount", {
              organisationIds: [person.organisationId],
              personIds: [person.id],
              eventIds,
            }),
          ),
    starts: async (person: Person, args: Query, { client }: GraphQLContext) =>
      xmlDocument(client, "starts/person", { personId: person.id, ...args }),
    results: async (person: Person, args: Query, { client }: GraphQLContext) =>
      xmlDocument(client, "results/person", { personId: person.id, ...args }),
  },
  Entry: {
    competitor: async (entry: Entry, _: unknown, { client }: GraphQLContext) =>
      parseCompetitor(await client.get(`competitor/${encodeURIComponent(entry.competitorId)}`)),
    person: async (entry: Entry, _: unknown, { client }: GraphQLContext) =>
      entry.person ??
      parseCompetitor(await client.get(`competitor/${encodeURIComponent(entry.competitorId)}`))
        .person,
    organisation: async (entry: Entry, _: unknown, { client }: GraphQLContext) => {
      if (entry.organisation !== null) return entry.organisation;
      if (entry.organisationId === null) return null;
      return parseOrganisation(
        await client.get(`organisation/${encodeURIComponent(entry.organisationId)}`),
      );
    },
    event: async (entry: Entry, _: unknown, { loaders }: GraphQLContext) =>
      entry.event ?? (entry.eventId === null ? null : loaders.eventsById.load(entry.eventId)),
    eventClass: async (entry: Entry, _: unknown, { client }: GraphQLContext) => {
      if (entry.eventId === null || entry.eventClassId === null) return null;
      const classes = parseEventClasses(
        await client.get("eventclasses", { eventId: entry.eventId, includeEntryFees: false }),
      );
      const eventClass = classes.find((item) => item.id === entry.eventClassId);
      return eventClass === undefined ? null : { ...eventClass, eventId: entry.eventId };
    },
  },
  EventClass: {
    event: async (eventClass: EventClass, _: unknown, { loaders }: GraphQLContext) =>
      eventClass.eventId === undefined ? null : loaders.eventsById.load(eventClass.eventId),
    wrsResultRecords: async (eventClass: EventClass, _: unknown, { client }: GraphQLContext) =>
      parseEventResults(await client.get("wrsresults/event", { classId: eventClass.id })),
    wrsResults: async (eventClass: EventClass, _: unknown, { client }: GraphQLContext) =>
      xmlDocument(client, "wrsresults/event", { classId: eventClass.id }),
  },
  EventDocument: {
    event: async (document: EventDocument, _: unknown, { loaders }: GraphQLContext) =>
      document.referenceId === null ? null : loaders.eventsById.load(document.referenceId),
  },
  EntryFee: {
    event: async (entryFee: EntryFee, _: unknown, { loaders }: GraphQLContext) =>
      entryFee.eventId === undefined ? null : loaders.eventsById.load(entryFee.eventId),
  },
  CompetitorCount: {
    event: async (count: CompetitorCount, _: unknown, { loaders }: GraphQLContext) =>
      loaders.eventsById.load(count.eventId),
  },
  EventStart: {
    event: async (start: EventStart, _: unknown, { loaders }: GraphQLContext) =>
      loaders.eventsById.load(start.eventId),
    organisation: async (start: EventStart, _: unknown, { client }: GraphQLContext) => {
      if (start.organisation !== null) return start.organisation;
      if (start.organisationId === null) return null;
      return parseOrganisation(
        await client.get(`organisation/${encodeURIComponent(start.organisationId)}`),
      );
    },
    eventClass: async (start: EventStart, _: unknown, { client }: GraphQLContext) => {
      if (start.eventClassId === null) return null;
      const classes = parseEventClasses(
        await client.get("eventclasses", { eventId: start.eventId, includeEntryFees: false }),
      );
      const eventClass = classes.find((item) => item.id === start.eventClassId);
      return eventClass === undefined ? null : { ...eventClass, eventId: start.eventId };
    },
  },
  EventResult: {
    event: async (result: EventResult, _: unknown, { loaders }: GraphQLContext) =>
      loaders.eventsById.load(result.eventId),
    organisation: async (result: EventResult, _: unknown, { client }: GraphQLContext) => {
      if (result.organisation !== null) return result.organisation;
      if (result.organisationId === null) return null;
      return parseOrganisation(
        await client.get(`organisation/${encodeURIComponent(result.organisationId)}`),
      );
    },
    eventClass: async (result: EventResult, _: unknown, { client }: GraphQLContext) => {
      if (result.eventClassId === null) return null;
      const classes = parseEventClasses(
        await client.get("eventclasses", { eventId: result.eventId, includeEntryFees: false }),
      );
      const eventClass = classes.find((item) => item.id === result.eventClassId);
      return eventClass === undefined ? null : { ...eventClass, eventId: result.eventId };
    },
  },
};
