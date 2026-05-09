// ResourceCreatePage — full-page форма Create (не modal).
//
// Используется для всех Create flow в YC-стиле: separate URL
// `/folders/:folderId/<resource>/create`. Edit пока остаётся в modal'е
// (ResourceFormDialog), это менее фундаментальное действие.
//
// Pre-fill context — через query-string. Например, для Address:
//   /folders/X/addresses/create?subnet_id=Y&kind=internal
// автоматически заполнит internal_ipv4_address_spec.subnet_id и
// _address_kind=internal, и сделает эти поля immutable в форме (visual hint).

import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormFieldRenderer } from "@/components/form/FormField";
import { extractOperationId } from "@/components/OperationDialog";
import { OperationToastWatcher } from "@/components/OperationToastWatcher";
import { useBreadcrumb, useHeaderRight } from "@/components/PageHeaderSlot";
import { ApiError, api } from "@/api/client";
import { applyFieldDefaults, getByPath, type ResourceSpec } from "@/lib/resource-registry";
import { setByPath } from "@/lib/path";
import { useInvalidateResourceList } from "@/lib/use-operation";
import { toast } from "@/lib/toast";

interface Props {
  spec: ResourceSpec;
  /** API field name для filter list query (e.g. "folder_id"). */
  parentField?: string;
  /** URL-param name для contextual filter (e.g. "folderId"). */
  parentParam?: string;
}

export function ResourceCreatePage({ spec, parentField, parentParam }: Props) {
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterValue = parentParam ? (params[parentParam] ?? null) : null;
  const invalidate = useInvalidateResourceList();

  // Контекст для template (folderId / cloudId / organizationId).
  const ctx = useMemo(
    () => ({
      folderId: parentField === "folder_id" ? (filterValue ?? undefined) : undefined,
      cloudId: parentField === "cloud_id" ? (filterValue ?? undefined) : undefined,
      organizationId:
        parentField === "organization_id" ? (filterValue ?? undefined) : undefined,
    }),
    [parentField, filterValue],
  );

  // Pre-fill из ?query=. Конкретные ключи поддерживаемые сейчас:
  //   - subnet_id    → internal_ipv4_address_spec.subnet_id
  //   - kind         → _address_kind  ("external" | "internal")
  //   - network_id   → network_id (для Subnet, RouteTable, SG)
  // Не строгая схема — если ключ не нужен ресурсу, sanitize его выкинет.
  const presetFields = useMemo(() => {
    const out: Record<string, unknown> = {};
    const subnetId = searchParams.get("subnet_id");
    const networkId = searchParams.get("network_id");
    const kind = searchParams.get("kind");
    if (kind) out["_address_kind"] = kind;
    if (subnetId) {
      if (kind === "internal" || (!kind && spec.id === "addresses")) {
        out["internal_ipv4_address_spec.subnet_id"] = subnetId;
      } else {
        out["subnet_id"] = subnetId;
      }
    }
    if (networkId) out["network_id"] = networkId;
    return out;
  }, [searchParams, spec.id]);

  // Initial form value: template + applyDefaults + presets.
  const initialObj = useMemo(() => {
    const tpl = spec.template(ctx);
    const baseObj =
      typeof tpl === "object" && tpl !== null
        ? { ...(tpl as Record<string, unknown>) }
        : {};
    let merged: Record<string, unknown> = applyFieldDefaults(spec.fields, baseObj);
    for (const [path, val] of Object.entries(presetFields)) {
      merged = setByPath(merged, path, val);
    }
    return merged;
    // initialObj вычисляем 1 раз на mount; пересоздавать его при смене presets
    // нежелательно — пользователь может уже вводить. presets применяются только
    // на старте.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [obj, setObj] = useState<Record<string, unknown>>(initialObj);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [opId, setOpId] = useState<string | null>(null);

  // Snapshot presets — для immutable-overlay.
  const lockedPathsRef = useRef(new Set(Object.keys(presetFields)));

  const backHref = parentParam && filterValue
    ? `/folders/${filterValue}/${spec.route}`
    : `/${spec.route}`;

  // Slots: breadcrumb + cancel в header'е.
  useBreadcrumb(
    <>
      <Link to={backHref} className="text-muted-foreground hover:text-foreground">
        {spec.plural}
      </Link>
      <span className="text-muted-foreground/40">/</span>
      <span className="text-foreground">Создать</span>
    </>,
  );
  useHeaderRight(null);

  const mutation = useMutation({
    mutationFn: (item: unknown) => api.create(spec.apiPath, item),
    onSuccess: (resp) => {
      setSubmitErr(null);
      const id = extractOperationId(resp);
      if (id) {
        setOpId(id);
      } else {
        invalidate(spec.id, filterValue ?? null);
        navigate(backHref);
      }
    },
    onError: (err) => {
      const m = err instanceof ApiError ? `${err.code}: ${err.message}` : (err as Error).message;
      setSubmitErr(m);
      toast.error(`Создать ${spec.singular}: ${m}`);
    },
  });

  const submit = () => {
    setSubmitErr(null);
    let parsed: Record<string, unknown> = obj;
    if (spec.sanitize) parsed = spec.sanitize(parsed);
    mutation.mutate(parsed);
  };

  const fields = spec.fields;
  if (!fields) {
    return (
      <div className="rounded-md bg-amber-500/10 text-amber-300 p-3 text-sm">
        У ресурса {spec.singular} нет form-schema; используйте API напрямую.
      </div>
    );
  }

  return (
    <>
      <div className="max-w-3xl space-y-5">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 h-7 px-2">
            <Link to={backHref}>
              <ArrowLeft className="h-4 w-4" /> {spec.plural}
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">
            Создать {spec.singular.toLowerCase()}
          </h1>
        </div>

        {Object.keys(presetFields).length > 0 && (
          <div className="rounded-md bg-blue-500/10 text-blue-300 px-3 py-2 text-xs">
            Предзаполнено из контекста: {Object.entries(presetFields).map(([k, v]) => (
              <code key={k} className="mr-2 px-1 rounded bg-blue-500/10">{k}={String(v)}</code>
            ))}
          </div>
        )}

        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          {fields.map((f) => (
            <FormFieldRenderer
              key={f.name}
              field={
                lockedPathsRef.current.has(f.name) ? { ...f, immutable: true } : f
              }
              pathPrefix=""
              value={obj}
              onChange={setObj}
              editMode={lockedPathsRef.current.has(f.name)}
            />
          ))}
        </div>

        {submitErr && (
          <div className="rounded-md bg-destructive/10 text-destructive p-3 text-sm">
            {submitErr}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            onClick={submit}
            disabled={mutation.isPending || opId !== null}
          >
            {mutation.isPending ? "Отправка…" : opId !== null ? "Выполнение…" : `Создать ${spec.singular.toLowerCase()}`}
          </Button>
          <Button
            variant="ghost"
            asChild
            disabled={mutation.isPending}
          >
            <Link to={backHref}>Отменить</Link>
          </Button>
        </div>
      </div>

      <OperationToastWatcher
        opId={opId}
        title={`Создаётся ${spec.singular.toLowerCase()}`}
        onDone={(success) => {
          setOpId(null);
          invalidate(spec.id, filterValue ?? null);
          if (success) navigate(backHref);
        }}
      />
    </>
  );

  // Suppress unused warning for getByPath import (used by other places only).
  void getByPath;
}
