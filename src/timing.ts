import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";
import type { Plugin } from "graphql-yoga";

export interface GraphQLTimingRecord {
  type: "graphql_timing";
  totalExecutionMs: number;
  initialEventsFetchMs: number | null;
  childFetchPhaseMs: number | null;
  childFetchCount: number;
  xmlParsingMs: number;
  serializationMs: number;
}

export type GraphQLTimingLogger = (record: GraphQLTimingRecord) => void;

interface TimingStore {
  eventorFetchKind?: "initial-events";
  timing: RequestTiming;
}

const timingStorage = new AsyncLocalStorage<TimingStore>();

function milliseconds(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

class RequestTiming {
  #childFetchActive = 0;
  #childFetchCount = 0;
  #childFetchFinishedAt: number | undefined;
  #childFetchStartedAt: number | undefined;
  #executionStartedAt: number | undefined;
  #initialEventsFetchMs = 0;
  #initialEventsFetches = 0;
  #initialEventsResolved = false;
  #serializationMs = 0;
  #xmlParsingMs = 0;

  startExecution(): void {
    this.#executionStartedAt ??= performance.now();
  }

  startInitialEventsFetch(): () => void {
    const startedAt = performance.now();
    let finished = false;
    return () => {
      if (finished) return;
      finished = true;
      this.#initialEventsFetchMs += performance.now() - startedAt;
      this.#initialEventsFetches += 1;
    };
  }

  markInitialEventsResolved(): void {
    this.#initialEventsResolved = true;
  }

  startEventorFetch(): (() => void) | undefined {
    if (!this.#initialEventsResolved) return undefined;

    const startedAt = performance.now();
    this.#childFetchStartedAt ??= startedAt;
    this.#childFetchActive += 1;
    this.#childFetchCount += 1;
    let finished = false;

    return () => {
      if (finished) return;
      finished = true;
      this.#childFetchActive -= 1;
      if (this.#childFetchActive === 0) this.#childFetchFinishedAt = performance.now();
    };
  }

  addXmlParsing(durationMs: number): void {
    this.#xmlParsingMs += durationMs;
  }

  addSerialization(durationMs: number): void {
    this.#serializationMs += durationMs;
  }

  record(): GraphQLTimingRecord | undefined {
    if (this.#executionStartedAt === undefined) return undefined;
    const childFetchPhaseMs =
      this.#childFetchStartedAt === undefined || this.#childFetchFinishedAt === undefined
        ? null
        : milliseconds(this.#childFetchFinishedAt - this.#childFetchStartedAt);

    return {
      type: "graphql_timing",
      totalExecutionMs: milliseconds(performance.now() - this.#executionStartedAt),
      initialEventsFetchMs:
        this.#initialEventsFetches === 0 ? null : milliseconds(this.#initialEventsFetchMs),
      childFetchPhaseMs,
      childFetchCount: this.#childFetchCount,
      xmlParsingMs: milliseconds(this.#xmlParsingMs),
      serializationMs: milliseconds(this.#serializationMs),
    };
  }
}

export function defaultGraphQLTimingLogger(record: GraphQLTimingRecord): void {
  console.info(JSON.stringify(record));
}

export function useGraphQLTiming(logger: GraphQLTimingLogger): Plugin {
  return {
    instrumentation: {
      request: async (_payload, wrapped) => {
        const timing = new RequestTiming();
        try {
          await timingStorage.run({ timing }, wrapped);
        } finally {
          const record = timing.record();
          if (record !== undefined) {
            try {
              logger(record);
            } catch (error) {
              console.error("Failed to write GraphQL timing log", error);
            }
          }
        }
      },
      operation: async (_payload, wrapped) => {
        timingStorage.getStore()?.timing.startExecution();
        await wrapped();
      },
      resultProcess: async (_payload, wrapped) => {
        const startedAt = performance.now();
        try {
          await wrapped();
        } finally {
          timingStorage.getStore()?.timing.addSerialization(performance.now() - startedAt);
        }
      },
    },
  };
}

export async function measureInitialEventsFetch<T>(fetch: () => Promise<T>): Promise<T> {
  const store = timingStorage.getStore();
  if (store === undefined) return fetch();
  return timingStorage.run({ ...store, eventorFetchKind: "initial-events" }, fetch);
}

export function markInitialEventsResolved(): void {
  timingStorage.getStore()?.timing.markInitialEventsResolved();
}

export function startEventorFetchTiming(): (() => void) | undefined {
  const store = timingStorage.getStore();
  if (store === undefined) return undefined;
  if (store.eventorFetchKind === "initial-events") {
    return store.timing.startInitialEventsFetch();
  }
  return store.timing.startEventorFetch();
}

export function measureXmlParsing<T>(parse: () => T): T {
  const timing = timingStorage.getStore()?.timing;
  if (timing === undefined) return parse();

  const startedAt = performance.now();
  try {
    return parse();
  } finally {
    timing.addXmlParsing(performance.now() - startedAt);
  }
}
