// SubnetDetailPage — расширение generic ResourceDetailPage с utilization-баром
// и tab "IP-адреса", который показывает Address-ресурсы привязанные к этому
// subnet (через internal_ipv4_address.subnet_id), используя те же колонки,
// что и /folders/X/addresses.

import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Alert, Button as AntButton, Input, Space, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { Button } from "@/components/ui/button";
import { ResourceDetailPage } from "@/components/ResourceDetailPage";
import { ResourceTable, type Column } from "@/components/ResourceTable";
import { RowActionsMenu } from "@/components/RowActionsMenu";
import { api } from "@/api/client";
import { REGISTRY, getByPath } from "@/lib/resource-registry";
import { buildSpecColumns } from "@/lib/spec-columns";
import type { DetailTab } from "@/components/DetailShell";

export function SubnetDetailPage() {
  const { uid: subnetId, folderId } = useParams();
  const navigate = useNavigate();
  const spec = REGISTRY["subnets"];
  const addrSpec = REGISTRY["addresses"];

  const reserveLink =
    folderId && subnetId
      ? `/folders/${folderId}/addresses/create?subnet_id=${subnetId}&kind=internal`
      : null;
  const addressesBasePath = folderId ? `/folders/${folderId}/addresses` : null;

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
      const internal = a.internal_ipv4_address as { subnet_id?: string } | undefined;
      return internal?.subnet_id === subnetId;
    });
  }, [addrList, subnetId]);

  // Колонки = те же, что у Addresses list, плюс actions.
  const addrColumns = useMemo<Column<Record<string, unknown>>[]>(() => {
    const cols = buildSpecColumns(addrSpec);
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

  const extraTabs = useMemo(
    () =>
      (): DetailTab[] => [
        {
          id: "addresses",
          label: "IP-адреса",
          count: subnetAddresses.length,
          render: () => (
            <AddressesSection
              rows={subnetAddresses}
              columns={addrColumns}
              reserveLink={reserveLink}
              onClick={(id) =>
                addressesBasePath && navigate(`${addressesBasePath}/${id}`)
              }
            />
          ),
        },
        {
          id: "operations",
          label: "Операции",
          render: () => (
            <Alert
              type="info"
              showIcon
              message="История операций"
              description="OperationService пока не поддерживает фильтр по resource_id. Список операций по этой подсети появится после соответствующего изменения backend (см. план §11.1)."
            />
          ),
        },
      ],
    [reserveLink, subnetAddresses, addrColumns, addressesBasePath, navigate],
  );

  const headerActionsByTab = (tabId: string) => {
    if (tabId === "addresses" && reserveLink) {
      return (
        <AntButton
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => navigate(reserveLink)}
        >
          Зарезервировать IP-адрес
        </AntButton>
      );
    }
    return null;
  };

  return (
    <ResourceDetailPage
      spec={spec}
      extraTabs={extraTabs}
      hideJsonTab
      headerActionsByTab={headerActionsByTab}
    />
  );
}

// AddressesSection — Title + filter + table для tab "IP-адреса".
function AddressesSection({
  rows,
  columns,
  reserveLink,
  onClick,
}: {
  rows: Array<Record<string, unknown>>;
  columns: Column<Record<string, unknown>>[];
  reserveLink: string | null;
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
      return name.includes(q) || id.includes(q) || ext.includes(q) || int.includes(q);
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
          {!query && reserveLink && (
            <Button asChild>
              <Link to={reserveLink}>
                <Plus className="h-4 w-4" /> Зарезервировать IP-адрес
              </Link>
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
