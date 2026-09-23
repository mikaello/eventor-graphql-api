import { XMLParser } from "fast-xml-parser";
import { measureXmlParsing } from "./timing.js";

export type XmlValue = string | XmlRecord | XmlValue[];
export type XmlRecord = { [key: string]: XmlValue | undefined };

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
  parseAttributeValue: false,
  parseTagValue: false,
  removeNSPrefix: true,
  trimValues: true,
});

export function parseXml(xml: string): XmlRecord {
  const parsed: unknown = measureXmlParsing(() => parser.parse(xml));
  if (!isRecord(parsed)) {
    throw new Error("Eventor returned an invalid XML document");
  }
  return parsed;
}

export function isRecord(value: unknown): value is XmlRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function record(value: XmlValue | undefined): XmlRecord {
  return isRecord(value) ? value : {};
}

export function list(value: XmlValue | undefined): XmlValue[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export function records(value: XmlValue | undefined): XmlRecord[] {
  return list(value).filter(isRecord);
}

export function text(value: XmlValue | undefined): string | null {
  if (typeof value === "string") return value === "" ? null : value;
  if (isRecord(value)) {
    const content = value["#text"];
    return typeof content === "string" && content !== "" ? content : null;
  }
  return null;
}

export function attribute(node: XmlRecord, name: string): string | null {
  return text(node[`@${name}`]);
}

export function integer(value: XmlValue | undefined): number | null {
  const raw = text(value);
  if (raw === null) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export function root(document: XmlRecord, name: string): XmlRecord {
  const value = document[name];
  if (value === "") return {};
  if (!isRecord(value)) {
    throw new Error(`Eventor XML did not contain a ${name} root element`);
  }
  return value;
}

export function dateTime(node: XmlValue | undefined): string | null {
  const value = record(node);
  const date = text(value.Date);
  if (date === null) return null;
  const clock = text(value.Clock);
  return clock === null ? date : `${date}T${clock}`;
}

/** Convert parser-specific attribute/text keys into a stable JSON representation. */
export function toJson(value: XmlValue): unknown {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(toJson);

  const attributes: Record<string, string> = {};
  const children: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (child === undefined) continue;
    if (key.startsWith("@")) {
      const attributeValue = text(child);
      if (attributeValue !== null) attributes[key.slice(1)] = attributeValue;
    } else if (key !== "#text") {
      children[key] = toJson(child);
    }
  }

  const content = text(value["#text"]);
  if (Object.keys(attributes).length === 0 && Object.keys(children).length === 0) {
    return content;
  }
  if (Object.keys(attributes).length > 0) children.attributes = attributes;
  if (content !== null) children.value = content;
  return children;
}
