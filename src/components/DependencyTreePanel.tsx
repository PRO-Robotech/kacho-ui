// DependencyTreePanel — боковая панель в confirm-модалке удаления: дерево ресурсов,
// подвязанных к удаляемому (subnets/route-tables/SG → addresses/NIC и т.д.).
// Блокирующие удаление узлы подсвечены. Источник дерева — lib/dependency-graph.

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Alert, Empty, Spin, Tree, Typography, Button, theme } from "antd";
import { ReloadOutlined, WarningFilled } from "@ant-design/icons";
import type { DataNode } from "antd/es/tree";
import { REGISTRY } from "@/lib/resource-registry";
import { blockingNodes, type DepNode } from "@/lib/dependency-graph";

function specSingular(resourceId: string): string {
  return REGISTRY[resourceId]?.singular ?? resourceId;
}

function toDataNode(n: DepNode, token: ReturnType<typeof theme.useToken>["token"]): DataNode {
  const href = n.projectId ? `/projects/${n.projectId}/${n.routeSegment}/${n.id}` : null;
  const label = (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6, fontSize: 12 }}>
      {n.blocks && (
        <WarningFilled
          style={{ color: token.colorWarning, fontSize: 11 }}
          title="Блокирует удаление — нужно удалить первым"
        />
      )}
      <span style={{ color: token.colorTextTertiary }}>{specSingular(n.resourceId)}</span>
      {href ? (
        <Link to={href} style={{ color: token.colorText }} onClick={(e) => e.stopPropagation()}>
          {n.name}
        </Link>
      ) : (
        <span style={{ color: token.colorText }}>{n.name}</span>
      )}
      <Typography.Text code style={{ fontSize: 10 }} title={n.id}>
        {n.id}
      </Typography.Text>
    </span>
  );
  return {
    key: n.key,
    title: label,
    children: n.children.length ? n.children.map((c) => toDataNode(c, token)) : undefined,
  };
}

interface Props {
  nodes: DepNode[];
  loading: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

export function DependencyTreePanel({ nodes, loading, error, onRefresh }: Props) {
  const { token } = theme.useToken();
  const treeData = useMemo(() => nodes.map((n) => toDataNode(n, token)), [nodes, token]);
  const blockers = useMemo(() => blockingNodes(nodes), [nodes]);

  return (
    <div
      style={{
        borderLeft: `1px solid ${token.colorBorderSecondary}`,
        paddingLeft: 16,
        minWidth: 320,
        maxHeight: 420,
        overflow: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography.Text strong style={{ fontSize: 12 }}>
          Связанные ресурсы
        </Typography.Text>
        {onRefresh && (
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={onRefresh}
            disabled={loading}
            title="Обновить"
          />
        )}
      </div>

      {loading ? (
        <div style={{ padding: "16px 0", textAlign: "center" }}>
          <Spin size="small" />
        </div>
      ) : error ? (
        <Alert type="error" showIcon message="Не удалось загрузить связи" description={error} />
      ) : nodes.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Зависимых ресурсов нет — можно удалять.
            </Typography.Text>
          }
        />
      ) : (
        <>
          {blockers.length > 0 && (
            <Alert
              type="warning"
              showIcon
              style={{ fontSize: 12 }}
              message={
                <span style={{ fontSize: 12 }}>
                  Сначала удалите {blockers.length} помеченный(е) ресурс(ы) — иначе удаление будет
                  отклонено («… is not empty»).
                </span>
              }
            />
          )}
          <Tree
            treeData={treeData}
            defaultExpandAll
            selectable={false}
            showLine={{ showLeafIcon: false }}
            style={{ background: "transparent", fontSize: 12 }}
          />
        </>
      )}
    </div>
  );
}
