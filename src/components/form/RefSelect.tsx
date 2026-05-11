// RefSelect — выбор ресурса по ID из выпадающего списка.
// Загружает список через GET <apiPath>?folder_id=<uid>.
// apiPath уже содержит полный путь (e.g. "/resource-manager/v1/organizations"),
// никакого "/v1/" префикса не добавляем.
// Flat API: ресурсы имеют поля id и name.

import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { getResource } from "@/lib/resource-registry";
import { useFolderStore } from "@/lib/folder-store";
import { CopyableId } from "@/components/CopyableId";
import { ErrorResult } from "@/components/ErrorResult";

interface Props {
  refResource: string;
  refFolderScoped?: boolean;
  value?: string;
  onChange: (uid: string) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
}

export function RefSelect({ refResource, refFolderScoped, value, onChange, placeholder, id, disabled }: Props) {
  const folder = useFolderStore((s) => s.folder);
  const spec = getResource(refResource);

  const enabled = !!spec && (!refFolderScoped || !!folder);

  const { data, isLoading, error } = useQuery({
    queryKey: ["ref", refResource, refFolderScoped ? folder?.uid : null],
    queryFn: () => {
      const q: Record<string, string> = {};
      if (refFolderScoped && folder) q["folder_id"] = folder.uid;
      return api.list<Record<string, Array<{ id: string; name: string }>>>(
        spec!.apiPath,
        q,
      );
    },
    enabled,
    staleTime: 30_000,
  });

  if (!spec) return <div className="text-xs text-rose-600">Unknown ref: {refResource}</div>;

  const options = (data?.[spec.payloadKey] ?? []).map((it) => ({
    uid: it.id,
    name: it.name,
  }));

  return (
    <div className="space-y-1">
      <select
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-9 w-full rounded-md border border-border bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled || !enabled}
      >
        <option value="">{placeholder ?? `Выбрать ${spec.singular}…`}</option>
        {options.map((o) => (
          <option key={o.uid} value={o.uid}>
            {o.name} — {o.uid}
          </option>
        ))}
      </select>
      {value && <CopyableId id={value} />}
      {refFolderScoped && !folder && (
        <p className="text-xs text-amber-600">Выберите folder в шапке для загрузки.</p>
      )}
      {isLoading && (
        <p className="text-xs text-muted-foreground">Загрузка списка {spec.plural}…</p>
      )}
      {error && <ErrorResult error={error} />}
      {value && options.length > 0 && !options.find((o) => o.uid === value) && (
        <p className="text-xs text-amber-600">
          ID не найден в списке (возможно ресурс удалён).
        </p>
      )}
    </div>
  );
}
