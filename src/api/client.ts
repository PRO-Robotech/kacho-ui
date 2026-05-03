// Базовый клиент: REST JSON на api-gateway endpoints.
// В dev: vite.config.ts проксирует /v1/* на http://localhost:8080.
// В prod: same-origin, ingress рулит на api-gateway:8080.
//
// API mapping (sub-phase 1.0):
//   GET     /v1/<plural>          → List
//   GET     /v1/<plural>/{id}     → Get
//   POST    /v1/<plural>          → Create  → Operation
//   PATCH   /v1/<plural>/{id}     → Update  → Operation
//   DELETE  /v1/<plural>/{id}     → Delete  → Operation
//   POST    /v1/<plural>/{id}:verb → Custom verb → Operation

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

async function fetchJson<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `${API_BASE}${path}`;
  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Request-ID": crypto.randomUUID(),
    },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
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
  return parsed as T;
}

export const api = {
  /** GET /v1/<path> → данные */
  get<T>(path: string): Promise<T> {
    return fetchJson<T>("GET", path);
  },

  /** GET /v1/<path>?k=v&… → список */
  list<T>(path: string, query?: Record<string, string>): Promise<T> {
    const qs =
      query && Object.keys(query).length > 0
        ? "?" + new URLSearchParams(query).toString()
        : "";
    return fetchJson<T>("GET", `${path}${qs}`);
  },

  /** POST /v1/<plural>  body=resource → Operation */
  create(path: string, body: unknown): Promise<{ operation: import("./types").Operation }> {
    return fetchJson("POST", path, body);
  },

  /** PATCH /v1/<plural>/{id}  body=resource → Operation */
  update(path: string, body: unknown): Promise<{ operation: import("./types").Operation }> {
    return fetchJson("PATCH", path, body);
  },

  /** DELETE /v1/<plural>/{id} → Operation */
  delete(path: string): Promise<{ operation: import("./types").Operation }> {
    return fetchJson("DELETE", path);
  },

  /** POST /v1/<plural>/{id}:verb  body → Operation */
  action(path: string, body?: unknown): Promise<{ operation: import("./types").Operation }> {
    return fetchJson("POST", path, body ?? {});
  },
};
