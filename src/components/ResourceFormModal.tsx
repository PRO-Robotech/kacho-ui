// ResourceFormModal — generic модалка Create/Edit для любого VPC-ресурса.
// Открывается через query:
//   ?modal=<spec.id>-create[&...preset]   ← создание
//   ?modal=<spec.id>-edit&id=<uid>        ← редактирование
//
// Внутри модалки используется:
//   * Custom-инлайн форма (если ресурс её имеет — InlineSubnetCreateForm,
//     InlineSubnetEditForm, InlineSecurityGroupEditForm и т.п.).
//   * Иначе — generic InlineResourceCreateForm / InlineResourceEditForm
//     по spec.fields.
//
// Mount: один экземпляр на каждой странице, где могут открываться модалки
// (List / Detail). Сама модалка — fragment-noop пока в URL нет ?modal=.

import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "antd";
import { InlineResourceCreateForm } from "@/components/InlineResourceCreateForm";
import { InlineResourceEditForm } from "@/components/InlineResourceEditForm";
import { InlineSubnetCreateForm } from "@/components/InlineSubnetCreateForm";
import { InlineSubnetEditForm } from "@/components/InlineSubnetEditForm";
import { InlineSecurityGroupEditForm } from "@/components/InlineSecurityGroupEditForm";
import { InlineAddressPoolCreateForm } from "@/components/InlineAddressPoolCreateForm";
import { InlineAddressPoolEditForm } from "@/components/InlineAddressPoolEditForm";
import { InlineNetworkInterfaceEditForm } from "@/components/InlineNetworkInterfaceEditForm";
import { InlineNetworkInterfaceCreateForm } from "@/components/InlineNetworkInterfaceCreateForm";
import { REGISTRY } from "@/lib/resource-registry";
import { useContext } from "@/lib/context-store";
import { api } from "@/api/client";

interface Props {
  projectId: string;
}

