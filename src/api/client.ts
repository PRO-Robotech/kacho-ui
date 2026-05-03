// Базовый клиент: REST JSON на api-gateway endpoints.
// В dev: vite.config.ts проксирует /<domain>/v1/* на http://localhost:8080.
// В prod: same-origin, ingress рулит на api-gateway:8080.
//
// URL-ы verbatim из proto google.api.http annotations:
//   organization-manager: /organization-manager/v1/organizations
//   resource-manager:     /resource-manager/v1/clouds, /resource-manager/v1/folders
//   vpc:                  /vpc/v1/networks, /vpc/v1/subnets, /vpc/v1/addresses, /vpc/v1/route-tables
//   operations:           /operations/{id}
//
// API mapping:
//   GET    /<domain>/v1/<plural>          → List
//   GET    /<domain>/v1/<plural>/{id}     → Get
//   POST   /<domain>/v1/<plural>          → Create  → Operation
//   PATCH  /<domain>/v1/<plural>/{id}     → Update  → Operation
//   DELETE /<domain>/v1/<plural>/{id}     → Delete  → Operation
//   POST   /<domain>/v1/<plural>/{id}:verb → Custom verb → Operation

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
  /** GET <path> → данные */
  get<T>(path: string): Promise<T> {
    return fetchJson<T>("GET", path);
  },

  /** GET <path>?k=v&… → список */
  list<T>(path: string, query?: Record<string, string>): Promise<T> {
    const qs =
      query && Object.keys(query).length > 0
        ? "?" + new URLSearchParams(query).toString()
        : "";
    return fetchJson<T>("GET", `${path}${qs}`);
  },

  /** POST <path>  body=resource → Operation */
  create(path: string, body: unknown): Promise<{ operation: import("./types").Operation }> {
    return fetchJson("POST", path, body);
  },

  /** PATCH <path>/{id}  body=resource → Operation */
  update(path: string, body: unknown): Promise<{ operation: import("./types").Operation }> {
    return fetchJson("PATCH", path, body);
  },

  /** DELETE <path>/{id} → Operation */
  delete(path: string): Promise<{ operation: import("./types").Operation }> {
    return fetchJson("DELETE", path);
  },

  /** POST <path>/{id}:verb  body → Operation */
  action(path: string, body?: unknown): Promise<{ operation: import("./types").Operation }> {
    return fetchJson("POST", path, body ?? {});
  },
};
