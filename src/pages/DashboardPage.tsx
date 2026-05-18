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
import { useQueries } from "@tanstack/react-query";
import { Card, Empty, Statistic, Typography, Space, Button, Row, Col, Alert } from "antd";
import { ArrowRightOutlined, FolderOpenOutlined, AppstoreOutlined } from "@ant-design/icons";
import { useBreadcrumb, useHeaderRight, usePageTitle } from "@/components/PageHeaderSlot";
import { api } from "@/api/client";
import { useContext } from "@/lib/context-store";
import { SERVICE_MODULES, type ServiceModule } from "@/lib/service-modules";

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

  const projectId = ctx.project?.id ?? null;
  const accountId = ctx.account?.id ?? null;

  // Counts для каждого модуля. SERVICE_MODULES[0..2] = vpc/compute/iam.
  // IAM не требует projectId (его ресурсы — account-level), счётчики работают всегда.
  const vpcCounts = useModuleCounts(SERVICE_MODULES[0], projectId, null);
  const computeCounts = useModuleCounts(SERVICE_MODULES[1], projectId, null);
  const iamCounts = useModuleCounts(SERVICE_MODULES[2], "*", null); // "*" — fake projectId чтобы хук активировался
  const countsByModule: Record<string, CountMap> = {
    [SERVICE_MODULES[0].key]: vpcCounts,
    [SERVICE_MODULES[1].key]: computeCounts,
    [SERVICE_MODULES[2].key]: iamCounts,
  };

  useBreadcrumb(useMemo(() => <Typography.Text strong>Все сервисы</Typography.Text>, []));
  useHeaderRight(useMemo(() => null, []));
  usePageTitle(null);

  const openModule = (m: ServiceModule) => navigate(m.landing(projectId, accountId));

  const caption = (() => {
    if (ctx.project) return `Проект: ${ctx.project.name || ctx.project.id}`;
    if (ctx.account) return `Аккаунт: ${ctx.account.name || ctx.account.id} — выберите проект чтобы перейти к ресурсам.`;
    return "Контекст не выбран — выберите Account и Project в шапке. IAM-блок доступен всегда.";
  })();

  // Плашки VPC/Compute требуют Project context. IAM — всегда виден.
  const tilesVisible = true;
  const allEmpty =
    !!ctx.project &&
    SERVICE_MODULES.filter((m) => m.key !== "iam").every((m) =>
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

        {!ctx.account && (
          <Alert
            type="info"
            showIcon
            message="Выберите Account и Project в шапке для просмотра VPC и Compute ресурсов. IAM доступен всегда."
            action={
              <Button
                size="small"
                icon={<ArrowRightOutlined />}
                onClick={() => navigate("/iam/accounts")}
                data-testid="dashboard-go-iam"
              >
                Перейти в IAM
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
