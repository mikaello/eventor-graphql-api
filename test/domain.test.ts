import assert from "node:assert/strict";
import test from "node:test";
import {
  parseEntries,
  parseEventClasses,
  parseEvents,
  parseOrganisation,
} from "../src/domain.js";

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
      classification: "NEARBY",
      statusId: null,
      disciplineId: null,
      organiserIds: ["273"],
      eventForm: "IndSingleDay",
    },
  ]);
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
});
