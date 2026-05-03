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
 * watchStream — открывает WebSocket к streaming-эндпоинту (Watch RPC),
 * выполняет первый message с request body (как требует tmc/grpc-websocket-proxy
 * на стороне api-gateway), затем yield-ит каждое полученное сообщение как
 * парсенный JSON.
 *
 * Поведение:
 *   - один WS на одну подписку (НЕ переоткрывается на каждый event)
 *   - signal.abort() закрывает WS
 *   - server-close (nginx idle timeout / pod restart) → throws WsClosed,
 *     useResourceWatch ловит и делает reconnect с backoff
 */
export async function* watchStream<TReq, TEvent>(
  path: string,
  body: TReq,
  signal?: AbortSignal,
): AsyncGenerator<TEvent> {
  const wsUrl = buildWsUrl(path);
  const ws = new WebSocket(wsUrl);

  // Подписываемся на abort до open — чтобы корректно закрыть на cancel
  const onAbort = () => {
    try {
      ws.close(1000, "client abort");
    } catch {
      // ignore
    }
  };
  signal?.addEventListener("abort", onAbort);

  // Очередь + promise resolver для async iteration
  type Msg = { kind: "data"; data: TEvent } | { kind: "close" } | { kind: "error"; err: Error };
  const queue: Msg[] = [];
  let resolveNext: ((m: Msg) => void) | null = null;

  const enqueue = (m: Msg) => {
    if (resolveNext) {
      const r = resolveNext;
      resolveNext = null;
      r(m);
    } else {
      queue.push(m);
    }
  };

  ws.onopen = () => {
    try {
      ws.send(JSON.stringify(body ?? {}));
    } catch (e) {
      enqueue({ kind: "error", err: e as Error });
    }
  };
  ws.onmessage = (ev) => {
    let line: string;
    if (typeof ev.data === "string") line = ev.data;
    else if (ev.data instanceof ArrayBuffer) line = new TextDecoder().decode(ev.data);
    else if (ev.data instanceof Blob) {
      // Blob: read async, потом enqueue
      ev.data.text().then((t) => {
        try {
          enqueue({ kind: "data", data: JSON.parse(t) as TEvent });
        } catch {
          // skip
        }
      });
      return;
    } else return;
    try {
      enqueue({ kind: "data", data: JSON.parse(line) as TEvent });
    } catch {
      // skip malformed
    }
  };
  ws.onclose = () => enqueue({ kind: "close" });
  ws.onerror = () => enqueue({ kind: "error", err: new Error("websocket error") });

  try {
    while (true) {
      const m: Msg = queue.length
        ? (queue.shift() as Msg)
        : await new Promise<Msg>((r) => {
            resolveNext = r;
          });
      if (m.kind === "close") return;
      if (m.kind === "error") throw m.err;
      yield m.data;
    }
  } finally {
    signal?.removeEventListener("abort", onAbort);
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      try {
        ws.close(1000, "iterator finalised");
      } catch {
        // ignore
      }
    }
  }
}

function buildWsUrl(path: string): string {
  // path: "/v1/networks/watch" → ws://<host>/v1/networks/watch?method=POST
  // ?method=POST — override для tmc/grpc-websocket-proxy:
  //   WebSocket initiation request приходит как HTTP GET, но grpc-gateway
  //   зарегистрировал Watch RPC как POST. Без override wsproxy proxy-ит
  //   internal request методом GET и grpc-gateway возвращает Method Not Allowed.
  if (typeof window === "undefined") {
    throw new Error("watchStream requires browser environment");
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const sep = path.includes("?") ? "&" : "?";
  return `${proto}//${window.location.host}${path}${sep}method=POST`;
}
