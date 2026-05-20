// DPoP unit-tests (KAC-127 Phase 2).
//
// Что покрываем:
//   1. generateDpopKeyPair → возвращает ECDSA P-256 пару, persist'ит в IDB.
//   2. ensureDpopKeyPair — idempotent (повторный вызов возвращает ту же пару).
//   3. createDpopProof — header.alg=ES256, payload.htm/htu/iat/jti корректны.
//   4. accessToken → ath claim (sha256(token)).
//   5. nonce → попадает в payload.
//   6. normaliseHtu — query/fragment отбрасываются.
//   7. jwkThumbprint — детерминированный SHA-256 base64url.
//   8. clearDpopKeyPair — очищает state + IDB.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import {
  generateDpopKeyPair,
  loadDpopKeyPair,
  ensureDpopKeyPair,
  clearDpopKeyPair,
  createDpopProof,
  publicJwk,
  jwkThumbprint,
  normaliseHtu,
  decodeDpopHeader,
  decodeDpopPayload,
  setKeyPairForTesting,
} from "./dpop";

beforeEach(async () => {
  setKeyPairForTesting(null);
  await clearDpopKeyPair();
});

afterEach(async () => {
  setKeyPairForTesting(null);
  await clearDpopKeyPair();
});

describe("DPoP keypair lifecycle", () => {
  it("generateDpopKeyPair → возвращает ECDSA P-256 + persist'ит в IDB", async () => {
    const pair = await generateDpopKeyPair();
    expect(pair.privateKey.algorithm.name).toBe("ECDSA");
    expect(pair.publicKey.algorithm.name).toBe("ECDSA");
    expect(pair.privateKey.extractable).toBe(false);

    // Reload — та же пара (по reference) в кэше, и persist'нута в IDB.
    setKeyPairForTesting(null);
    const reloaded = await loadDpopKeyPair();
    expect(reloaded).not.toBeNull();
    expect(reloaded!.privateKey.algorithm.name).toBe("ECDSA");
  });

  it("ensureDpopKeyPair — idempotent", async () => {
    const a = await ensureDpopKeyPair();
    const b = await ensureDpopKeyPair();
    expect(a).toBe(b);
  });

  it("clearDpopKeyPair → loadDpopKeyPair вернёт null", async () => {
    await ensureDpopKeyPair();
    await clearDpopKeyPair();
    const v = await loadDpopKeyPair();
    expect(v).toBeNull();
  });
});

describe("DPoP proof JWT", () => {
  it("createDpopProof header alg=ES256, typ=dpop+jwt, jwk EC P-256", async () => {
    const token = await createDpopProof({
      htm: "GET",
      htu: "https://api.kacho.cloud/iam/v1/auth/me",
    });
    const header = decodeDpopHeader(token);
    expect(header.alg).toBe("ES256");
    expect(header.typ).toBe("dpop+jwt");
    expect((header.jwk as { kty: string }).kty).toBe("EC");
    expect((header.jwk as { crv: string }).crv).toBe("P-256");
  });

  it("payload.htm — uppercase, htu — нормализован, iat и jti присутствуют", async () => {
    const before = Math.floor(Date.now() / 1000);
    const token = await createDpopProof({
      htm: "post",
      htu: "https://api.kacho.cloud/vpc/v1/networks?foo=bar#frag",
    });
    const after = Math.floor(Date.now() / 1000);
    const p = decodeDpopPayload(token);
    expect(p.htm).toBe("POST");
    expect(p.htu).toBe("https://api.kacho.cloud/vpc/v1/networks");
    expect(p.iat).toBeGreaterThanOrEqual(before);
    expect(p.iat).toBeLessThanOrEqual(after);
    expect(typeof p.jti).toBe("string");
    expect((p.jti as string).length).toBeGreaterThan(8);
  });

  it("accessToken → ath claim = base64url(sha256(token))", async () => {
    const at = "test-access-token-value-1234567890";
    const token = await createDpopProof({
      htm: "GET",
      htu: "https://api.kacho.cloud/vpc/v1/networks",
      accessToken: at,
    });
    const p = decodeDpopPayload(token);
    expect(typeof p.ath).toBe("string");

    // Дублируем sha256-вычисление и сверяем.
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(at));
    const bytes = new Uint8Array(digest);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    const expected = btoa(bin).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    expect(p.ath).toBe(expected);
  });

  it("nonce → payload.nonce", async () => {
    const token = await createDpopProof({
      htm: "GET",
      htu: "https://api.kacho.cloud/vpc/v1/networks",
      nonce: "abc123",
    });
    const p = decodeDpopPayload(token);
    expect(p.nonce).toBe("abc123");
  });

  it("override iat/jti для тестов", async () => {
    const token = await createDpopProof({
      htm: "GET",
      htu: "https://example/x",
      iat: 1700000000,
      jti: "fixed-jti-value",
    });
    const p = decodeDpopPayload(token);
    expect(p.iat).toBe(1700000000);
    expect(p.jti).toBe("fixed-jti-value");
  });

  it("jti — уникальный между вызовами", async () => {
    const a = await createDpopProof({ htm: "GET", htu: "https://x/y" });
    const b = await createDpopProof({ htm: "GET", htu: "https://x/y" });
    expect(decodeDpopPayload(a).jti).not.toBe(decodeDpopPayload(b).jti);
  });
});

describe("normaliseHtu", () => {
  it("отбрасывает query + fragment", () => {
    expect(normaliseHtu("https://api.kacho.cloud/x/y?a=1&b=2#z"))
      .toBe("https://api.kacho.cloud/x/y");
  });
  it("оставляет origin+path как есть", () => {
    expect(normaliseHtu("https://api.kacho.cloud/iam/v1/auth/me"))
      .toBe("https://api.kacho.cloud/iam/v1/auth/me");
  });
});

describe("jwkThumbprint (RFC 7638)", () => {
  it("детерминированный + base64url-формат", async () => {
    const pair = await ensureDpopKeyPair();
    const jwk = await publicJwk(pair);
    const a = await jwkThumbprint(jwk);
    const b = await jwkThumbprint(jwk);
    expect(a).toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/); // base64url, no padding
    expect(a.length).toBeGreaterThan(20);
  });
});
