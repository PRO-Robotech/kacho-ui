// NetworkInterfaceDetailPage — кастомизированная страница ресурса
// NetworkInterface (KAC-2). Добавляет в "Общее" две таблицы связанных
// ресурсов:
//
//  - Подключенные адреса — все Address-ресурсы, на которые ссылается
//    NIC через v4_address_ids ∪ v6_address_ids (resolved by id).
//  - Группы безопасности — Security Group по security_group_ids.
//
// Реализовано через `overviewExtras` в ResourceDetailPage (тот же hook
// что использует Network detail для inline-таблиц дочерних ресурсов).
// Сравнить с SubnetDetailPage (там адреса — отдельный tab, потому что
// их много; у NIC ≤2 адреса и обычно ≤несколько SG — компактнее в "Общее").

import { useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, Tag, Typography } from "antd";
import { ResourceDetailPage } from "@/components/ResourceDetailPage";
import { ResourceFormModal } from "@/components/ResourceFormModal";
import { InlineNetworkInterfaceEditForm } from "@/components/InlineNetworkInterfaceEditForm";
import { REGISTRY } from "@/lib/resource-registry";
import { api } from "@/api/client";

type Address = Record<string, unknown> & { id: string };
type SG = Record<string, unknown> & { id: string };

export function NetworkInterfaceDetailPage() {
  const { uid: nicId, folderId } = useParams();
  const navigate = useNavigate();
  const spec = REGISTRY["network-interfaces"];

  // Загружаем все Address-ресурсы folder'а — потом client-side filter
  // по v4_address_ids ∪ v6_address_ids текущего NIC.
  const { data: addrList } = useQuery({
    queryKey: ["addresses", "list-for-nic", folderId],
    queryFn: () =>
      api.list<{ addresses: Address[] }>("/vpc/v1/addresses", {
        folder_id: folderId!,
        pageSize: "500",
      }),
    refetchInterval: 10000,
    enabled: !!folderId,
  });

  // Аналогично — все SG folder'а для resolve security_group_ids.
  const { data: sgList } = useQuery({
    queryKey: ["security-groups", "list-for-nic", folderId],
    queryFn: () =>
      api.list<{ security_groups: SG[] }>("/vpc/v1/securityGroups", {
        folder_id: folderId!,
        pageSize: "500",
      }),
    refetchInterval: 10000,
    enabled: !!folderId,
  });

  const overviewExtras = useMemo(
    () => (data: Record<string, unknown>) => {
      const v4Ids = (data.v4_address_ids as string[] | undefined) ?? [];
      const v6Ids = (data.v6_address_ids as string[] | undefined) ?? [];
      const sgIds = (data.security_group_ids as string[] | undefined) ?? [];

      const addrById = new Map((addrList?.addresses ?? []).map((a) => [a.id, a]));
      const sgById = new Map((sgList?.security_groups ?? []).map((g) => [g.id, g]));

      const linkedAddresses: Array<{ id: string; name: string; family: string; ip: string }> = [];
      for (const id of v4Ids) {
        const a = addrById.get(id);
        const ip =
          (a?.internal_ipv4_address as { address?: string } | undefined)?.address ??
          (a?.external_ipv4_address as { address?: string } | undefined)?.address ??
          "";
        linkedAddresses.push({
          id,
          name: (a?.name as string) ?? "",
          family: "IPv4",
          ip,
        });
      }
      for (const id of v6Ids) {
        const a = addrById.get(id);
        const ip =
          (a?.internal_ipv6_address as { address?: string } | undefined)?.address ??
          (a?.external_ipv6_address as { address?: string } | undefined)?.address ??
          "";
        linkedAddresses.push({
          id,
          name: (a?.name as string) ?? "",
          family: "IPv6",
          ip,
        });
      }

      return (
        <div className="space-y-4">
          <Card size="small" title={`Подключенные адреса (${linkedAddresses.length})`}>
            {linkedAddresses.length === 0 ? (
              <Typography.Text type="secondary">Адресов не привязано.</Typography.Text>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left py-1 pr-3">Имя</th>
                    <th className="text-left py-1 pr-3">Семейство</th>
                    <th className="text-left py-1 pr-3">IP</th>
                    <th className="text-left py-1">ID</th>
                  </tr>
                </thead>
                <tbody>
                  {linkedAddresses.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-border hover:bg-muted/30 cursor-pointer"
                      onClick={() =>
                        navigate(`/folders/${folderId}/vpc/addresses/${row.id}`)
                      }
                    >
                      <td className="py-1 pr-3">
                        {row.name ? (
                          <a className="text-primary hover:underline">{row.name}</a>
                        ) : (
                          <span className="text-muted-foreground">(без имени)</span>
                        )}
                      </td>
                      <td className="py-1 pr-3">
                        <Tag color={row.family === "IPv4" ? "blue" : "geekblue"}>
                          {row.family}
                        </Tag>
                      </td>
                      <td className="py-1 pr-3 font-mono text-xs">
                        {row.ip || <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-1 font-mono text-xs text-muted-foreground">
                        {row.id}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card size="small" title={`Группы безопасности (${sgIds.length})`}>
            {sgIds.length === 0 ? (
              <Typography.Text type="secondary">SG не привязаны.</Typography.Text>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left py-1 pr-3">Имя</th>
                    <th className="text-left py-1 pr-3">Default</th>
                    <th className="text-left py-1">ID</th>
                  </tr>
                </thead>
                <tbody>
                  {sgIds.map((id) => {
                    const sg = sgById.get(id);
                    return (
                      <tr
                        key={id}
                        className="border-t border-border hover:bg-muted/30 cursor-pointer"
                        onClick={() =>
                          navigate(`/folders/${folderId}/vpc/security-groups/${id}`)
                        }
                      >
                        <td className="py-1 pr-3">
                          {(sg?.name as string) ? (
                            <a className="text-primary hover:underline">{sg?.name as string}</a>
                          ) : (
                            <span className="text-muted-foreground">(без имени)</span>
                          )}
                        </td>
                        <td className="py-1 pr-3">
                          {sg?.default_for_network ? <Tag color="gold">default</Tag> : "—"}
                        </td>
                        <td className="py-1 font-mono text-xs text-muted-foreground">
                          {id}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      );
    },
    [addrList, sgList, folderId, navigate],
  );

  // KAC-102: inline edit на /edit — custom-форма NIC.
  const renderInlineEdit = useCallback(
    (_data: Record<string, unknown>, exitEdit: () => void) =>
      folderId && nicId ? (
        <InlineNetworkInterfaceEditForm
          folderId={folderId}
          nicId={nicId}
          onCancel={exitEdit}
          onSuccess={exitEdit}
        />
      ) : null,
    [folderId, nicId],
  );

  // Без uid/folderId — generic detail (он сам обработает loading/empty).
  if (!nicId || !folderId) {
    return <ResourceDetailPage spec={spec} />;
  }

  return (
    <>
      <ResourceDetailPage
        spec={spec}
        overviewExtras={overviewExtras}
        renderInlineEdit={renderInlineEdit}
      />
      <ResourceFormModal folderId={folderId} />
    </>
  );
}
