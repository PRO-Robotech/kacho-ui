// DependencyTreePanel — боковая панель в модалке удаления: связанные ресурсы,
// СГРУППИРОВАННЫЕ по типу. У каждой группы — бейдж (иконка+тип) + счётчик;
// внутри группы — только имена (ссылки открываются в новой вкладке, чтобы не
// терять модалку удаления). Блокирующие удаление помечены ⚠. Источник —
// lib/dependency-graph (дерево DepNode плющится в группы по resourceId).

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Alert, Empty, Spin, Typography, Button, Tag, theme } from "antd";
import { ReloadOutlined, WarningFilled } from "@ant-design/icons";
import { REGISTRY } from "@/lib/resource-registry";
import { ResourceIcon } from "@/components/form/ResourceIcon";
import { blockingNodes, type DepNode } from "@/lib/dependency-graph";

function specLabel(resourceId: string): string {
  return REGISTRY[resourceId]?.plural ?? REGISTRY[resourceId]?.singular ?? resourceId;
}

/** Рекурсивно расплющить дерево зависимостей в плоский список. */
function flatten(nodes: DepNode[]): DepNode[] {
  const out: DepNode[] = [];
  const walk = (ns: DepNode[]) => {
    for (const n of ns) {
      out.push(n);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

interface Group {
  resourceId: string;
  items: DepNode[];
  blocks: boolean;
}

interface Props {
  nodes: DepNode[];
  loading: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

export function DependencyTreePanel({ nodes, loading, error, onRefresh }: Props) {
  const { token } = theme.useToken();

  const groups = useMemo<Group[]>(() => {
    const flat = flatten(nodes);
    const order: string[] = [];
    const map = new Map<string, DepNode[]>();
    for (const n of flat) {
      if (!map.has(n.resourceId)) {
        map.set(n.resourceId, []);
        order.push(n.resourceId);
      }
      map.get(n.resourceId)!.push(n);
    }
    return order.map((rid) => {
      const items = map.get(rid)!;
      return { resourceId: rid, items, blocks: items.some((i) => i.blocks) };
    });
  }, [nodes]);

  const blockers = useMemo(() => blockingNodes(nodes), [nodes]);

  return (
    <div
      style={{
        borderLeft: `1px solid ${token.colorBorderSecondary}`,
        paddingLeft: 16,
        minWidth: 320,
        maxHeight: 440,
        overflow: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 10,
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
      ) : groups.length === 0 ? (
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
                  Сначала удалите помеченные ⚠ ресурсы — иначе удаление будет отклонено
                  («… is not empty»).
                </span>
              }
            />
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {groups.map((g) => (
              <div key={g.resourceId}>
                {/* Бейдж группы: иконка+тип + счётчик + ⚠ если блокирует. */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <Tag
                    color={g.blocks ? "warning" : "default"}
                    style={{ margin: 0, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5, paddingInline: 8 }}
                  >
                    <span style={{ display: "inline-flex", fontSize: 13, lineHeight: 0 }}>
                      <ResourceIcon specId={g.resourceId} />
                    </span>
                    {specLabel(g.resourceId)}
                  </Tag>
                  <span
                    style={{
                      fontSize: 11,
                      minWidth: 20,
                      height: 18,
                      padding: "0 6px",
                      borderRadius: 9,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: token.colorFillSecondary,
                      color: token.colorTextSecondary,
                      fontWeight: 600,
                    }}
                  >
                    {g.items.length}
                  </span>
                </div>

                {/* Внутри группы — только имена. */}
                <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingLeft: 6 }}>
                  {g.items.map((it) => {
                    const href = it.projectId
                      ? `/projects/${it.projectId}/${it.routeSegment}/${it.id}`
                      : null;
                    return (
                      <span
                        key={it.key}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, minWidth: 0 }}
                      >
                        {it.blocks && (
                          <WarningFilled
                            style={{ color: token.colorWarning, fontSize: 10, flexShrink: 0 }}
                            title="Блокирует удаление — удалите первым"
                          />
                        )}
                        {href ? (
                          <Link
                            to={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: token.colorText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                            onClick={(e) => e.stopPropagation()}
                            title="Открыть в новой вкладке"
                          >
                            {it.name || it.id}
                          </Link>
                        ) : (
                          <span style={{ color: token.colorText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {it.name || it.id}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
