// DashboardPage — root экран /dashboard. YC-style разводная страница.
//
// Уровни context, поддерживаемые tile'ом «Virtual Private Cloud»:
//   • folder выбран     → counts по folder + click → /folders/X/networks
//   • cloud выбран      → агрегированные counts по всем folder'ам в cloud
//                          + click → /clouds/X/folders (выбрать/создать)
//   • ничего не выбрано → "—" + кнопка-CTA «Перейти к Organizations»
//
// На YC console дашборд тоже разводная — показывает плашки сервисов на
// уровне Cloud (без явного folder).

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  Empty,
  Statistic,
  Typography,
  Space,
  Button,
  Row,
  Col,
  Alert,
} from "antd";
import {
  ApartmentOutlined,
  ArrowRightOutlined,
  FolderOpenOutlined,
} from "@ant-design/icons";
import {
  useBreadcrumb,
  useHeaderRight,
  usePageTitle,
} from "@/components/PageHeaderSlot";
import { api } from "@/api/client";
import { useContext } from "@/lib/context-store";

interface FolderRow {
  id: string;
  name: string;
  cloud_id: string;
}

type Counts = {
  networks: number | null;
  subnets: number | null;
  sgs: number | null;
};

/** Counts для одного folder. */
function useFolderCounts(folderId: string | null): Counts {
  const networks = useQuery({
    queryKey: ["dash", "networks", folderId],
    queryFn: () =>
      api.list<{ networks?: unknown[] }>("/vpc/v1/networks", {
        folder_id: folderId!,
        pageSize: "1000",
      }),
    refetchInterval: 15_000,
    enabled: !!folderId,
  });
  const subnets = useQuery({
    queryKey: ["dash", "subnets", folderId],
    queryFn: () =>
      api.list<{ subnets?: unknown[] }>("/vpc/v1/subnets", {
        folder_id: folderId!,
        pageSize: "1000",
      }),
    refetchInterval: 15_000,
    enabled: !!folderId,
  });
  const sgs = useQuery({
    queryKey: ["dash", "security-groups", folderId],
    queryFn: () =>
      api.list<{ security_groups?: unknown[] }>("/vpc/v1/securityGroups", {
        folder_id: folderId!,
        pageSize: "1000",
      }),
    refetchInterval: 15_000,
    enabled: !!folderId,
  });

  return {
    networks: networks.data?.networks?.length ?? null,
    subnets: subnets.data?.subnets?.length ?? null,
    sgs: sgs.data?.security_groups?.length ?? null,
  };
}

/** Counts агрегированно по всем folder'ам в cloud. */
function useCloudCounts(cloudId: string | null): Counts & { foldersCount: number | null } {
  const folders = useQuery({
    queryKey: ["dash", "cloud-folders", cloudId],
    queryFn: () =>
      api.list<{ folders: FolderRow[] }>("/resource-manager/v1/folders", {
        cloud_id: cloudId!,
      }),
    refetchInterval: 30_000,
    enabled: !!cloudId,
  });
  const folderIds = folders.data?.folders?.map((f) => f.id) ?? [];

  const networks = useQuery({
    queryKey: ["dash", "cloud-net", cloudId, folderIds],
    queryFn: async () => {
      const lists = await Promise.all(
        folderIds.map((fid) =>
          api.list<{ networks?: unknown[] }>("/vpc/v1/networks", {
            folder_id: fid,
            pageSize: "1000",
          }),
        ),
      );
      return lists.reduce((sum, l) => sum + (l.networks?.length ?? 0), 0);
    },
    refetchInterval: 15_000,
    enabled: !!cloudId && folderIds.length > 0,
  });
  const subnets = useQuery({
    queryKey: ["dash", "cloud-sub", cloudId, folderIds],
    queryFn: async () => {
      const lists = await Promise.all(
        folderIds.map((fid) =>
          api.list<{ subnets?: unknown[] }>("/vpc/v1/subnets", {
            folder_id: fid,
            pageSize: "1000",
          }),
        ),
      );
      return lists.reduce((sum, l) => sum + (l.subnets?.length ?? 0), 0);
    },
    refetchInterval: 15_000,
    enabled: !!cloudId && folderIds.length > 0,
  });
  const sgs = useQuery({
    queryKey: ["dash", "cloud-sg", cloudId, folderIds],
    queryFn: async () => {
      const lists = await Promise.all(
        folderIds.map((fid) =>
          api.list<{ security_groups?: unknown[] }>("/vpc/v1/securityGroups", {
            folder_id: fid,
            pageSize: "1000",
          }),
        ),
      );
      return lists.reduce((sum, l) => sum + (l.security_groups?.length ?? 0), 0);
    },
    refetchInterval: 15_000,
    enabled: !!cloudId && folderIds.length > 0,
  });

  // Если folder список пустой и не загружается — counts = 0.
  const empty = folders.data && folderIds.length === 0;
  return {
    networks: empty ? 0 : networks.data ?? null,
    subnets: empty ? 0 : subnets.data ?? null,
    sgs: empty ? 0 : sgs.data ?? null,
    foldersCount: folders.data?.folders?.length ?? null,
  };
}

