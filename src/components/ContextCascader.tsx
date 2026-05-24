// ContextCascader — композитный Account → Project селектор в шапке.
//
// KAC-127: заменил pill-based BreadcrumbSelector на AntD <Cascader> с двумя
// уровнями: Account → Project. Accounts грузятся сразу, projects — лениво
// per-account через Cascader loadData.
//
// Выбор project-листа → contextApi.setProject(...) + navigate /projects/<id>/dashboard.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Cascader } from "antd";
import type { DefaultOptionType } from "antd/es/cascader";
import { iamApi } from "@/api/iam";
import { contextApi, useContext } from "@/lib/context-store";

interface CascaderOption extends DefaultOptionType {
  value: string;
  label: string;
  isLeaf: boolean;
  accountName?: string;
  children?: CascaderOption[];
  loading?: boolean;
}

export function ContextCascader() {
  const account = useContext((s) => s.account);
  const project = useContext((s) => s.project);
  const navigate = useNavigate();

  const [options, setOptions] = useState<CascaderOption[]>([]);

  // Загрузка списка accounts (верхний уровень) — один раз при mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await iamApi.listAccounts({ pageSize: "1000" });
        if (cancelled) return;
        setOptions(
          (r.accounts ?? []).map((a) => ({
            value: a.id,
            label: a.name || a.id,
            accountName: a.name || a.id,
            isLeaf: false,
          })),
        );
      } catch {
        // ignore — селектор просто останется пустым
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Ленивая загрузка projects для раскрытого account.
  const loadData = (selectedOptions: DefaultOptionType[]) => {
    const target = selectedOptions[selectedOptions.length - 1] as CascaderOption;
    target.loading = true;
    void (async () => {
      try {
        const r = await iamApi.listProjects({
          account_id: target.value,
          pageSize: "1000",
        });
        target.children = (r.projects ?? []).map((p) => ({
          value: p.id,
          label: p.name || p.id,
          isLeaf: true,
        }));
      } catch {
        target.children = [];
      } finally {
        target.loading = false;
        // Триггерим ре-рендер новой ссылкой на массив.
        setOptions((prev) => [...prev]);
      }
    })();
  };

  const onChange = (value: unknown, selectedOptions?: DefaultOptionType[]) => {
    const path = (value as string[]) ?? [];
    if (path.length === 2 && selectedOptions && selectedOptions.length === 2) {
      const accountId = path[0];
      const projectId = path[1];
      const projectName = String(selectedOptions[1].label ?? projectId);
      contextApi.setProject({ id: projectId, name: projectName, accountId });
      navigate(`/projects/${projectId}/dashboard`);
    } else if (path.length === 1 && selectedOptions && selectedOptions.length === 1) {
      // Выбран только Account — задаём account-context, project сбрасывается.
      const opt = selectedOptions[0] as CascaderOption;
      contextApi.setAccount({ id: path[0], name: String(opt.label ?? path[0]) });
    }
  };

  // Текущее значение Cascader — [accountId, projectId] либо [accountId].
  const currentValue = useMemo<string[] | undefined>(() => {
    if (project && account) return [account.id, project.id];
    if (account) return [account.id];
    return undefined;
  }, [account, project]);

  return (
    <Cascader
      options={options}
      loadData={loadData}
      value={currentValue}
      onChange={onChange}
      changeOnSelect
      placeholder="Account / Project"
      style={{ minWidth: 280 }}
      size="small"
      showSearch={{
        filter: (input, path) =>
          path.some((o) =>
            String(o.label ?? "").toLowerCase().includes(input.toLowerCase()),
          ),
      }}
      displayRender={(labels) => labels.join(" / ")}
      notFoundContent="Аккаунтов нет"
    />
  );
}
