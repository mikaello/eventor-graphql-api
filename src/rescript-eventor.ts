import { DOMParser } from "@xmldom/xmldom";
import type {
  EventClassification,
  EventClassificationFilter,
  NativeCompetitorCount,
  NativeDocument,
  NativeEntryFee,
  NativeEventClass,
  NativeOrganisation,
  NativePerson,
  NativeFullStartList,
  NativeResultList,
  NativeStartList,
  Result,
} from "rescript-eventor/Eventor";
import { fromId as classificationFromId } from "rescript-eventor/src/EventClassification.res.mjs";
import { toId as classificationFilterToId } from "rescript-eventor/src/EventClassificationFilter.res.mjs";
import { parse as parseCompetitorCounts } from "rescript-eventor/src/NativeCompetitorCount.res.mjs";
import { parse as parseDocuments } from "rescript-eventor/src/NativeDocument.res.mjs";
import { parse as parseEntryFees } from "rescript-eventor/src/NativeEntryFee.res.mjs";
import { parse as parseEventClasses } from "rescript-eventor/src/NativeEventClass.res.mjs";
import { parse as parseOrganisations } from "rescript-eventor/src/NativeOrganisation.res.mjs";
import { parse as parsePersons } from "rescript-eventor/src/NativePerson.res.mjs";
import { parse as parsePersonStarts } from "rescript-eventor/src/NativeStartList.res.mjs";
import { parseFull as parseEventStarts } from "rescript-eventor/src/NativeStartList.res.mjs";
import { parse as parseResults } from "rescript-eventor/src/NativeResultList.res.mjs";
import { measureXmlParsing } from "./timing.js";

if (!("DOMParser" in globalThis)) {
  Object.defineProperty(globalThis, "DOMParser", {
    configurable: true,
    value: DOMParser,
    writable: true,
  });
}

function unwrap<T>(result: Result<T>): T {
  if (result.TAG === "Error") throw new Error(`Unable to parse Eventor XML: ${result._0}`);
  return result._0;
}

export function eventorClassificationFromId(id: string): EventClassification | undefined {
  return classificationFromId(id);
}

export function eventorClassificationToId(classification: EventClassificationFilter): string {
  return classificationFilterToId(classification);
}

export const eventorParsers = {
  competitorCounts: (xml: string): NativeCompetitorCount[] =>
    measureXmlParsing(() => unwrap(parseCompetitorCounts(xml))),
  documents: (xml: string): NativeDocument[] =>
    measureXmlParsing(() => unwrap(parseDocuments(xml))),
  entryFees: (xml: string): NativeEntryFee[] =>
    measureXmlParsing(() => unwrap(parseEntryFees(xml))),
  eventClasses: (xml: string): NativeEventClass[] =>
    measureXmlParsing(() => unwrap(parseEventClasses(xml))),
  organisations: (xml: string): NativeOrganisation[] =>
    measureXmlParsing(() => unwrap(parseOrganisations(xml))),
  persons: (xml: string): NativePerson[] =>
    measureXmlParsing(() => unwrap(parsePersons(xml))),
  personStarts: (xml: string): NativeStartList[] =>
    measureXmlParsing(() => unwrap(parsePersonStarts(xml))),
  eventStarts: (xml: string): NativeFullStartList =>
    measureXmlParsing(() => unwrap(parseEventStarts(xml))),
  results: (xml: string): NativeResultList[] =>
    measureXmlParsing(() => unwrap(parseResults(xml))),
};
