// SubnetDetailPage — расширение generic ResourceDetailPage с utilization-баром
// и tab "IP-адреса", который показывает Address-ресурсы привязанные к этому
// subnet (через internal_ipv4_address.subnet_id), используя те же колонки,
// что и /folders/X/addresses.

import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button as AntButton, Input, Space, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { Button } from "@/components/ui/button";
import { ResourceDetailPage } from "@/components/ResourceDetailPage";
import { ResourceTable, type Column } from "@/components/ResourceTable";
import { RowActionsMenu } from "@/components/RowActionsMenu";
import { InlineSubnetEditForm } from "@/components/InlineSubnetEditForm";
import { ResourceFormModal } from "@/components/ResourceFormModal";
import { InlineResourceCreateForm } from "@/components/InlineResourceCreateForm";
import { api } from "@/api/client";
import { REGISTRY, getByPath } from "@/lib/resource-registry";
import { useNestedBreadcrumb } from "@/lib/use-nested-breadcrumb";
import { buildSpecColumns } from "@/lib/spec-columns";
import type { DetailTab } from "@/components/DetailShell";

export function SubnetDetailPage() {
  const { uid: subnetId, folderId, networkId } = useParams();
  const navigate = useNavigate();
  const spec = REGISTRY["subnets"];
  const addrSpec = REGISTRY["addresses"];

  const { segments: breadcrumbSegments, backHref: backHrefOverride } =
    useNestedBreadcrumb({
      folderId,
      networkId,
      currentResourcePlural: spec.plural,
    });

  const reserveLink =
    folderId && subnetId
      ? networkId
        ? `/folders/${folderId}/vpc/networks/${networkId}/subnets/${subnetId}/addresses/create?kind=internal`
        : `/folders/${folderId}/vpc/subnets/${subnetId}/addresses/create?kind=internal`
      : null;
  // Адреса под subnet всегда nested под subnet'ом (с/без network в цепочке).
  const addressesBasePath =
    folderId && subnetId
      ? networkId
        ? `/folders/${folderId}/vpc/networks/${networkId}/subnets/${subnetId}/addresses`
        : `/folders/${folderId}/vpc/subnets/${subnetId}/addresses`
      : null;

  // Address-ресурсы folder'а — будем фильтровать по subnet_id client-side.
  const { data: addrList } = useQuery({
    queryKey: ["addresses", "list", folderId],
    queryFn: () =>
      api.list<{ addresses: Array<Record<string, unknown>> }>(addrSpec.apiPath, {
        folder_id: folderId!,
        pageSize: "500",
      }),
    refetchInterval: 5000,
    enabled: !!folderId,
  });

  const subnetAddresses = useMemo(() => {
    const all = addrList?.addresses ?? [];
    return all.filter((a) => {
      const v4 = a.internal_ipv4_address as { subnet_id?: string } | undefined;
      const v6 = a.internal_ipv6_address as { subnet_id?: string } | undefined;
      return v4?.subnet_id === subnetId || v6?.subnet_id === subnetId;
    });
  }, [addrList, subnetId]);

  // Колонки = те же, что у Addresses list, плюс actions.
  const addrColumns = useMemo<Column<Record<string, unknown>>[]>(() => {
    const cols = buildSpecColumns(addrSpec, { folderId });
    if (addressesBasePath) {
      cols.push({
        header: "",
        className: "text-right whitespace-nowrap",
        cell: (row) => (
          <RowActionsMenu
            spec={addrSpec}
            row={row}
            basePath={addressesBasePath}
            folderUid={folderId ?? null}
          />
        ),
      });
    }
    return cols;
  }, [addrSpec, addressesBasePath, folderId]);

  const [creatingAddress, setCreatingAddress] = useState(false);

  const extraTabs = useMemo(
    () =>
      (): DetailTab[] => [
        {
          id: "addresses",
          label: "IP-адреса",
          count: subnetAddresses.length,
          render: () =>
            creatingAddress && folderId && subnetId ? (
              <InlineResourceCreateForm
                spec={addrSpec}
                ctx={{ folderId }}
                // subnet_id обеих oneof-веток предзаполнены и locked — к какой бы
                // версии (v4/v6) ни переключился пользователь, адрес привязан к
                // этой подсети; sanitize выкинет неактивную ветку из payload.
                presetFields={{
                  "internal_ipv4_address_spec.subnet_id": subnetId,
                  "internal_ipv6_address_spec.subnet_id": subnetId,
                }}
                // _address_kind остаётся editable: дефолт "internal" (IPv4),
                // но пользователь может выбрать "internal_v6".
                editablePresetFields={{ _address_kind: "internal" }}
                // В контексте подсети `external` не имеет смысла (external-адрес
                // не привязан к подсети) — оставляем только internal v4/v6.
                fieldOptionsFilter={{ _address_kind: ["internal", "internal_v6"] }}
                folderUid={folderId}
                title="Резервирование IP-адреса"
                onCancel={() => setCreatingAddress(false)}
              />
            ) : (
              <AddressesSection
                rows={subnetAddresses}
                columns={addrColumns}
                onReserve={
                  reserveLink ? () => setCreatingAddress(true) : null
                }
                onClick={(id) =>
                  addressesBasePath && navigate(`${addressesBasePath}/${id}`)
                }
              />
            ),
        },
        // tab "Операции" автоматически добавляется ResourceDetailPage —
        // не дублируем здесь.
      ],
    [
      reserveLink,
      subnetAddresses,
      addrColumns,
      addressesBasePath,
      navigate,
      creatingAddress,
      folderId,
      subnetId,
      addrSpec,
    ],
  );

  const headerActionsByTab = useCallback(
    (tabId: string) => {
      if (tabId === "addresses" && reserveLink && !creatingAddress) {
        return (
          <AntButton
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setCreatingAddress(true)}
          >
            Зарезервировать IP-адрес
          </AntButton>
        );
      }
      return null;
    },
    [reserveLink, creatingAddress],
  );

  const renderInlineEdit = useCallback(
    (_data: Record<string, unknown>, exitEdit: () => void) =>
      folderId && subnetId ? (
        <InlineSubnetEditForm
          folderId={folderId}
          subnetId={subnetId}
          onCancel={exitEdit}
        />
      ) : null,
    [folderId, subnetId],
  );

  return (
    <>
      <ResourceDetailPage
        spec={spec}
        extraTabs={extraTabs}
        headerActionsByTab={headerActionsByTab}
        backHrefOverride={backHrefOverride}
        breadcrumbSegments={breadcrumbSegments}
        renderInlineEdit={renderInlineEdit}
      />
      {folderId && <ResourceFormModal folderId={folderId} />}
    </>
  );
}

