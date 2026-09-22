import {
  attribute,
  dateTime,
  list,
  parseXml,
  record,
  records,
  root,
  text,
  toJson,
  type XmlRecord,
} from "./xml.js";
import { eventorParsers } from "./rescript-eventor.js";

export type EventClassification = "CHAMPIONSHIP" | "NATIONAL" | "REGIONAL" | "NEARBY" | "CLUB";
export type Sex = "MALE" | "FEMALE";

export interface Event {
  id: string;
  name: string;
  startDate: string | null;
  finishDate: string | null;
  classification: EventClassification | null;
  statusId: string | null;
  disciplineId: string | null;
  organiserIds: string[];
  eventForm: string | null;
}

export interface Organisation {
  id: string;
  name: string;
  shortName: string | null;
  typeId: string | null;
  countryId: string | null;
}

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  sex: Sex | null;
  nationalityId: string | null;
  organisationId: string | null;
}

export interface Competitor {
  id: string;
  person: Person | null;
  organisation: Organisation | null;
  cardIds: string[];
  preselectedClassIds: string[];
  disciplineId: string | null;
}

export interface Entry {
  id: string;
  competitorId: string;
  person: Person | null;
  organisation: Organisation | null;
  cardId: string | null;
  eventClassId: string | null;
  event: Event | null;
  eventId: string | null;
}

export interface EventClass {
  id: string;
  name: string;
  shortName: string | null;
  lowAge: number | null;
  highAge: number | null;
  sex: string | null;
  numberOfEntries: number | null;
}

export interface EventDocument {
  id: string;
  referenceId: string | null;
  name: string | null;
  url: string | null;
  modifyDate: string | null;
  documentType: string | null;
}

export interface EntryFee {
  id: string;
  name: string | null;
  amount: string | null;
  currency: string | null;
  taxIncluded: string | null;
  entryFeeType: string | null;
  feeType: string | null;
  validToDate: string | null;
}

export interface CompetitorCount {
  eventId: string;
  numberOfEntries: number | null;
  numberOfStarts: number | null;
}

const classifications: Record<string, EventClassification> = {
  "1": "CHAMPIONSHIP",
  "2": "NATIONAL",
  "3": "REGIONAL",
  "4": "NEARBY",
  "5": "CLUB",
};

