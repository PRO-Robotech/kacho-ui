import { useEffect, useRef, useState } from "react";
import { ApiError, post, watchStream } from "@/api/client";
import type { ResourceSpec } from "./resource-registry";

interface FolderRef {
  uid: string;
}

type Item = { metadata: { uid: string; resourceVersion?: string } } & Record<string, unknown>;

export type WatchStatus = "idle" | "listing" | "watching" | "reconnecting" | "error";

interface State<T extends Item> {
  items: T[];
  status: WatchStatus;
  error: string | null;
  resourceVersion: string;
}

interface WatchEvent<T> {
  type: "ADDED" | "MODIFIED" | "DELETED" | string;
  resourceVersion?: string;
  resource?: T;
}

interface StreamEnvelope<T> {
  result?: WatchEvent<T>;
  error?: { code?: string; message?: string };
}

/**
 * Watch resource list через grpc-gateway server-streaming.
 *
 * Алгоритм:
 *   1. Initial List — отдаём snapshot + resourceVersion.
 *   2. Watch с этого resourceVersion — applies ADDED/MODIFIED/DELETED на cache.
 *   3. На server-close (timeout / pod restart) — sleep 1s + reconnect.
 *   4. На OUT_OF_RANGE (RV expired) — full relist + restart watch.
 *   5. На network error — exponential backoff 1s..10s.
 */
export function useResourceWatch<T extends Item = Item>(
  spec: ResourceSpec,
  folder: FolderRef | null,
) {
  const [state, setState] = useState<State<T>>({
    items: [],
    status: "idle",
    error: null,
    resourceVersion: "0",
  });

  // Используем ref чтобы внутри loop иметь актуальное folder/spec без ре-запуска эффекта.
  const stateRef = useRef(state);
  stateRef.current = state;

  const folderRequired = spec.scope === "folder";
  const folderUid = folder?.uid ?? null;

  useEffect(() => {
    if (folderRequired && !folderUid) {
      setState((p) => ({ ...p, items: [], status: "idle", error: null }));
      return;
    }
    const ac = new AbortController();
    let cancelled = false;
    let backoffMs = 1000;

    const selectors = folderUid
      ? [{ field: "folder_id", op: "EQ", values: [folderUid] }]
      : [];

    const setItems = (mut: (prev: Map<string, T>) => Map<string, T>) => {
      setState((p) => {
        const cur = new Map<string, T>();
        for (const it of p.items) cur.set(it.metadata.uid, it);
        const next = mut(cur);
        return { ...p, items: Array.from(next.values()) };
      });
    };

    const doListAndWatch = async (initial: boolean) => {
      // 1. Initial List
      try {
        if (initial) setState((p) => ({ ...p, status: "listing", error: null }));
        const list = await post<unknown, Record<string, unknown>>(
          `/v1/${spec.apiPath}/list`,
          { selectors },
        );
        if (cancelled) return;
        const arr = (list[spec.payloadKey] as T[]) ?? [];
        const map = new Map<string, T>();
        for (const it of arr) map.set(it.metadata.uid, it);
        const rv = (list.resourceVersion as string) ?? "0";
        setState({
          items: Array.from(map.values()),
          status: "watching",
          error: null,
          resourceVersion: rv,
        });
      } catch (e) {
        if (cancelled) return;
        const msg =
          e instanceof ApiError ? `${e.code}: ${e.message}` : (e as Error).message;
        setState((p) => ({ ...p, status: "error", error: msg }));
        // Retry list with backoff
        await sleep(backoffMs, ac.signal);
        backoffMs = Math.min(backoffMs * 2, 10_000);
        if (!cancelled) await doListAndWatch(false);
        return;
      }

      // 2. Watch loop через WebSocket
      while (!cancelled) {
        try {
          const rv = stateRef.current.resourceVersion;
          const stream = watchStream<unknown, StreamEnvelope<T>>(
            `/v1/${spec.apiPath}/watch`,
            { selectors, resourceVersion: rv },
            ac.signal,
          );
          for await (const env of stream) {
            if (cancelled) return;
            if (env.error) {
              const code = env.error.code;
              if (code === "OUT_OF_RANGE" || code === "11") {
                // resourceVersion expired — full relist
                await doListAndWatch(false);
                return;
              }
              throw new Error(env.error.message ?? code ?? "stream error");
            }
            const ev = env.result;
            if (!ev || !ev.resource) continue;
            const uid = ev.resource.metadata.uid;
            setItems((cur) => {
              const next = new Map(cur);
              if (ev.type === "DELETED") {
                next.delete(uid);
              } else {
                next.set(uid, ev.resource as T);
              }
              return next;
            });
            if (ev.resourceVersion) {
              setState((p) =>
                ev.resourceVersion! > p.resourceVersion
                  ? { ...p, resourceVersion: ev.resourceVersion! }
                  : p,
              );
            }
          }
          // server closed stream (timeout / pod gracefully closed) — reconnect
          if (cancelled) return;
          backoffMs = 1000;
          await sleep(500, ac.signal);
        } catch (e) {
          if (cancelled) return;
          // network error / pod restart → backoff + reconnect
          const msg =
            e instanceof ApiError ? `${e.code}: ${e.message}` : (e as Error).message;
          setState((p) => ({ ...p, status: "reconnecting", error: msg }));
          await sleep(backoffMs, ac.signal);
          backoffMs = Math.min(backoffMs * 2, 10_000);
        }
      }
    };

    void doListAndWatch(true);

    return () => {
      cancelled = true;
      ac.abort();
    };
    // ВАЖНО: spec.id используется как stable key (spec — const из registry)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.id, folderUid]);

  return state;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const t = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      signal.removeEventListener("abort", onAbort);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort);
  });
}
