import assert from "node:assert/strict";
import test from "node:test";
import {
  parseDocument,
  parseEntries,
  parseEventClasses,
  parseEventResults,
  parseEvents,
  parseOrganisation,
  parsePersonEventStarts,
} from "../src/domain.js";

test("ignores the XML declaration when reporting a raw document root", () => {
  const document = parseDocument(
    '<?xml version="1.0" encoding="utf-8"?><ResultList><Event><Name>Race</Name></Event></ResultList>',
  ) as { root: string };

  assert.equal(document.root, "ResultList");
});

test("parses typed result relationships", () => {
  const results = parseEventResults(`
    <ResultList>
      <Event><EventId>70</EventId><Name>Race</Name></Event>
      <ClassResult>
        <EventClass><EventClassId>60</EventClassId><Name>H21</Name></EventClass>
        <PersonResult>
          <Person><PersonId>30</PersonId><PersonName><Given>Ola</Given><Family>Nordmann</Family></PersonName></Person>
          <Organisation><OrganisationId>40</OrganisationId><Name>Example OK</Name></Organisation>
          <Result><Time>00:35:42</Time></Result>
        </PersonResult>
      </ClassResult>
    </ResultList>
  `);

  assert.equal(results[0]?.eventId, "70");
  assert.equal(results[0]?.eventClassId, "60");
  assert.equal(results[0]?.person?.id, "30");
  assert.equal(results[0]?.organisation?.id, "40");
  assert.equal(results[0]?.time, "00:35:42");
});

test("parses an empty result-list collection", () => {
  assert.deepEqual(parseEventResults("<ResultListList />"), []);
});

test("parses native Eventor events into stable GraphQL values", () => {
  const events = parseEvents(`
    <EventList>
      <Event eventForm="IndSingleDay">
        <EventId>23894</EventId>
        <Name>Night race</Name>
        <StartDate><Date>2026-05-12</Date><Clock>17:30:00</Clock></StartDate>
        <EventClassificationId>4</EventClassificationId>
        <Organiser><OrganisationId>273</OrganisationId></Organiser>
      </Event>
    </EventList>
  `);

  assert.deepEqual(events, [
    {
      id: "23894",
      name: "Night race",
      startDate: "2026-05-12T17:30:00",
      finishDate: null,
      classification: "Nearby",
      statusId: null,
      disciplineId: null,
      organiserIds: ["273"],
      eventForm: "IndSingleDay",
    },
  ]);
});

test("maps Eventor classification 0 to an international event", () => {
  const events = parseEvents(`
    <EventList>
      <Event>
        <EventId>19379</EventId>
        <Name>NC, sprint</Name>
        <EventClassificationId>0</EventClassificationId>
      </Event>
    </EventList>
  `);

  assert.equal(events[0]?.classification, "International");
});

test("parses both text and attribute-based Eventor values", () => {
  const organisation = parseOrganisation(`
    <Organisation>
      <OrganisationId>273</OrganisationId>
      <Name>Example OK</Name>
      <CountryId value="578" />
    </Organisation>
  `);
  const classes = parseEventClasses(`
    <EventClassList>
      <EventClass lowAge="11" highAge="12" sex="F" numberOfEntries="5">
        <EventClassId>220810</EventClassId>
        <Name>D11-12</Name>
      </EventClass>
    </EventClassList>
  `);

  assert.equal(organisation.countryId, "578");
  assert.deepEqual(classes[0], {
    id: "220810",
    name: "D11-12",
    shortName: null,
    lowAge: 11,
    highAge: 12,
    sex: "F",
    numberOfEntries: 5,
  });
});

test("parses expanded entry relationships", () => {
  const entries = parseEntries(`
    <EntryList>
      <Entry>
        <EntryId>10</EntryId>
        <Competitor>
          <CompetitorId>20</CompetitorId>
          <Person sex="M"><PersonId>30</PersonId><PersonName><Given>Ola</Given><Family>Nordmann</Family></PersonName></Person>
          <Organisation><OrganisationId>40</OrganisationId><Name>Example OK</Name></Organisation>
          <CCard><CCardId>50</CCardId></CCard>
        </Competitor>
        <EntryClass><EventClassId>60</EventClassId></EntryClass>
        <Event><EventId>70</EventId><Name>Race</Name></Event>
      </Entry>
    </EntryList>
  `);

  assert.equal(entries[0]?.person?.firstName, "Ola");
  assert.equal(entries[0]?.organisation?.id, "40");
  assert.equal(entries[0]?.eventId, "70");
  assert.equal(entries[0]?.cardId, "50");
  assert.equal(entries[0]?.personId, "30");
  assert.equal(entries[0]?.organisationId, "40");
});

test("parses typed person starts with event relationships", () => {
  const starts = parsePersonEventStarts(
    `
      <StartListList>
        <StartList>
          <Event><EventId>70</EventId><Name>Race</Name></Event>
          <ClassStart>
            <PersonStart>
              <Person><PersonId>30</PersonId></Person>
              <Start><StartTime><Date>2026-05-12</Date><Clock>17:30:00</Clock></StartTime></Start>
            </PersonStart>
          </ClassStart>
        </StartList>
      </StartListList>
    `,
    {
      id: "30",
      firstName: "Ola",
      lastName: "Nordmann",
      birthDate: null,
      sex: null,
      nationalityId: null,
      organisationId: "40",
    },
  );

  assert.equal(starts[0]?.eventId, "70");
  assert.equal(starts[0]?.eventName, "Race");
  assert.equal(starts[0]?.personId, "30");
  assert.equal(starts[0]?.startTime, "2026-05-12T17:30:00");
});
