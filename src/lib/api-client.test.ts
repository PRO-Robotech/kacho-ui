// API-client unit-tests (KAC-127 Phase 2).
//
// Что покрываем:
//   1. fetch: добавляет DPoP header.
//   2. token: добавляет Authorization: DPoP <token>.
//   3. 401 + DPoP-Nonce → retry с nonce, payload содержит nonce.
//   4. 401 + token expired → onTokenExpired callback + retry с новым токеном.
//   5. 403 insufficient_user_authentication → onStepUpRequired + retry.
//   6. parseWwwAuthenticate — корректно парсит DPoP + Bearer challenges.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { ApiClient, parseWwwAuthenticate, StepUpRequiredError } from "./api-client";
import {
  clearDpopKeyPair,
  setKeyPairForTesting,
  decodeDpopPayload,
} from "./dpop";

beforeEach(async () => {
  setKeyPairForTesting(null);
  await clearDpopKeyPair();
});

afterEach(async () => {
  setKeyPairForTesting(null);
  await clearDpopKeyPair();
  vi.restoreAllMocks();
});

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("parseWwwAuthenticate", () => {
  it("DPoP nonce challenge", () => {
    const parsed = parseWwwAuthenticate('DPoP error="use_dpop_nonce", nonce="abc-123"');
    expect(parsed[0].scheme).toBe("DPoP");
    expect(parsed[0].params.error).toBe("use_dpop_nonce");
    expect(parsed[0].params.nonce).toBe("abc-123");
  });
  it("insufficient_user_authentication с acr_values", () => {
    const parsed = parseWwwAuthenticate(
      'Bearer error="insufficient_user_authentication", acr_values="3"',
    );
    expect(parsed[0].scheme).toBe("Bearer");
    expect(parsed[0].params.error).toBe("insufficient_user_authentication");
    expect(parsed[0].params.acr_values).toBe("3");
  });
});

describe("ApiClient — DPoP-bound fetch", () => {
  it("добавляет DPoP header на каждый запрос", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new ApiClient({ baseUrl: "https://api.kacho.cloud" });
    await client.get("/vpc/v1/networks");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.DPoP).toBeTruthy();
    expect(init.headers.Authorization).toBeUndefined();
    const payload = decodeDpopPayload(init.headers.DPoP);
    expect(payload.htm).toBe("GET");
    expect(payload.htu).toBe("https://api.kacho.cloud/vpc/v1/networks");
  });

  it("при наличии accessToken — Authorization: DPoP <token>", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    vi.stubGlobal("fetch", fetchMock);

    const client = new ApiClient({
      baseUrl: "https://api.kacho.cloud",
      getAccessToken: () => "test-token-xyz",
    });
    await client.get("/iam/v1/auth/me");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("DPoP test-token-xyz");
    const payload = decodeDpopPayload(init.headers.DPoP);
    expect(payload.ath).toBeTruthy(); // ath claim присутствует при наличии token
  });

  it("401 + DPoP-Nonce → retry с nonce в payload", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("", {
          status: 401,
          headers: {
            "WWW-Authenticate": 'DPoP error="use_dpop_nonce", nonce="srv-nonce-1"',
            "DPoP-Nonce": "srv-nonce-1",
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const client = new ApiClient({ baseUrl: "https://api.kacho.cloud" });
    const res = await client.get<{ ok: boolean }>("/vpc/v1/networks");
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secondCall = fetchMock.mock.calls[1];
    const payload = decodeDpopPayload((secondCall[1].headers as Record<string, string>).DPoP);
    expect(payload.nonce).toBe("srv-nonce-1");
  });

  it("401 expired token → onTokenExpired + retry с новым токеном", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { code: "token_expired" }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    let token: string | null = "old-token";
    const onTokenExpired = vi.fn(async () => {
      token = "new-token";
      return token;
    });

    const client = new ApiClient({
      baseUrl: "https://api.kacho.cloud",
      getAccessToken: () => token,
      onTokenExpired,
    });
    await client.get("/vpc/v1/networks");

    expect(onTokenExpired).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondInit = fetchMock.mock.calls[1][1];
    expect(secondInit.headers.Authorization).toBe("DPoP new-token");
  });

  it("403 insufficient_user_authentication → onStepUpRequired + retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "permission_denied" }), {
          status: 403,
          headers: {
            "WWW-Authenticate":
              'Bearer error="insufficient_user_authentication", acr_values="3"',
            "Content-Type": "application/json",
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const onStepUpRequired = vi.fn(async () => {});
    const client = new ApiClient({
      baseUrl: "https://api.kacho.cloud",
      getAccessToken: () => "tok",
      onStepUpRequired,
    });

    await client.get("/iam/v1/users:forceLogout");
    expect(onStepUpRequired).toHaveBeenCalledWith("3");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("403 без onStepUpRequired → StepUpRequiredError", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("", {
        status: 403,
        headers: {
          "WWW-Authenticate":
            'Bearer error="insufficient_user_authentication", acr_values="3"',
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new ApiClient({ baseUrl: "https://api.kacho.cloud" });
    await expect(client.get("/iam/v1/users:forceLogout")).rejects.toBeInstanceOf(
      StepUpRequiredError,
    );
  });
});
