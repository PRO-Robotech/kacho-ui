// AuthCallback — landing page для `/auth/callback?code=...&state=...`.
// Извлекает code+state из URL, шлёт POST в `/iam/v1/auth/callback`, на
// success — `refresh()` /me + navigate('/').
//
// Возможные ошибки:
//   - `error` в query (от Zitadel: user denied и т.п.) → показать.
//   - 4xx/5xx от api-gateway (invalid state, code expired) → показать retry.

import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Button, Result, Spin } from "antd";
import { authApi } from "@/api/auth";
import { useAuth } from "@/contexts/AuthContext";

type Status = "loading" | "ok" | "error";

export function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [status, setStatus] = useState<Status>("loading");
  const [errMsg, setErrMsg] = useState<string>("");
  // Strict-Mode защита от двойного вызова callback (code одноразовый).
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const code = params.get("code");
    const state = params.get("state");
    const oidcErr = params.get("error");
    const oidcErrDesc = params.get("error_description");

    if (oidcErr) {
      setStatus("error");
      setErrMsg(oidcErrDesc ? `${oidcErr}: ${oidcErrDesc}` : oidcErr);
      return;
    }
    if (!code || !state) {
      setStatus("error");
      setErrMsg("Отсутствует параметр `code` или `state` в URL.");
      return;
    }

    (async () => {
      try {
        await authApi.callback(code, state);
        await refresh();
        setStatus("ok");
        // Microsec задержка чтобы UI успел нарисовать «ok» state.
        setTimeout(() => navigate("/", { replace: true }), 200);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setStatus("error");
        setErrMsg(msg);
      }
    })();
  }, [params, refresh, navigate]);

  if (status === "loading") {
    return (
      <div style={{ padding: 48, textAlign: "center" }}>
        <Spin size="large" tip="Завершаем вход…" />
      </div>
    );
  }

  if (status === "ok") {
    return (
      <Result
        status="success"
        title="Вход выполнен"
        subTitle="Перенаправляем на главную…"
      />
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 560, margin: "0 auto" }}>
      <Alert
        type="error"
        showIcon
        message="Не удалось завершить вход"
        description={errMsg}
        style={{ marginBottom: 16 }}
      />
      <Button type="primary" onClick={() => navigate("/")}>
        На главную
      </Button>
    </div>
  );
}