// AddressesSection — Title + filter + table для tab "IP-адреса".
function AddressesSection({
  rows,
  columns,
  onReserve,
  onClick,
}: {
  rows: Array<Record<string, unknown>>;
  columns: Column<Record<string, unknown>>[];
  onReserve: (() => void) | null;
  onClick: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const name = (getByPath<string>(row, "name") ?? "").toLowerCase();
      const id = (getByPath<string>(row, "id") ?? "").toLowerCase();
      const ext = (
        (row.external_ipv4_address as { address?: string } | undefined)?.address ?? ""
      ).toLowerCase();
      const int = (
        (row.internal_ipv4_address as { address?: string } | undefined)?.address ?? ""
      ).toLowerCase();
      const int6 = (
        (row.internal_ipv6_address as { address?: string } | undefined)?.address ?? ""
      ).toLowerCase();
      return (
        name.includes(q) || id.includes(q) || ext.includes(q) || int.includes(q) || int6.includes(q)
      );
    });
  }, [rows, query]);

  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        IP-адреса
      </Typography.Title>
      <Input.Search
        placeholder="Фильтр по имени, идентификатору или IP"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ maxWidth: 360 }}
        allowClear
      />
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center space-y-3">
          <div className="text-base font-medium">
            {query ? "По фильтру ничего не найдено" : "У вас пока нет IP-адресов"}
          </div>
          {!query && (
            <div className="text-xs text-muted-foreground">
              Зарезервируйте адрес, чтобы он автоматически использовал
              CIDR-блок этой подсети.
            </div>
          )}
          {!query && onReserve && (
            <Button onClick={onReserve}>
              <Plus className="h-4 w-4" /> Зарезервировать IP-адрес
            </Button>
          )}
        </div>
      ) : (
        <ResourceTable
          rows={filtered}
          columns={columns}
          rowKey={(r) => getByPath<string>(r, "id") ?? Math.random().toString()}
          onRowClick={(r) => {
            const id = getByPath<string>(r, "id");
            if (id) onClick(id);
          }}
        />
      )}
    </Space>
  );
}
