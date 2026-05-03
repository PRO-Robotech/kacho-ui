import { useQuery } from "@tanstack/react-query";
import { post } from "@/api/client";
import { getResource } from "@/lib/resource-registry";
import { useFolderStore } from "@/lib/folder-store";

interface Props {
  refResource: string;
  refFolderScoped?: boolean;
  value?: string;
  onChange: (uid: string) => void;
  placeholder?: string;
  id?: string;
}

export function RefSelect({ refResource, refFolderScoped, value, onChange, placeholder, id }: Props) {
  const folder = useFolderStore((s) => s.folder);
  const spec = getResource(refResource);

  const enabled = !!spec && (!refFolderScoped || !!folder);

  const { data, isLoading, error } = useQuery({
    queryKey: ["ref", refResource, refFolderScoped ? folder?.uid : null],
    queryFn: () =>
      post<unknown, Record<string, unknown>>(`/v1/${spec!.apiPath}/list`, {
        selectors:
          refFolderScoped && folder
            ? [{ field: "folder_id", op: "EQ", values: [folder.uid] }]
            : [],
      }),
    enabled,
    staleTime: 30_000,
  });

  if (!spec) return <div className="text-xs text-rose-600">Unknown ref: {refResource}</div>;

  const options =
    ((data?.[spec.payloadKey] as Array<{ metadata: { uid: string; name: string } }>) ?? []).map((it) => ({
      uid: it.metadata.uid,
      name: it.metadata.name,
    }));

  return (
    <div className="space-y-1">
      <select
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-9 w-full rounded-md border border-border bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
        disabled={!enabled}
      >
        <option value="">{placeholder ?? `Выбрать ${spec.singular}…`}</option>
        {options.map((o) => (
          <option key={o.uid} value={o.uid}>
            {o.name} — {o.uid.slice(0, 8)}…
          </option>
        ))}
      </select>
      {refFolderScoped && !folder && (
        <p className="text-xs text-amber-600">Выберите folder в шапке для загрузки.</p>
      )}
      {isLoading && <p className="text-xs text-muted-foreground">Загрузка списка {spec.plural}…</p>}
      {error && <p className="text-xs text-rose-600">Ошибка: {(error as Error).message}</p>}
      {value && options.length > 0 && !options.find((o) => o.uid === value) && (
        <p className="text-xs text-amber-600">UID не найден в списке (возможно ресурс удалён).</p>
      )}
    </div>
  );
}
