export type QueryValue = string | number | boolean | readonly string[] | null | undefined;
export type Query = Record<string, QueryValue>;

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
}

export class EventorClient {
  readonly #apiKey: string;
  readonly #baseUrl: URL;
  readonly #fetch: typeof globalThis.fetch;
  readonly #requests = new Map<string, Promise<string>>();

  constructor(options: EventorClientOptions) {
    this.#apiKey = options.apiKey;
    this.#baseUrl = new URL(options.baseUrl.endsWith("/") ? options.baseUrl : `${options.baseUrl}/`);
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  get(path: string, query: Query = {}): Promise<string> {
    const url = this.#url(path, query);
    const key = url.toString();
    const existing = this.#requests.get(key);
    if (existing !== undefined) return existing;

    const request = this.#request(url, { method: "GET" });
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

  async #request(url: URL, init: RequestInit): Promise<string> {
    if (this.#apiKey.trim() === "") throw new Error("The ApiKey request header is required");
    const headers = new Headers(init.headers);
    headers.set("ApiKey", this.#apiKey);
    headers.set("Accept", "application/xml, text/xml;q=0.9");
    const response = await this.#fetch(url, { ...init, headers });
    const body = await response.text();
    if (!response.ok) throw new EventorHttpError(response.status, response.statusText, body);
    return body;
  }
}
