// Базовый клиент: POST JSON на api-gateway REST endpoints.
// В dev: vite.config.ts проксирует /v1/* на http://localhost:8080.
// В prod: same-origin, ingress рулит на api-gateway:8080.

const API_BASE = ""; // относительный путь, ingress/proxy сделают остальное

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public details: unknown,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * post — POST JSON, ожидает JSON в ответ.
 * При не-2xx бросает ApiError со статусом, code (gRPC) и details.
 */
export async function post<TReq, TResp>(path: string, body: TReq): Promise<TResp> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Request-ID": crypto.randomUUID(),
    },
    body: JSON.stringify(body ?? {}),
  });

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      // not json
    }
  }

  if (!res.ok) {
    const err = (parsed ?? {}) as { code?: string; message?: string; details?: unknown };
    throw new ApiError(
      res.status,
      err.code ?? String(res.status),
      err.details,
      err.message ?? res.statusText,
    );
  }

  return parsed as TResp;
}

/**
 * postStream — POST + читать NDJSON-стрим (Watch endpoint от grpc-gateway).
 * Возвращает AsyncGenerator событий вида { result: WatchEvent } | { error: Status }.
 */
export async function* postStream<TReq, TEvent>(
  path: string,
  body: TReq,
  signal?: AbortSignal,
): AsyncGenerator<TEvent> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Request-ID": crypto.randomUUID(),
    },
    body: JSON.stringify(body ?? {}),
    signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text();
    throw new ApiError(res.status, String(res.status), text, res.statusText);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try {
        yield JSON.parse(line) as TEvent;
      } catch {
        // skip malformed
      }
    }
  }
}
