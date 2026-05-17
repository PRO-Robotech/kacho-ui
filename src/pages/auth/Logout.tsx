// Logout — сервисная страница `/logout`. Вызывает authApi.logout() и
// редиректит на главную. Удобна для прямого URL и для тестов.

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Result, Spin } from "antd";
import { useAuth } from "@/contexts/AuthContext";

export function LogoutPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      logout();
      navigate("/", { replace: true });
    })();
  }, [logout, navigate]);

  return (
    <div style={{ padding: 48, textAlign: "center" }}>
      <Spin size="large" tip="Выходим…" />
      <Result status="info" title="Завершаем сессию…" />
    </div>
  );
}