export function DashboardPage() {
  const ctx = useContext((s) => s);
  const navigate = useNavigate();

  const folderId = ctx.folder?.id ?? null;
  const cloudId = ctx.cloud?.id ?? null;

  const folderCounts = useFolderCounts(folderId);
  const cloudCounts = useCloudCounts(folderId ? null : cloudId);

  const counts: Counts = folderId ? folderCounts : cloudCounts;
  const foldersInCloud = cloudCounts.foldersCount;

  useBreadcrumb(
    useMemo(() => <Typography.Text strong>Дашборд</Typography.Text>, []),
  );
  useHeaderRight(useMemo(() => null, []));
  usePageTitle(null);

  const goVpc = () => {
    if (folderId) navigate(`/folders/${folderId}/networks`);
    else if (cloudId) navigate(`/clouds/${cloudId}/folders`);
    else navigate("/organizations");
  };

  const caption = (() => {
    if (ctx.folder) return `Каталог: ${ctx.folder.name || ctx.folder.id}`;
    if (ctx.cloud)
      return `Облако: ${ctx.cloud.name || ctx.cloud.id}. Выберите каталог чтобы увидеть ресурсы.`;
    return "Контекст не выбран — выберите Cloud и Folder в шапке или дереве слева.";
  })();

  // Tile показываем как только выбран хотя бы Cloud.
  const tileVisible = !!ctx.cloud;

  return (
    <div style={{ maxWidth: 1100 }} data-testid="dashboard-page">
      <Space direction="vertical" size={20} style={{ width: "100%" }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Ресурсы облака
          </Typography.Title>
          <Typography.Text type="secondary">{caption}</Typography.Text>
        </div>

        {!ctx.cloud && (
          <Alert
            type="info"
            showIcon
            message="Чтобы увидеть тайлы сервисов — выберите Cloud (через шапку или дерево слева)."
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

        {tileVisible && (
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={24} md={16} lg={12}>
              <Card
                hoverable
                data-testid="dashboard-tile-vpc"
                onClick={goVpc}
                styles={{ body: { padding: 16 } }}
                title={
                  <Space>
                    <ApartmentOutlined style={{ color: "#3D8DF5" }} />
                    <span>Virtual Private Cloud</span>
                  </Space>
                }
                extra={<ArrowRightOutlined />}
              >
                <Typography.Paragraph
                  type="secondary"
                  style={{ marginBottom: 12, fontSize: 12 }}
                >
                  {ctx.folder
                    ? "Сети, подсети, группы безопасности, публичные IP."
                    : "Сети, подсети, группы безопасности — суммарно по всем каталогам облака."}
                </Typography.Paragraph>
                <Row gutter={16}>
                  <Col span={8}>
                    <Statistic
                      title="Сетей"
                      value={counts.networks ?? "—"}
                      valueStyle={{ fontSize: 22 }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="Подсетей"
                      value={counts.subnets ?? "—"}
                      valueStyle={{ fontSize: 22 }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="Групп безопасности"
                      value={counts.sgs ?? "—"}
                      valueStyle={{ fontSize: 22 }}
                    />
                  </Col>
                </Row>
                {!ctx.folder && foldersInCloud !== null && (
                  <Typography.Text
                    type="secondary"
                    style={{ fontSize: 11, display: "block", marginTop: 12 }}
                  >
                    Каталогов в облаке: {foldersInCloud}
                  </Typography.Text>
                )}
              </Card>
            </Col>
          </Row>
        )}

        {ctx.folder &&
          counts.networks === 0 &&
          counts.subnets === 0 &&
          counts.sgs === 0 && (
            <Card>
              <Empty
                image={
                  <FolderOpenOutlined style={{ fontSize: 40, color: "#8b8f99" }} />
                }
                imageStyle={{ height: 56 }}
                description={
                  <Space direction="vertical" size={6}>
                    <Typography.Text strong>
                      В каталоге нет ресурсов
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Создайте первую сеть, чтобы начать.
                    </Typography.Text>
                  </Space>
                }
              >
                <Button
                  type="primary"
                  icon={<ArrowRightOutlined />}
                  onClick={goVpc}
                >
                  Перейти в VPC
                </Button>
              </Empty>
            </Card>
          )}
      </Space>
    </div>
  );
}
