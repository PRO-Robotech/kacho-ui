// SubnetFormModal — модалка для создания/редактирования подсети, открываемая
// поверх любой страницы через query-флаг.
//
// URL-контракт (deep-link / якорь):
//   ?modal=subnet-create[&networkId=<n>]   ← создание (контекст-сеть optional)
//   ?modal=subnet-edit&subnetId=<id>       ← редактирование
//
// Любая страница, которая хочет показать subnet-форму, делает:
//   navigate("?modal=subnet-create&networkId=<n>", { replace: false })
// При close модалки query-флаг убирается, страница под ней остаётся открыта.

import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Modal } from "antd";
import { InlineSubnetCreateForm } from "@/components/InlineSubnetCreateForm";
import { InlineSubnetEditForm } from "@/components/InlineSubnetEditForm";

interface Props {
  folderId: string;
  /** Optional — что делать после success (обычно invalidate / refresh). По
   *  умолчанию: ничего, query-флаг снимается → модалка закрывается. */
  onSuccess?: () => void;
}

export function SubnetFormModal({ folderId, onSuccess }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const modal = searchParams.get("modal");
  const isCreate = modal === "subnet-create";
  const isEdit = modal === "subnet-edit";
  const subnetId = searchParams.get("subnetId") ?? undefined;
  const networkId = searchParams.get("networkId") ?? undefined;

  const close = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.delete("modal");
    params.delete("subnetId");
    params.delete("networkId");
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  const title = useMemo(() => {
    if (isCreate) return "Создание подсети";
    if (isEdit) return "Редактирование подсети";
    return null;
  }, [isCreate, isEdit]);

  const handleSuccess = () => {
    onSuccess?.();
    close();
  };

  if (!isCreate && !isEdit) return null;

  return (
    <Modal
      open
      onCancel={close}
      footer={null}
      width={860}
      destroyOnClose
      maskClosable={false}
      title={null}
      // Внутри формы есть свой <Title level={4}>; модалочный header убираем,
      // чтобы не дублировать заголовок.
      styles={{ body: { paddingTop: 16 } }}
    >
      {isCreate && (
        <InlineSubnetCreateForm
          folderId={folderId}
          networkId={networkId}
          onCancel={close}
          onSuccess={handleSuccess}
        />
      )}
      {isEdit && subnetId && (
        <InlineSubnetEditForm
          folderId={folderId}
          subnetId={subnetId}
          onCancel={close}
        />
      )}
      {/* Заголовок-заглушка для accessibility — Modal требует title. */}
      <span style={{ position: "absolute", left: -10000 }}>{title}</span>
    </Modal>
  );
}
