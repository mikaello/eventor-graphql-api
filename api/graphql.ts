import { createApp } from "../src/app.js";

const yoga = createApp();

export async function withRequestTimeout(
  response: Response | PromiseLike<Response>,
  timeoutMs: number,
): Promise<Response> {
  let timeout: NodeJS.Timeout | undefined;
  const timeoutResponse = new Promise<Response>((resolve) => {
    timeout = setTimeout(
      () =>
        resolve(
          Response.json(
            {
              errors: [
                {
                  message:
                    "The request timed out while waiting for Eventor. Please try again; the next attempt may be faster because Eventor responses are cached.",
                  extensions: { code: "GATEWAY_TIMEOUT" },
                },
              ],
            },
            {
              status: 504,
              headers: { "Content-Type": "application/graphql-response+json; charset=utf-8" },
            },
          ),
        ),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([Promise.resolve(response), timeoutResponse]);
  } finally {
    clearTimeout(timeout);
  }
}

export default {
  fetch(request: Request) {
    return withRequestTimeout(yoga.fetch(request), 55_000);
  },
};
