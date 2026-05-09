// DashboardPage — root экран /. YC-style: один tile «Virtual Private Cloud»
// со счётчиками в выбранном folder. Прочих сервисов (Cloud DNS, IAM) у
// нас нет — соответствующие tile'ы намеренно не показываем.

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, Empty, Statistic, Typography, Space, Button, Row, Col } from "antd";
import { ApartmentOutlined, ArrowRightOutlined, FolderOpenOutlined } from "@ant-design/icons";
import { useBreadcrumb, useHeaderRight, usePageTitle } from "@/components/PageHeaderSlot";
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

  const networks = useFolderResourceCount("networks", "/vpc/v1/networks", folderId, "networks");
  const subnets = useFolderResourceCount("subnets", "/vpc/v1/subnets", folderId, "subnets");
  const sgs = useFolderResourceCount(
    "security-groups",
    "/vpc/v1/securityGroups",
    folderId,
    "security_groups",
  );

  useBreadcrumb(useMemo(() => <Typography.Text strong>Дашборд</Typography.Text>, []));
  useHeaderRight(null);
  usePageTitle(null);

  return (
    <div style={{ maxWidth: 1000 }}>
      <Space direction="vertical" size={20} style={{ width: "100%" }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Дашборд
          </Typography.Title>
          <Typography.Text type="secondary">
            Краткая сводка ресурсов в текущем каталоге.
          </Typography.Text>
        </div>

        {!folder ? (
          <Card>
            <Empty
              image={<FolderOpenOutlined style={{ fontSize: 40, color: "#8b8f99" }} />}
              imageStyle={{ height: 56 }}
              description={
                <Space direction="vertical" size={6}>
                  <Typography.Text strong>Каталог не выбран</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Выберите Cloud и Folder в шапке наверху, чтобы увидеть ресурсы.
                  </Typography.Text>
                </Space>
              }
            >
              <Link to="/organizations">
                <Button icon={<ArrowRightOutlined />}>Перейти к Organizations</Button>
              </Link>
            </Empty>
          </Card>
        ) : (
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={24} md={16}>
              <Link to={`/folders/${folderId}/networks`} style={{ display: "block" }}>
                <Card
                  hoverable
                  title={
                    <Space>
                      <ApartmentOutlined style={{ color: "#3D8DF5" }} />
                      <span>Virtual Private Cloud</span>
                    </Space>
                  }
                  extra={<ArrowRightOutlined />}
                >
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 16, fontSize: 12 }}>
                    Сети, подсети, группы безопасности, адреса.
                  </Typography.Paragraph>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Statistic title="Сетей" value={networks ?? "—"} />
                    </Col>
                    <Col span={8}>
                      <Statistic title="Подсетей" value={subnets ?? "—"} />
                    </Col>
                    <Col span={8}>
                      <Statistic title="Групп безопасности" value={sgs ?? "—"} />
                    </Col>
                  </Row>
                </Card>
              </Link>
            </Col>
          </Row>
        )}
      </Space>
    </div>
  );
}
