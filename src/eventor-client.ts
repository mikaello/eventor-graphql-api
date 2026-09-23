export type QueryValue = string | number | boolean | readonly string[] | null | undefined;
export type Query = Record<string, QueryValue>;

export class EventorApiKeyRequiredError extends Error {
  constructor() {
    super("The ApiKey request header is required");
    this.name = "EventorApiKeyRequiredError";
  }
}

export class EventorHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    body: string,
  ) {
    const detail = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);
    super(`Eventor returned HTTP ${status} ${statusText}${detail === "" ? "" : `: ${detail}`}`);
    this.name = "EventorHttpError";
  }
}

export interface EventorClientOptions {
  apiKey: string;
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
  maxConcurrentGets?: number;
}

export class EventorClient {
  readonly #apiKey: string;
  readonly #baseUrl: URL;
  readonly #fetch: typeof globalThis.fetch;
  readonly #maxConcurrentGets: number;
  readonly #requests = new Map<string, Promise<string>>();
  readonly #getQueue: Array<() => void> = [];
  #activeGets = 0;

  constructor(options: EventorClientOptions) {
    this.#apiKey = options.apiKey;
    this.#baseUrl = new URL(options.baseUrl.endsWith("/") ? options.baseUrl : `${options.baseUrl}/`);
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#maxConcurrentGets = options.maxConcurrentGets ?? 8;
    if (!Number.isInteger(this.#maxConcurrentGets) || this.#maxConcurrentGets < 1) {
      throw new Error("maxConcurrentGets must be a positive integer");
    }
  }

  get(path: string, query: Query = {}): Promise<string> {
    const url = this.#url(path, query);
    const key = url.toString();
    const existing = this.#requests.get(key);
    if (existing !== undefined) return existing;

    const request = this.#scheduleGet(() => this.#request(url, { method: "GET" }));
    this.#requests.set(key, request);
    return request;
  }

  post(path: string, xml: string): Promise<string> {
    return this.#request(this.#url(path), {
      method: "POST",
      body: xml,
      headers: { "Content-Type": "application/xml" },
    });
  }

  put(path: string, xml: string): Promise<string> {
    return this.#request(this.#url(path), {
      method: "PUT",
      body: xml,
      headers: { "Content-Type": "application/xml" },
    });
  }

  #url(path: string, query: Query = {}): URL {
    const cleanPath = path.replace(/^\/+/, "");
    const url = new URL(cleanPath, this.#baseUrl);
    for (const [name, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(name, Array.isArray(value) ? value.join(",") : String(value));
    }
    return url;
  }

  #scheduleGet(request: () => Promise<string>): Promise<string> {
    return new Promise((resolve, reject) => {
      const run = () => {
        this.#activeGets += 1;
        void request()
          .then(resolve, reject)
          .finally(() => {
            this.#activeGets -= 1;
            this.#drainGetQueue();
          });
      };
      this.#getQueue.push(run);
      this.#drainGetQueue();
    });
  }

  #drainGetQueue(): void {
    while (this.#activeGets < this.#maxConcurrentGets) {
      const run = this.#getQueue.shift();
      if (run === undefined) return;
      run();
    }
  }

  async #request(url: URL, init: RequestInit): Promise<string> {
    if (this.#apiKey.trim() === "") throw new EventorApiKeyRequiredError();
    const headers = new Headers(init.headers);
    headers.set("ApiKey", this.#apiKey);
    headers.set("Accept", "application/xml, text/xml;q=0.9");
    const response = await this.#fetch(url, { ...init, headers });
    const body = await response.text();
    if (!response.ok) throw new EventorHttpError(response.status, response.statusText, body);
    return body;
  }
}
