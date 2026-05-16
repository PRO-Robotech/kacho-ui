// TopLevelCreatePage — KAC-103: full-page форма Create для top-level VPC
// ресурсов (без parent'а в URL). URL — /folders/<f>/vpc/create-<slug>.
//
// Layout: breadcrumb (Service / Plural / Создание <singular>) + form. Форма
// диспатчится по spec.id — для custom-YC-стайл ресурсов (Subnet, NIC,
// AddressPool) используются Inline*CreateForm (визуальный parity с модалкой
// ResourceFormModal), для остальных — generic InlineResourceCreateForm.

import { useMemo } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Typography } from "antd";
import { useBreadcrumb, useHeaderRight } from "@/components/PageHeaderSlot";
import { InlineResourceCreateForm } from "@/components/InlineResourceCreateForm";
import { InlineSubnetCreateForm } from "@/components/InlineSubnetCreateForm";
import { InlineAddressPoolCreateForm } from "@/components/InlineAddressPoolCreateForm";
import { InlineNetworkInterfaceCreateForm } from "@/components/InlineNetworkInterfaceCreateForm";
import { REGISTRY, type ResourceSpec } from "@/lib/resource-registry";

interface Props {
  spec: ResourceSpec;
}

export function TopLevelCreatePage({ spec }: Props) {
  const { folderId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const listHref = folderId ? `/folders/${folderId}/vpc/${spec.route}` : "/";

  const breadcrumb = useMemo(
    () => (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        {spec.serviceTitle && (
          <>
            <Typography.Text type="secondary">{spec.serviceTitle}</Typography.Text>
            <Typography.Text type="secondary">/</Typography.Text>
          </>
        )}
        <Link to={listHref}>
          <Typography.Text type="secondary">{spec.plural}</Typography.Text>
        </Link>
        <Typography.Text type="secondary">/</Typography.Text>
        <Typography.Text strong>Создание: {spec.singular}</Typography.Text>
      </span>
    ),
    [listHref, spec.plural, spec.serviceTitle, spec.singular],
  );
  useBreadcrumb(breadcrumb);
  const noHeaderRight = useMemo(() => null, []);
  useHeaderRight(noHeaderRight);

  if (!folderId) {
    return (
      <div style={{ padding: 24 }}>
        <Typography.Text type="secondary">Выберите folder в шапке.</Typography.Text>
      </div>
    );
  }

  const onSuccess = () => navigate(listHref);
  const onCancel = () => navigate(listHref);

  // Preset из query — для случаев глубоких ссылок (e.g. ?network_id=…).
  const presetFromQuery = useMemo(() => {
    const fields: Record<string, unknown> = {};
    for (const [k, v] of searchParams.entries()) {
      if (k === "modal" || k === "id") continue;
      fields[k.replace(/([A-Z])/g, "_$1").toLowerCase()] = v;
    }
    return Object.keys(fields).length > 0 ? fields : undefined;
  }, [searchParams]);

  // Диспатчер форм — зеркально ResourceFormModal.formNode для create.
  if (spec.id === "subnets") {
    return (
      <PageWrap>
        <InlineSubnetCreateForm
          folderId={folderId}
          networkId={searchParams.get("networkId") ?? undefined}
          onCancel={onCancel}
          onSuccess={onSuccess}
        />
      </PageWrap>
    );
  }
  if (spec.id === "address-pools") {
    return (
      <PageWrap>
        <InlineAddressPoolCreateForm onCancel={onCancel} onSuccess={onSuccess} />
      </PageWrap>
    );
  }
  if (spec.id === "network-interfaces") {
    return (
      <PageWrap>
        <InlineNetworkInterfaceCreateForm
          folderId={folderId}
          subnetId={searchParams.get("subnetId") ?? searchParams.get("subnet_id") ?? undefined}
          onCancel={onCancel}
          onSuccess={onSuccess}
        />
      </PageWrap>
    );
  }
  // Generic: остальные публичные VPC ресурсы (Network, Address, RT, SG,
  // Gateway, PrivateEndpoint) — через spec-driven form.
  return (
    <PageWrap>
      <InlineResourceCreateForm
        spec={spec}
        ctx={{ folderId }}
        presetFields={presetFromQuery}
        folderUid={folderId}
        title={`Создание: ${spec.singular}`}
        onCancel={onCancel}
        onSuccess={onSuccess}
      />
    </PageWrap>
  );
}

// PageWrap — общая обёртка с padding'ами, чтобы форма не лежала вплотную к
// краям. Inline-form'ы рендерят свой Typography.Title (см. их код).
function PageWrap({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      {/* Spec-аргумент `spec` нужен только для лук-апа registry в App.tsx
          route'е. По умолчанию список ниже соответствует резолверу `slug
          → REGISTRY` в `lib/create-child-url.ts`. */}
      {children}
    </div>
  );
}

// Helper: получить spec по slug. Используется в route-wrapper (см. App.tsx).
export function getSpecBySlug(slug: string): ResourceSpec | null {
  // Импорт из create-child-url.ts даёт нам slug → specId; затем REGISTRY[specId].
  // Локально дублируем slugs чтобы избежать circular import (TopLevelCreatePage
  // и create-child-url оба используются в App.tsx, граф связей плоский).
  const SLUGS: Record<string, string> = {
    network: "networks",
    subnet: "subnets",
    "route-table": "route-tables",
    "security-group": "security-groups",
    address: "addresses",
    "network-interface": "network-interfaces",
    gateway: "gateways",
    "private-endpoint": "private-endpoints",
  };
  const specId = SLUGS[slug];
  return specId ? REGISTRY[specId] ?? null : null;
}
