// SubnetCreatePage — standalone-страница создания подсети, единственный
// entry-point для всех flow'ов:
//   /folders/<f>/vpc/subnets/create?networkId=<n>     ← header CTA / RowActions
//   /folders/<f>/vpc/networks/<n>/subnets/create      ← редирект на ?networkId=
//
// Layout копирует SubnetDetailPage в edit-mode: breadcrumb / заголовок / Card
// с InlineSubnetCreateForm. Тот же визуальный стиль (label-left/input-right
// horizontal form, YC-style виджеты).
//
// Без networkId — показываем RefSelect "Сеть" вверху формы; пока сеть не
// выбрана, форма disabled. С networkId в URL — сеть зафиксирована (показана
// read-only).

import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button, Form, Select, Space, Typography } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { InlineSubnetCreateForm } from "@/components/InlineSubnetCreateForm";
import { api } from "@/api/client";
import { useBreadcrumb } from "@/components/PageHeaderSlot";

interface NetworkRow {
  id: string;
  name?: string;
}

export function SubnetCreatePage() {
  const { folderId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialNetworkId = searchParams.get("networkId") ?? undefined;
  const [networkId, setNetworkId] = useState<string | undefined>(initialNetworkId);

  // Networks для RefSelect когда networkId не задан query-параметром.
  const { data: netList } = useQuery({
    queryKey: ["networks", "list", folderId],
    queryFn: () =>
      api.list<{ networks: NetworkRow[] }>("/vpc/v1/networks", {
        folder_id: folderId!,
        pageSize: "500",
      }),
    enabled: !!folderId && !initialNetworkId,
  });
  const networkOptions = useMemo(
    () =>
      (netList?.networks ?? []).map((n) => ({
        value: n.id,
        label: n.name || n.id,
      })),
    [netList],
  );

  // Если networkId пришёл из URL — фиксируем имя для отображения и breadcrumb.
  const { data: currentNet } = useQuery({
    queryKey: ["networks", "get", networkId],
    queryFn: () => api.get<NetworkRow>(`/vpc/v1/networks/${networkId}`),
    enabled: !!networkId,
  });

  // Breadcrumb идентичен subnet detail в edit-mode (Service / Сети / <name> / Создание подсети).
  const breadcrumb = useMemo(
    () => (
      <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
        <Typography.Text type="secondary">Virtual Private Cloud</Typography.Text>
        <Typography.Text type="secondary">/</Typography.Text>
        <Link to={`/folders/${folderId}/vpc/networks`}>
          <Typography.Text type="secondary">Сети</Typography.Text>
        </Link>
        {networkId && (
          <>
            <Typography.Text type="secondary">/</Typography.Text>
            <Link to={`/folders/${folderId}/vpc/networks/${networkId}`}>
              <Typography.Text type="secondary">
                {currentNet?.name || networkId}
              </Typography.Text>
            </Link>
          </>
        )}
        <Typography.Text type="secondary">/</Typography.Text>
        <Typography.Text strong>Создание подсети</Typography.Text>
      </span>
    ),
    [folderId, networkId, currentNet?.name],
  );
  useBreadcrumb(breadcrumb);

  // Когда InlineSubnetCreateForm создаёт подсеть успешно — она вызывает
  // onSuccess; уходим на Network detail (контекст создания).
  const onSuccess = () => {
    if (networkId) {
      navigate(`/folders/${folderId}/vpc/networks/${networkId}`, { replace: true });
    } else {
      navigate(`/folders/${folderId}/vpc/networks`, { replace: true });
    }
  };

  // Cancel: возврат на Network detail, если контекст известен.
  const onCancel = () => {
    if (networkId) {
      navigate(`/folders/${folderId}/vpc/networks/${networkId}`);
    } else {
      navigate(`/folders/${folderId}/vpc/networks`);
    }
  };

  if (!folderId) return null;

  // Visual parity с SubnetDetailPage в edit-mode: тот же padding и плоская
  // обёртка (без Card), как у tab "Обзор" DetailPage. Inline-форма рендерится
  // напрямую — она сама ставит заголовок «Создание подсети», 2-column
  // horizontal layout, CIDR-виджеты и DHCP-collapse.
  return (
    <div style={{ padding: 24, maxWidth: 760 }}>
      <Button
        type="text"
        size="small"
        icon={<ArrowLeftOutlined />}
        onClick={onCancel}
        style={{ marginBottom: 16, padding: 0 }}
      >
        Назад
      </Button>

      {!networkId ? (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Создание подсети
          </Typography.Title>
          <Form
            layout="horizontal"
            labelCol={{ flex: "200px" }}
            wrapperCol={{ flex: "auto" }}
            labelAlign="left"
            colon={false}
            size="middle"
          >
            <Form.Item label="Сеть" required>
              <Select
                showSearch
                placeholder="Выберите сеть для создания подсети"
                value={networkId}
                onChange={(v) => setNetworkId(v)}
                options={networkOptions}
                optionFilterProp="label"
              />
            </Form.Item>
          </Form>
          <Typography.Text type="secondary">
            Подсеть всегда принадлежит сети — выберите её, чтобы продолжить.
          </Typography.Text>
        </Space>
      ) : (
        <InlineSubnetCreateForm
          folderId={folderId}
          networkId={networkId}
          onCancel={onCancel}
          onSuccess={onSuccess}
        />
      )}
    </div>
  );
}