function id(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseCountryId(node: XmlRecord): string | null {
  const direct = record(node.CountryId);
  const nested = record(record(node.Country).CountryId);
  return attribute(direct, "value") ?? text(node.CountryId) ?? attribute(nested, "value") ?? text(nested);
}

export function parseEventNode(node: XmlRecord): Event {
  const organiser = record(node.Organiser);
  const nestedOrganisation = record(organiser.Organisation);
  const organiserIds = [
    ...list(organiser.OrganisationId),
    ...list(nestedOrganisation.OrganisationId),
  ]
    .map((value) => text(value))
    .filter((value): value is string => value !== null);

  const classificationId = text(node.EventClassificationId);
  return {
    id: id(text(node.EventId)),
    name: text(node.Name) ?? "",
    startDate: dateTime(node.StartDate),
    finishDate: dateTime(node.FinishDate),
    classification: classificationId === null ? null : (classifications[classificationId] ?? null),
    statusId: text(node.EventStatusId),
    disciplineId: text(node.DisciplineId),
    organiserIds: [...new Set(organiserIds)],
    eventForm: attribute(node, "eventForm"),
  };
}

export function parseOrganisationNode(node: XmlRecord): Organisation {
  return {
    id: id(text(node.OrganisationId) ?? text(node.Id)),
    name: text(node.Name) ?? "",
    shortName: text(node.ShortName),
    typeId: text(node.OrganisationTypeId),
    countryId: parseCountryId(node),
  };
}

export function parsePersonNode(node: XmlRecord): Person {
  const name = record(node.PersonName ?? node.Name);
  const sex = attribute(node, "sex");
  return {
    id: id(text(node.PersonId) ?? text(node.Id)),
    firstName: text(name.Given) ?? "",
    lastName: text(name.Family) ?? "",
    birthDate: dateTime(node.BirthDate) ?? text(node.BirthDate),
    sex: sex === "M" ? "MALE" : sex === "F" ? "FEMALE" : null,
    nationalityId: parseCountryId(record(node.Nationality)),
    organisationId: text(node.OrganisationId),
  };
}

export function parseCompetitorNode(node: XmlRecord): Competitor {
  const personNode = record(node.Person);
  const organisationNode = record(node.Organisation);
  return {
    id: id(text(node.CompetitorId)),
    person: Object.keys(personNode).length === 0 ? null : parsePersonNode(personNode),
    organisation:
      Object.keys(organisationNode).length === 0 ? null : parseOrganisationNode(organisationNode),
    cardIds: records(node.CCard)
      .map((card) => text(card.CCardId))
      .filter((value): value is string => value !== null),
    preselectedClassIds: records(node.PreSelectedClass)
      .map((item) => text(item.BaseClassId))
      .filter((value): value is string => value !== null),
    disciplineId: text(node.DisciplineId),
  };
}

export function parseEntryNode(node: XmlRecord): Entry {
  const competitorNode = record(node.Competitor);
  const personNode = record(competitorNode.Person);
  const organisationNode = record(competitorNode.Organisation);
  const eventNode = record(node.Event);
  const parsedEvent = Object.keys(eventNode).length === 0 ? null : parseEventNode(eventNode);
  const firstCard = records(competitorNode.CCard)[0];
  return {
    id: id(text(node.EntryId)),
    competitorId: id(text(competitorNode.CompetitorId)),
    person: Object.keys(personNode).length === 0 ? null : parsePersonNode(personNode),
    organisation:
      Object.keys(organisationNode).length === 0 ? null : parseOrganisationNode(organisationNode),
    cardId: firstCard === undefined ? null : text(firstCard.CCardId),
    eventClassId: text(record(node.EntryClass).EventClassId),
    event: parsedEvent,
    eventId: parsedEvent?.id ?? text(node.EventId),
  };
}

export function parseEvents(xml: string): Event[] {
  return records(root(parseXml(xml), "EventList").Event).map(parseEventNode);
}

export function parseEvent(xml: string): Event {
  return parseEventNode(root(parseXml(xml), "Event"));
}

export function parseOrganisations(xml: string): Organisation[] {
  return eventorParsers.organisations(xml).map((organisation) => ({
    id: organisation.id,
    name: organisation.name,
    shortName: organisation.shortName ?? null,
    typeId: organisation.typeId ?? null,
    countryId: organisation.countryId ?? null,
  }));
}

export function parseOrganisation(xml: string): Organisation {
  const organisation = parseOrganisations(xml)[0];
  if (organisation === undefined) throw new Error("No Organisation element found");
  return organisation;
}

export function parsePersons(xml: string): Person[] {
  return eventorParsers.persons(xml).map((person) => ({
    id: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    birthDate: person.birthDate ?? null,
    sex: person.sex === "Male" ? "MALE" : person.sex === "Female" ? "FEMALE" : null,
    nationalityId: person.nationalityId ?? null,
    organisationId: person.organisationId ?? null,
  }));
}

export function parseCompetitors(xml: string): Competitor[] {
  return records(root(parseXml(xml), "CompetitorList").Competitor).map(parseCompetitorNode);
}

export function parseCompetitor(xml: string): Competitor {
  return parseCompetitorNode(root(parseXml(xml), "Competitor"));
}

export function parseEntries(xml: string): Entry[] {
  return records(root(parseXml(xml), "EntryList").Entry).map(parseEntryNode);
}

export function parseEventClasses(xml: string): EventClass[] {
  return eventorParsers.eventClasses(xml).map((eventClass) => ({
    id: eventClass.id,
    name: eventClass.name,
    shortName: eventClass.shortName ?? null,
    lowAge: eventClass.lowAge ?? null,
    highAge: eventClass.highAge ?? null,
    sex: eventClass.sex ?? null,
    numberOfEntries: eventClass.numberOfEntries ?? null,
  }));
}

export function parseDocuments(xml: string): EventDocument[] {
  return eventorParsers.documents(xml).map((document) => ({
    id: document.id,
    referenceId: document.referenceId ?? null,
    name: document.name ?? null,
    url: document.url ?? null,
    modifyDate: document.modifyDate ?? null,
    documentType: document.documentType ?? null,
  }));
}

export function parseEntryFees(xml: string): EntryFee[] {
  return eventorParsers.entryFees(xml).map((fee) => ({
    id: fee.id,
    name: fee.name ?? null,
    amount: fee.amount ?? null,
    currency: fee.currency ?? null,
    taxIncluded: fee.taxIncluded ?? null,
    entryFeeType: fee.entryFeeType ?? null,
    feeType: fee.feeType ?? null,
    validToDate: fee.validToDate ?? null,
  }));
}

export function parseCompetitorCounts(xml: string): CompetitorCount[] {
  return eventorParsers.competitorCounts(xml).map((count) => ({
    eventId: count.eventId,
    numberOfEntries: count.numberOfEntries ?? null,
    numberOfStarts: count.numberOfStarts ?? null,
  }));
}

export function parseDocument(xml: string): unknown {
  const document = parseXml(xml);
  const [name, value] = Object.entries(document).find(([key]) => !key.startsWith("?")) ?? [];
  if (name === undefined || value === undefined) return { root: "", data: null, xml };
  return { root: name, data: toJson(value), xml };
}
