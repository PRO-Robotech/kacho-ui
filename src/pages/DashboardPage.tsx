// DashboardPage — root экран /dashboard. YC-style разводная страница.
//
// Сейчас доступен один сервис — Virtual Private Cloud. Tile с счётчиками
// (Сетей / Подсетей / Групп безопасности) в текущем folder. Click на
// tile → переход в первый раздел сервиса (Облачные сети).

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
import { useFolderStore } from "@/lib/folder-store";

type ListResp = Record<string, unknown>;

function useFolderResourceCount(
  resource: string,
  apiPath: string,
  folderId: string | null,
  payloadKey: string,
): number | null {
  const { data } = useQuery({
    queryKey: ["dash", resource, folderId],
    queryFn: () =>
      api.list<ListResp>(apiPath, {
        folder_id: folderId!,
        pageSize: "1000",
      }),
    refetchInterval: 15_000,
    enabled: !!folderId,
  });
  if (!data) return null;
  const arr = data[payloadKey];
  return Array.isArray(arr) ? arr.length : 0;
}

export function DashboardPage() {
  const folder = useFolderStore((s) => s.folder);
  const folderId = folder?.id ?? null;
  const navigate = useNavigate();

  const networks = useFolderResourceCount(
    "networks",
    "/vpc/v1/networks",
    folderId,
    "networks",
  );
  const subnets = useFolderResourceCount("subnets", "/vpc/v1/subnets", folderId, "subnets");
  const sgs = useFolderResourceCount(
    "security-groups",
    "/vpc/v1/securityGroups",
    folderId,
    "security_groups",
  );

  useBreadcrumb(
    useMemo(() => <Typography.Text strong>Дашборд</Typography.Text>, []),
  );
  useHeaderRight(null);
  usePageTitle(null);

  const goVpc = () => {
    if (folderId) navigate(`/folders/${folderId}/networks`);
    else navigate("/organizations");
  };

  return (
    <div style={{ maxWidth: 1100 }} data-testid="dashboard-page">
      <Space direction="vertical" size={20} style={{ width: "100%" }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Ресурсы облака
          </Typography.Title>
          <Typography.Text type="secondary">
            {folder
              ? `Каталог: ${folder.name || folder.id}`
              : "Каталог не выбран — выберите Folder в шапке или дереве слева."}
          </Typography.Text>
        </div>

        {!folder && (
          <Alert
            type="info"
            showIcon
            message="Чтобы увидеть ресурсы и тайлы сервисов — выберите Cloud и Folder."
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

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={24} md={16} lg={12}>
            <Card
              hoverable
              data-testid="dashboard-tile-vpc"
              onClick={goVpc}
              styles={{
                body: { padding: 16 },
              }}
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
                style={{ marginBottom: 16, fontSize: 12 }}
              >
                Сети, подсети, группы безопасности, публичные IP.
              </Typography.Paragraph>
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic
                    title="Сетей"
                    value={networks ?? "—"}
                    valueStyle={{ fontSize: 22 }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Подсетей"
                    value={subnets ?? "—"}
                    valueStyle={{ fontSize: 22 }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Групп безопасности"
                    value={sgs ?? "—"}
                    valueStyle={{ fontSize: 22 }}
                  />
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>

        {folder && networks === 0 && subnets === 0 && sgs === 0 && (
          <Card>
            <Empty
              image={
                <FolderOpenOutlined style={{ fontSize: 40, color: "#8b8f99" }} />
              }
              imageStyle={{ height: 56 }}
              description={
                <Space direction="vertical" size={6}>
                  <Typography.Text strong>В каталоге нет ресурсов</Typography.Text>
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
