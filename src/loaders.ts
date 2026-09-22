import {
  parseCompetitorCounts,
  parseEntries,
  parseEvents,
  type CompetitorCount,
  type Entry,
  type Event,
} from "./domain.js";
import type { EventorClient } from "./eventor-client.js";

interface Deferred<T> {
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function deferred<T>(): { promise: Promise<T>; handlers: Deferred<T> } {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, handlers: { resolve, reject } };
}

export class EventByIdLoader {
  readonly #client: EventorClient;
  readonly #cache = new Map<string, Promise<Event>>();
  #pending = new Map<string, Deferred<Event>>();
  #scheduled = false;

  constructor(client: EventorClient) {
    this.#client = client;
  }

  load(id: string): Promise<Event> {
    const cached = this.#cache.get(id);
    if (cached !== undefined) return cached;

    const item = deferred<Event>();
    this.#cache.set(id, item.promise);
    this.#pending.set(id, item.handlers);
    this.#schedule();
    return item.promise;
  }

  prime(event: Event): Event {
    if (!this.#cache.has(event.id)) this.#cache.set(event.id, Promise.resolve(event));
    return event;
  }

  #schedule(): void {
    if (this.#scheduled) return;
    this.#scheduled = true;
    queueMicrotask(() => void this.#dispatch());
  }

  async #dispatch(): Promise<void> {
    this.#scheduled = false;
    const pending = this.#pending;
    this.#pending = new Map();
    const ids = [...pending.keys()];

    try {
      const events = parseEvents(await this.#client.get("events", { eventIds: ids }));
      const byId = new Map(events.map((event) => [event.id, event]));
      for (const [id, handlers] of pending) {
        const event = byId.get(id);
        if (event === undefined) {
          handlers.reject(new Error(`Eventor did not return event ${id}`));
        } else {
          this.prime(event);
          handlers.resolve(event);
        }
      }
    } catch (error) {
      for (const handlers of pending.values()) handlers.reject(error);
    }
  }
}

export class EntriesByEventLoader {
  readonly #client: EventorClient;
  readonly #cache = new Map<string, Promise<Entry[]>>();
  #pending = new Map<string, Deferred<Entry[]>>();
  #scheduled = false;

  constructor(client: EventorClient) {
    this.#client = client;
  }

  load(eventId: string): Promise<Entry[]> {
    const cached = this.#cache.get(eventId);
    if (cached !== undefined) return cached;

    const item = deferred<Entry[]>();
    this.#cache.set(eventId, item.promise);
    this.#pending.set(eventId, item.handlers);
    if (!this.#scheduled) {
      this.#scheduled = true;
      queueMicrotask(() => void this.#dispatch());
    }
    return item.promise;
  }

  async #dispatch(): Promise<void> {
    this.#scheduled = false;
    const pending = this.#pending;
    this.#pending = new Map();
    const eventIds = [...pending.keys()];

    try {
      const entries = parseEntries(
        await this.#client.get("entries", {
          eventIds,
          includePersonElement: true,
          includeOrganisationElement: true,
          includeEventElement: true,
        }),
      );
      for (const [eventId, handlers] of pending) {
        handlers.resolve(entries.filter((entry) => entry.eventId === eventId));
      }
    } catch (error) {
      for (const handlers of pending.values()) handlers.reject(error);
    }
  }
}

interface CompetitorCountRequest {
  eventId: string;
  organisationIds: string[];
  personIds: string[] | undefined;
}

interface CompetitorCountBatch {
  organisationIds: string[];
  personIds: string[] | undefined;
  events: Map<string, Deferred<CompetitorCount | null>>;
}

function normalized(values: readonly string[] | undefined): string[] | undefined {
  if (values === undefined) return undefined;
  return [...new Set(values)].sort();
}

export class CompetitorCountByEventLoader {
  readonly #client: EventorClient;
  readonly #cache = new Map<string, Promise<CompetitorCount | null>>();
  #pending = new Map<string, CompetitorCountBatch>();
  #scheduled = false;

  constructor(client: EventorClient) {
    this.#client = client;
  }

  load(request: CompetitorCountRequest): Promise<CompetitorCount | null> {
    const organisationIds = normalized(request.organisationIds) ?? [];
    const personIds = normalized(request.personIds);
    const batchKey = JSON.stringify([organisationIds, personIds]);
    const cacheKey = JSON.stringify([batchKey, request.eventId]);
    const cached = this.#cache.get(cacheKey);
    if (cached !== undefined) return cached;

    const item = deferred<CompetitorCount | null>();
    this.#cache.set(cacheKey, item.promise);
    const batch = this.#pending.get(batchKey) ?? {
      organisationIds,
      personIds,
      events: new Map(),
    };
    batch.events.set(request.eventId, item.handlers);
    this.#pending.set(batchKey, batch);
    if (!this.#scheduled) {
      this.#scheduled = true;
      queueMicrotask(() => void this.#dispatch());
    }
    return item.promise;
  }

  async #dispatch(): Promise<void> {
    this.#scheduled = false;
    const pending = this.#pending;
    this.#pending = new Map();

    await Promise.all(
      [...pending.values()].map(async (batch) => {
        try {
          const eventIds = [...batch.events.keys()];
          const counts = parseCompetitorCounts(
            await this.#client.get("competitorcount", {
              organisationIds: batch.organisationIds,
              eventIds,
              personIds: batch.personIds,
            }),
          );
          const byEventId = new Map(counts.map((count) => [count.eventId, count]));
          for (const [eventId, handlers] of batch.events) {
            handlers.resolve(byEventId.get(eventId) ?? null);
          }
        } catch (error) {
          for (const handlers of batch.events.values()) handlers.reject(error);
        }
      }),
    );
  }
}

export interface RequestLoaders {
  eventsById: EventByIdLoader;
  entriesByEvent: EntriesByEventLoader;
  competitorCountsByEvent: CompetitorCountByEventLoader;
}

export function createRequestLoaders(client: EventorClient): RequestLoaders {
  return {
    eventsById: new EventByIdLoader(client),
    entriesByEvent: new EntriesByEventLoader(client),
    competitorCountsByEvent: new CompetitorCountByEventLoader(client),
  };
}
