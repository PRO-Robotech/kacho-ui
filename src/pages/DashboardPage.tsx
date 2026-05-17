// DashboardPage — root экран /dashboard. Разводная страница: плашки опубликованных
// сервисов (модулей) — сейчас VPC и Compute. Клик по плашке → вход в модуль
// (сайдбар переключает набор ссылок на этот модуль, см. ServiceSidebar).
//
// Уровни контекста (выбираются pill'ами в шапке — BreadcrumbSelector):
//   • folder выбран     → counts по folder + клик → landing модуля в этом folder
//   • cloud выбран      → counts агрегированно по всем folder'ам облака + клик → выбор folder
//   • ничего не выбрано → "—" + CTA «Перейти к Organizations»

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Card, Empty, Statistic, Typography, Space, Button, Row, Col, Alert } from "antd";
import { ArrowRightOutlined, FolderOpenOutlined, AppstoreOutlined } from "@ant-design/icons";
import { useBreadcrumb, useHeaderRight, usePageTitle } from "@/components/PageHeaderSlot";
import { api } from "@/api/client";
import { useContext } from "@/lib/context-store";
import { SERVICE_MODULES, type ServiceModule } from "@/lib/service-modules";

interface FolderRow {
  id: string;
}

/** Список folder'ов в облаке (для cloud-level агрегации). */
function useFoldersInCloud(cloudId: string | null) {
  const q = useQuery({
    queryKey: ["dash", "cloud-folders", cloudId],
    queryFn: () => api.list<{ folders?: FolderRow[] }>("/resource-manager/v1/folders", { cloud_id: cloudId! }),
    enabled: !!cloudId,
    refetchInterval: 30_000,
  });
  return {
    folderIds: q.data?.folders ? q.data.folders.map((f) => f.id) : null,
    count: q.data?.folders?.length ?? null,
  };
}

type CountMap = Record<string, number | null>;

/** Counts по stat-метрикам модуля: folder-mode (один folder) или cloud-mode (сумма по folder'ам облака). */
function useModuleCounts(module: ServiceModule, projectId: string | null, cloudFolderIds: string[] | null): CountMap {
  const enabled = projectId != null || cloudFolderIds != null;
  const targetFolders = projectId != null ? [projectId] : cloudFolderIds ?? [];
  const results = useQueries({
    queries: module.stats.map((stat) => ({
      queryKey: ["dash", module.key, stat.key, projectId, cloudFolderIds],
      enabled,
      refetchInterval: 15_000,
      queryFn: async () => {
        const lists = await Promise.all(
          targetFolders.map((fid) =>
            api.list<Record<string, unknown[] | undefined>>(stat.listPath, { folder_id: fid, pageSize: "1000" }),
          ),
        );
        return lists.reduce((sum, l) => sum + (l[stat.payloadKey]?.length ?? 0), 0);
      },
    })),
  });
  const out: CountMap = {};
  module.stats.forEach((stat, i) => {
    out[stat.key] = enabled ? results[i].data ?? null : null;
  });
  return out;
}

export function DashboardPage() {
  const ctx = useContext((s) => s);
  const navigate = useNavigate();

  const projectId = ctx.folder?.id ?? null;
  const cloudId = ctx.cloud?.id ?? null;

  const { folderIds: cloudFolderIds, count: foldersInCloud } = useFoldersInCloud(projectId ? null : cloudId);

  // Counts для каждого модуля (фиксированный список SERVICE_MODULES → хук-вызовы стабильны).
  const vpcCounts = useModuleCounts(SERVICE_MODULES[0], projectId, cloudFolderIds);
  const computeCounts = useModuleCounts(SERVICE_MODULES[1], projectId, cloudFolderIds);
  const countsByModule: Record<string, CountMap> = {
    [SERVICE_MODULES[0].key]: vpcCounts,
    [SERVICE_MODULES[1].key]: computeCounts,
  };

  useBreadcrumb(useMemo(() => <Typography.Text strong>Все сервисы</Typography.Text>, []));
  useHeaderRight(useMemo(() => null, []));
  usePageTitle(null);

  const openModule = (m: ServiceModule) => navigate(m.landing(projectId, cloudId));

  const caption = (() => {
    if (ctx.folder) return `Каталог: ${ctx.folder.name || ctx.folder.id}`;
    if (ctx.cloud) return `Облако: ${ctx.cloud.name || ctx.cloud.id} — счётчики суммарно по всем каталогам. Выберите каталог, чтобы перейти к ресурсам.`;
    return "Контекст не выбран — выберите Cloud и Folder в шапке.";
  })();

  // Плашки показываем как только выбран хотя бы Cloud.
  const tilesVisible = !!ctx.cloud;
  const allEmpty =
    !!ctx.folder &&
    SERVICE_MODULES.every((m) =>
      m.stats.every((s) => (countsByModule[m.key]?.[s.key] ?? null) === 0),
    );

  return (
    <div style={{ maxWidth: 1100 }} data-testid="dashboard-page">
      <Space direction="vertical" size={20} style={{ width: "100%" }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Сервисы облака
          </Typography.Title>
          <Typography.Text type="secondary">{caption}</Typography.Text>
        </div>

        {!ctx.cloud && (
          <Alert
            type="info"
            showIcon
            message="Чтобы увидеть плашки сервисов — выберите Cloud (через шапку или дерево слева)."
            action={
              <Button
                size="small"
                icon={<ArrowRightOutlined />}
                onClick={() => navigate("/organizations")}
                data-testid="dashboard-go-organizations"
              >
                Organizations
              </Button>
            }
          />
        )}

        {tilesVisible && (
          <Row gutter={[16, 16]}>
            {SERVICE_MODULES.map((m) => (
              <Col key={m.key} xs={24} sm={24} md={12} lg={12}>
                <Card
                  hoverable
                  data-testid={`dashboard-tile-${m.key}`}
                  onClick={() => openModule(m)}
                  styles={{ body: { padding: 16 } }}
                  title={
                    <Space>
                      <span style={{ color: m.color, fontSize: 16 }}>{m.icon}</span>
                      <span>{m.label}</span>
                    </Space>
                  }
                  extra={<ArrowRightOutlined />}
                >
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 12, fontSize: 12 }}>
                    {m.description}
                  </Typography.Paragraph>
                  <Row gutter={16}>
                    {m.stats.map((s) => (
                      <Col key={s.key} span={Math.floor(24 / m.stats.length)}>
                        <Statistic
                          title={s.label}
                          value={countsByModule[m.key]?.[s.key] ?? "—"}
                          valueStyle={{ fontSize: 22 }}
                        />
                      </Col>
                    ))}
                  </Row>
                  {!ctx.folder && foldersInCloud !== null && (
                    <Typography.Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 12 }}>
                      Каталогов в облаке: {foldersInCloud}
                    </Typography.Text>
                  )}
                </Card>
              </Col>
            ))}
          </Row>
        )}

        {allEmpty && (
          <Card>
            <Empty
              image={<FolderOpenOutlined style={{ fontSize: 40, color: "#8b8f99" }} />}
              imageStyle={{ height: 56 }}
              description={
                <Space direction="vertical" size={6}>
                  <Typography.Text strong>В каталоге нет ресурсов</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Выберите сервис на плашке выше, чтобы создать первый ресурс.
                  </Typography.Text>
                </Space>
              }
            >
              <Button type="primary" icon={<AppstoreOutlined />} onClick={() => openModule(SERVICE_MODULES[0])}>
                Перейти в {SERVICE_MODULES[0].short}
              </Button>
            </Empty>
          </Card>
        )}
      </Space>
    </div>
  );
}