export function ResourceFormModal({ projectId }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const modal = searchParams.get("modal") ?? "";
  // Account-scoped IAM-ресурсы (Project / ServiceAccount) берут account_id из
  // выбранного в IAM-секции Account — пробрасываем в ctx.template.
  const accountId = useContext((s) => s.account?.id);

  // Парсим `<spec-id>-(create|edit)`.
  const match = modal.match(/^([a-z-]+)-(create|edit)$/);
  const specId = match?.[1];
  const action = match?.[2] as "create" | "edit" | undefined;
  const spec = specId ? REGISTRY[specId] : undefined;
  const id = searchParams.get("id") ?? undefined;

  const close = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.delete("modal");
    params.delete("id");
    // Сохраняем networkId / subnetId preset как контекст-параметры (могут
    // быть нужны parent-странице) — НЕ удаляем.
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  // Для Edit: загружаем ресурс (нужно для InlineResourceEditForm — она
  // принимает data, а не id).
  const { data: editData } = useQuery({
    queryKey: [specId, "detail", id],
    queryFn: () => api.get<Record<string, unknown>>(`${spec?.apiPath}/${id}`),
    enabled: action === "edit" && !!spec && !!id,
  });

  // Preset-fields для Create: пробрасываем все query-params кроме служебных.
  const presetFields = useMemo(() => {
    if (action !== "create") return undefined;
    const fields: Record<string, unknown> = {};
    for (const [k, v] of searchParams.entries()) {
      if (k === "modal" || k === "id") continue;
      // network_id / subnet_id и т.п. — preset (как из формы).
      fields[k.replace(/([A-Z])/g, "_$1").toLowerCase()] = v;
    }
    return fields;
  }, [action, searchParams]);

  // Единая ширина для ВСЕХ модалок ресурсов — visual unity.
  const width = 860;

  if (!spec || !action) return null;
  if (action === "edit" && (!id || !editData)) {
    // Открыли edit-модалку, но id/данные ещё не загружены — пустая.
    return null;
  }

  const title = action === "create"
    ? `Создание: ${spec.singular}`
    : `Редактирование: ${spec.singular}`;

  // Custom-форма по spec.id (если есть отдельный YC-style виджет) — иначе
  // generic spec-based.
  const formNode = (() => {
    if (specId === "subnets" && action === "create") {
      return (
        <InlineSubnetCreateForm
          projectId={projectId}
          networkId={searchParams.get("networkId") ?? undefined}
          onCancel={close}
          onSuccess={close}
        />
      );
    }
    if (specId === "subnets" && action === "edit" && id) {
      return (
        <InlineSubnetEditForm
          projectId={projectId}
          subnetId={id}
          onCancel={close}
        />
      );
    }
    if (specId === "security-groups" && action === "edit" && id) {
      return (
        <InlineSecurityGroupEditForm
          projectId={projectId}
          sgId={id}
          onCancel={close}
        />
      );
    }
    if (specId === "address-pools" && action === "create") {
      // KAC-71: AddressPool с тем же CIDR-chip layout, что у Subnet
      // (поддержка v4/v6, KAC-60 sparse IPAM).
      return (
        <InlineAddressPoolCreateForm
          onCancel={close}
          onSuccess={close}
        />
      );
    }
    if (specId === "address-pools" && action === "edit" && id) {
      return (
        <InlineAddressPoolEditForm
          poolId={id}
          onCancel={close}
          onSuccess={close}
        />
      );
    }
    if (specId === "network-interfaces" && action === "edit" && id) {
      return (
        <InlineNetworkInterfaceEditForm
          projectId={projectId}
          nicId={id}
          onCancel={close}
          onSuccess={close}
        />
      );
    }
    if (specId === "network-interfaces" && action === "create") {
      return (
        <InlineNetworkInterfaceCreateForm
          projectId={projectId}
          subnetId={searchParams.get("subnetId") ?? searchParams.get("subnet_id") ?? undefined}
          onCancel={close}
          onSuccess={close}
        />
      );
    }
    // addresses + create в контексте subnet (subnetId в query) — preset обе
    // ветки internal_ipv4/v6_address_spec.subnet_id, editable _address_kind
    // только internal v4/v6 (external не имеет смысла под subnet).
    if (specId === "addresses" && action === "create") {
      const subnetId =
        searchParams.get("subnetId") ?? searchParams.get("subnet_id") ?? undefined;
      if (subnetId) {
        return (
          <InlineResourceCreateForm
            spec={spec}
            ctx={{ projectId }}
            presetFields={{
              "internal_ipv4_address_spec.subnet_id": subnetId,
              "internal_ipv6_address_spec.subnet_id": subnetId,
            }}
            editablePresetFields={{ _address_kind: "internal" }}
            fieldOptionsFilter={{ _address_kind: ["internal", "internal_v6"] }}
            projectId={projectId}
            title="Резервирование IP-адреса"
            onCancel={close}
            onSuccess={close}
          />
        );
      }
    }
    if (action === "create") {
      return (
        <InlineResourceCreateForm
          spec={spec}
          ctx={{ projectId, accountId }}
          presetFields={presetFields}
          projectId={projectId}
          title={title}
          onCancel={close}
          onSuccess={close}
        />
      );
    }
    if (action === "edit" && editData) {
      return (
        <InlineResourceEditForm
          spec={spec}
          data={editData}
          projectId={projectId}
          onCancel={close}
          onSuccess={close}
        />
      );
    }
    return null;
  })();

  return (
    <Modal
      open
      onCancel={close}
      footer={null}
      width={width}
      destroyOnClose
      // Клик по маске вне модалки → закрытие (user UX-запрос).
      maskClosable={true}
      title={null}
      // У всех inline-форм свой <Title level={4}> — не дублируем Modal-title.
      // Компактный padding (user: «слишком большое расстояние по бокам»).
      styles={{
        body: {
          paddingTop: 16,
          paddingBottom: 12,
          paddingLeft: 12,
          paddingRight: 12,
        },
      }}
      // Anim — стандартная Antd (zoom from center). Без transform-origin
      // override модалка появляется из центра, не от точки клика.
    >
      {/* Унифицирующая обёртка: maxWidth → forms not slip past modal width;
          Inline-форма сама рендерит Title level=4 + content. */}
      <div style={{ width: "100%" }}>{formNode}</div>
      <span style={{ position: "absolute", left: -10000 }} aria-hidden>
        {title}
      </span>
    </Modal>
  );
}
