// RefSelect — выбор ресурса по ID из выпадающего списка.
// Загружает список через GET <apiPath>?folder_id=<uid> (+ опц. динамический
// query-параметр от другого поля формы, напр. ?subnet_id=<form.subnet_id>).
// apiPath уже содержит полный путь (e.g. "/resource-manager/v1/organizations"),
// никакого "/v1/" префикса не добавляем.
// Flat API: ресурсы имеют поля id и name.
//
// Если задан createResource — в списке появляется «+ Создать …» entry,
// открывающая InlineResourceCreateForm в модалке (паттерн inline-create
// related-resource, как на NetworkDetailPage / SubnetDetailPage). На success
// id созданного ресурса подставляется в это поле.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "antd";
import { api } from "@/api/client";
import { getResource } from "@/lib/resource-registry";
import { useFolderStore } from "@/lib/folder-store";
import { useContext } from "@/lib/context-store";
import { CopyableId } from "@/components/CopyableId";
import { ErrorResult } from "@/components/ErrorResult";
import { InlineResourceCreateForm } from "@/components/InlineResourceCreateForm";

interface Props {
  refResource: string;
  refFolderScoped?: boolean;
  value?: string;
  onChange: (uid: string) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  // Динамический query-параметр от другого поля формы.
  refQueryFromField?: { param: string; field: string };
  // Клиентский фильтр-предикат поверх загруженного candidate-list.
  refFilter?: (row: Record<string, unknown>) => boolean;
  // Текущее значение всей формы (для refQueryFromField / createPresetFields).
  formValue?: Record<string, unknown>;
  // Inline-create related-resource.
  createResource?: string;
  createPresetFields?: (form: Record<string, unknown>) => Record<string, unknown>;
  createTitle?: string;
}

export function RefSelect({
  refResource,
  refFolderScoped,
  value,
  onChange,
  placeholder,
  id,
  disabled,
  refQueryFromField,
  refFilter,
  formValue,
  createResource,
  createPresetFields,
  createTitle,
}: Props) {
  const folder = useFolderStore((s) => s.folder);
  const cloud = useContext((s) => s.cloud);
  const org = useContext((s) => s.org);
  const spec = getResource(refResource);
  const createSpec = createResource ? getResource(createResource) : undefined;

  const [creating, setCreating] = useState(false);

  // Динамический query-параметр (e.g. subnet_id) — берём из текущего значения формы.
  const dynParamValue =
    refQueryFromField && formValue
      ? (formValue[refQueryFromField.field] as string | undefined)
      : undefined;
  const needsDynParam = !!refQueryFromField;

  const enabled =
    !!spec &&
    (!refFolderScoped || !!folder) &&
    (!needsDynParam || !!dynParamValue);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [
      "ref",
      refResource,
      refFolderScoped ? folder?.uid : null,
      needsDynParam ? dynParamValue ?? null : null,
    ],
    queryFn: () => {
      const q: Record<string, string> = {};
      if (refFolderScoped && folder) q["folder_id"] = folder.uid;
      if (refQueryFromField && dynParamValue) q[refQueryFromField.param] = dynParamValue;
      return api.list<Record<string, Array<{ id: string; name: string } & Record<string, unknown>>>>(
        spec!.apiPath,
        q,
      );
    },
    enabled,
    staleTime: 30_000,
  });

  if (!spec) return <div className="text-xs text-rose-600">Unknown ref: {refResource}</div>;

  const candidates = (data?.[spec.payloadKey] ?? []).filter((it) =>
    refFilter ? refFilter(it as Record<string, unknown>) : true,
  );
  const options = candidates.map((it) => ({
    uid: it.id,
    name: it.name,
  }));

  const CREATE_SENTINEL = "__create__";

  return (
    <div className="space-y-1">
      <select
        id={id}
        value={value ?? ""}
        onChange={(e) => {
          if (e.target.value === CREATE_SENTINEL) {
            setCreating(true);
            return;
          }
          onChange(e.target.value);
        }}
        className="flex h-9 w-full rounded-md border border-border bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled || !enabled}
      >
        <option value="">{placeholder ?? `Выбрать ${spec.singular}…`}</option>
        {options.map((o) => (
          <option key={o.uid} value={o.uid}>
            {o.name} — {o.uid}
          </option>
        ))}
        {createSpec && (
          <option value={CREATE_SENTINEL}>+ Создать {createSpec.singular.toLowerCase()}…</option>
        )}
      </select>
      {value && <CopyableId id={value} />}
      {refFolderScoped && !folder && (
        <p className="text-xs text-amber-600">Выберите folder в шапке для загрузки.</p>
      )}
      {needsDynParam && !dynParamValue && (
        <p className="text-xs text-amber-600">
          Сначала выберите «{refQueryFromField!.field}» выше.
        </p>
      )}
      {isLoading && (
        <p className="text-xs text-muted-foreground">Загрузка списка {spec.plural}…</p>
      )}
      {error && <ErrorResult error={error} />}
      {value && options.length > 0 && !options.find((o) => o.uid === value) && (
        <p className="text-xs text-amber-600">
          ID не найден в списке (возможно ресурс удалён или вне фильтра).
        </p>
      )}

      {creating && createSpec && (
        <Modal
          open
          footer={null}
          onCancel={() => setCreating(false)}
          width={640}
          destroyOnClose
          title={createTitle ?? `Создать ${createSpec.singular.toLowerCase()}`}
        >
          <InlineResourceCreateForm
            spec={createSpec}
            ctx={{
              folderId: folder?.uid,
              cloudId: cloud?.id,
              organizationId: org?.id,
            }}
            presetFields={createPresetFields && formValue ? createPresetFields(formValue) : undefined}
            folderUid={folder?.uid ?? null}
            title={createTitle}
            onCancel={() => setCreating(false)}
            onSuccess={() => {
              // refetch candidate-list — новый ресурс должен появиться;
              // затем подхватываем последний созданный по имени-эвристике
              // (InlineResourceCreateForm не отдаёт id наверх — после refetch
              // diff'им список). Простой best-effort: перезапрашиваем и
              // оставляем выбор пользователю, если не смогли определить.
              void refetch().then((r) => {
                const after = (r.data?.[spec.payloadKey] ?? []) as Array<{ id: string }>;
                const before = new Set(options.map((o) => o.uid));
                const fresh = after.find((it) => !before.has(it.id));
                if (fresh) onChange(fresh.id);
              });
            }}
          />
        </Modal>
      )}
    </div>
  );
}
