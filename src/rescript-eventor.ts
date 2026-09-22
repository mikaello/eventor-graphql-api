import { DOMParser } from "@xmldom/xmldom";
import type {
  NativeCompetitorCount,
  NativeDocument,
  NativeEntryFee,
  NativeEventClass,
  NativeOrganisation,
  NativePerson,
  Result,
} from "rescript-eventor/Eventor";
import { EventClassification } from "rescript-eventor/Eventor";
import {
  fromId as classificationFromId,
  toId as classificationToId,
} from "rescript-eventor/src/EventClassification.res.mjs";
import { parse as parseCompetitorCounts } from "rescript-eventor/src/NativeCompetitorCount.res.mjs";
import { parse as parseDocuments } from "rescript-eventor/src/NativeDocument.res.mjs";
import { parse as parseEntryFees } from "rescript-eventor/src/NativeEntryFee.res.mjs";
import { parse as parseEventClasses } from "rescript-eventor/src/NativeEventClass.res.mjs";
import { parse as parseOrganisations } from "rescript-eventor/src/NativeOrganisation.res.mjs";
import { parse as parsePersons } from "rescript-eventor/src/NativePerson.res.mjs";

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

export function eventorClassificationFromId(id: string): string | undefined {
  return classificationFromId(id)?.toUpperCase();
}

export function eventorClassificationToId(name: string): string | undefined {
  const classification = Object.values(EventClassification).find(
    (value) => value.toUpperCase() === name,
  );
  return classification === undefined ? undefined : classificationToId(classification);
}

export const eventorParsers = {
  competitorCounts: (xml: string): NativeCompetitorCount[] => unwrap(parseCompetitorCounts(xml)),
  documents: (xml: string): NativeDocument[] => unwrap(parseDocuments(xml)),
  entryFees: (xml: string): NativeEntryFee[] => unwrap(parseEntryFees(xml)),
  eventClasses: (xml: string): NativeEventClass[] => unwrap(parseEventClasses(xml)),
  organisations: (xml: string): NativeOrganisation[] => unwrap(parseOrganisations(xml)),
  persons: (xml: string): NativePerson[] => unwrap(parsePersons(xml)),
};
