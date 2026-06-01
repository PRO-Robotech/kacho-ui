# kacho-ui — CLAUDE.md

UI-специфичный CLAUDE.md, дополняющий общий workspace-`CLAUDE.md` (корень
`kacho-workspace/`, подцепляется через parent-walkup discovery). Обязательный
контекст при работе из `project/kacho-ui/` и любых его подпапок.

## 1. Что это

Vite + React + TypeScript SPA для control plane Kachō. Дизайн повторяет
консоль Yandex Cloud (dark, плотный, YC-style). UI ходит в `kacho-api-gateway`
по REST (через nginx-proxy в production, port-forward на 18080 локально).
Никаких отдельных backend-вызовов мимо api-gateway — только публичные REST RPC.

Стек:
- React 18 + TypeScript + Vite 6.
- AntD 5 + Tailwind (тонкая утилитарная прослойка для верстки).
- React Router v6.
- @tanstack/react-query (polling, кэш, инвалидация).
- lucide-react (иконки в нав/таблицах; модалки — AntD Outlined-иконки).

## 2. Архитектура

```
src/
├─ App.tsx                    ConfigProvider AntD + роутер
├─ pages/                     ResourceListPage, ResourceDetailPage, *DetailPage кастомные
├─ components/
│  ├─ Layout.tsx              + <GlobalResourceFormModal/> единственный mount-point
│  ├─ ResourceFormModal.tsx   диспетчер Create/Edit по spec.id из `?modal=…`
│  ├─ GlobalResourceFormModal.tsx  определяет containerId из URL → ResourceFormModal
│  ├─ InlineResourceCreateForm / InlineResourceEditForm — generic AntD-Form
│  ├─ InlineSubnetCreateForm / InlineSubnetEditForm    — кастом для Subnet
│  ├─ InlineSecurityGroupEditForm                      — кастом для SG (split-endpoint)
│  ├─ InlineAddressPoolCreateForm / EditForm           — кастом для AddressPool
│  ├─ InlineNetworkInterfaceCreateForm / EditForm      — кастом для NIC
│  ├─ LabelsEditor.tsx        единый controlled labels-editor (entries-based)
│  ├─ SubnetCidrChips.tsx     CIDR chip-list для Subnet Create (controlled)
│  ├─ SubnetCidrManager.tsx   CIDR chip-list для Subnet Edit (через RPC :add/:remove)
│  ├─ ResourceRefChips.tsx    chip-list для NIC address/SG селекторов
│  └─ form/
│     ├─ FormField.tsx        FormFieldRenderer + ArrayFieldRenderer + ArrayItemField
│     ├─ LabelsEditor.tsx     wrapper над общим LabelsEditor для FormFieldRenderer
│     ├─ SgRulesEditor.tsx    AntD Collapse + Card+Tag CIDR — компактный SG rules
│     ├─ RefSelect.tsx        dropdown ресурса (name + extra-info)
│     ├─ ResourceIcon.tsx     AntD Outlined-иконки ресурсов (sync с сайдбаром)
│     ├─ ResourceFormBody.tsx единый рендер тела Create/Edit формы (modal+page)
│     ├─ FormShell.tsx        заголовок (level=4 + ResourceIcon + verb) + контейнер
│     ├─ FormSection.tsx      группа полей с заголовком + divider, опц. collapsible
│     ├─ FieldLabel.tsx       label + опц. info-tooltip (QuestionCircleOutlined)
│     ├─ FormFooter.tsx       primary DopplerButton + Отменить, pending-guard
│     └─ ImmutableField.tsx   read-only значение + 🔒 + reason-tooltip
└─ lib/
   ├─ resource-registry.tsx   ИСТОЧНИК ИСТИНЫ: spec, fields, columns, template, sanitize, hydrate
   ├─ form-schema.ts          типы FormField, ArrayField, ResourceSpec, …
   ├─ service-modules.tsx     сайдбар-нав (AntD Outlined-иконки) + дашборд-плашки
   └─ path.ts                 getByPath / setByPath / deleteByPath для путевой адресации
```

## 3. Modal-flow Create/Edit (обязательно)

**VPC** Create/Edit — модалки (`?modal=<spec.id>-create|edit`). **Compute / NLB / System /
project-edit** используют full-page формы, но и модалка, и страница рендерят **единый
`ResourceFormBody`** (`src/components/form/ResourceFormBody.tsx`) → визуальный паритет
create==edit==modal==page. Запрет на новые `/<route>/create` остаётся **для VPC**; не-VPC
page-формы допустимы, но обязаны рендерить `ResourceFormBody`.

Никаких inline-форм вместо «Общее»-блока на detail-странице.

### 3.1 Открытие

Через query-параметр URL:
- `?modal=<spec.id>-create[&<parent>Id=<id>]` — создание.
- `?modal=<spec.id>-edit&id=<uid>` — редактирование.

Где `<spec.id>` — это **plural** ключ из `REGISTRY` (`subnets`, `networks`,
`security-groups`, `route-tables`, `addresses`, `gateways`, `address-pools`,
`network-interfaces`, …). Не singular — `subnet-create` НЕ сработает.

`<parent>Id` пробрасывается как preset (через FormFieldRenderer.lockedPathsRef
+ snake_case-преобразование `networkId → network_id`). См.
`ResourceFormModal.tsx` — там же кастом-ветки для ресурсов со своими
inline-формами.

Из detail-страницы родителя кнопка «Создать `<child>`» делает `setSearchParams`
с этими параметрами; модалка появляется поверх текущей страницы; URL остаётся
parent — закрытие модалки не меняет nav-state.

### 3.2 Global mount

`<GlobalResourceFormModal/>` mountится один раз в `Layout.tsx`. Любая страница,
которая использует Layout, автоматически получает Create/Edit-модалки — НЕ
дублировать `<ResourceFormModal/>` на каждой странице (раньше так было —
ушло в legacy).

### 3.3 Стиль модалки (нормативно)

`ResourceFormModal.tsx`:
- `width: 860` — единый размер для всех Create/Edit-модалок.
- `maskClosable: true` — клик по маске снаружи закрывает модалку.
- `destroyOnClose: true` — каждое открытие монтирует форму заново (форма не
  держит state между открытиями).
- `body padding: 12 / paddingTop: 16` — компактные отступы.
- `title: null` — Modal-title скрыт; inline-форма сама рендерит `<Title level={4}>`
  с иконкой ресурса (см. §4.1).
- Анимация — стандартная AntD zoom from center (без `transform-origin` overrides).

### 3.4 Page-jump fix

`index.css`:
- `html { scrollbar-gutter: stable; }` — резервируем место под scrollbar даже
  когда его нет.
- `body.ant-modal-open { padding-right: 0 !important; overflow: auto !important; }` —
  AntD по умолчанию добавляет `padding-right` при открытии модалки, что создаёт
  визуальный jump (контент смещается). Перезаписываем.

### 3.5 Error handling в мутирующих формах

Ошибка от mutation **не закрывает форму** — только `toast.error(...)`.
`onCancel` / `onSuccess` вызываются только при успехе (sync-create без
Operation envelope) или после `op.done && !op.error` (Doppler polling).
Это сохраняет введённые данные и даёт user'у поправить ошибку (типичный
кейс: CIDR overlap, UNIQUE-violation на name).

## 4. Form layout (нормативно)

YC-style горизонтальный layout. Все формы — generic `InlineResourceCreateForm` /
`InlineResourceEditForm` и кастомные (Subnet/SG/NIC/AddressPool/…) — обязаны:

### 4.1 Заголовок

```tsx
<Typography.Title
  level={4}
  style={{ margin: "0 0 16px", display: "flex", alignItems: "center", gap: 10 }}
>
  <ResourceIcon specId={spec.id} />
  {action === "create" ? "Создание" : "Редактирование"}: {spec.singular}
</Typography.Title>
```

- Иконка ресурса (`<ResourceIcon specId>`) слева.
- Текст: `Создание: <Singular>` / `Редактирование: <Singular>` (двоеточие, не
  «Создать <singular>», не «Создание <singular в lowercase>»).
- Иконки в `src/components/form/ResourceIcon.tsx` — **AntD Outlined-семейство**,
  mapping синхронизирован с навигацией в `src/lib/service-modules.tsx`. При
  добавлении нового ресурса в сайдбар-нав — параллельно добавить запись в
  `ResourceIcon.ICONS`, с **той же** иконкой.

### 4.2 AntD Form

```tsx
<Form
  layout="horizontal"
  labelCol={{ flex: "200px" }}
  wrapperCol={{ flex: "auto" }}
  labelAlign="left"
  colon={false}
  size="middle"
>
  ...
</Form>
```

- **labelCol 200px** — единая ширина «лево-label / право-input» для всех модалок.
  Не 140px (NIC форма раньше была 140, «Группы безопасности» наползала на
  селектор — исправлено).
- **`colon={false}`** — без двоеточий после label (YC-style).

### 4.3 Required ⭐ справа

`App.tsx` ConfigProvider:
```tsx
form={{
  requiredMark: (label, info) => (
    <>{label}{info.required && <span style={{ color: "#ff4d4f", marginLeft: 4 }}>*</span>}</>
  ),
}}
```

Звёздочка — **справа** от label, не слева (AntD default). Для inline-форм
просто передавай `required={!!field.required}` в `<Form.Item>` — звёздочка
автоматически.

### 4.4 Info ⓘ-tooltip справа от label

Когда у поля есть `field.description` — рядом с label рисуется
`<QuestionCircleOutlined />` с tooltip'ом. Длинные пояснения, RFC-формулировки,
optional-семантика — **всё в info, не в самом label**.

```tsx
<Form.Item
  label={
    field.description ? (
      <Space size={4}>
        {field.label}
        <Tooltip title={field.description}>
          <QuestionCircleOutlined style={{ color: "rgba(255,255,255,0.45)" }} />
        </Tooltip>
      </Space>
    ) : (
      field.label
    )
  }
  required={!!field.required}
>
  ...
</Form.Item>
```

**Никаких скобочных пояснений в labels.** Запрещены формулировки вроде
`"Address (External IPv4, необязательно)"`, `"Zone (External IPv4)"`,
`"IPv4-адрес (Address-ресурс)"`. Только: `"Адрес"` + info-tooltip с пояснением.

### 4.5 Hidden / visibleWhen фильтрация

В `InlineResourceCreateForm` / `InlineResourceEditForm` поля **фильтруются**
до оборачивания в `<Form.Item>`. Иначе `hidden: true` поле (например
`folder_id`) оставляет пустой Form.Item с label «Folder» — `FormFieldRenderer`
возвращает null уже изнутри.

```tsx
fields.filter((f) => {
  if (lockedPaths.has(f.name)) return false;
  if (f.hidden) return false;
  if (f.visibleWhen) {
    const cur = getByPath(obj, f.visibleWhen.field);
    if (!matches(cur, f.visibleWhen.equals)) return false;
  }
  return true;
});
```

### 4.6 Палитра (нормативно)

Все цвета согласованы между AntD `ConfigProvider` (`App.tsx`) и CSS-vars
`index.css`:
- Фон страницы / `colorBgBase`: `#1c1d22`.
- Фон контейнера / Modal-body / `colorBgContainer`: `#26272d` (но Modal по
  факту чуть светлее — `colorBgElevated: #2d2e35`).
- Border / `colorBorder`: `#383941`.
- Inputs / Select dropdown — `#1c1d22` (один цвет со страницей, чтобы они
  «утопали» в форме). Это требование user'а («у селекторов внутренний цвет
  rgb(28, 29, 33) у фона модалки rgb(52, 54, 61)»).
- Primary: `#3D8DF5` (YC-blue).
- Tag colors: IPv4 → `"blue"`, IPv6 → `"geekblue"`, INGRESS → `"green"`,
  EGRESS → `"blue"` (см. SgRulesEditor).

## 5. Labels-editor (единый)

`src/components/LabelsEditor.tsx` — единый controlled entries-based editor
`<LabelsEditor value={LabelEntry[]} onChange={...}/>`. Используется во всех
кастом-формах (Subnet/NIC/AddressPool/SG).

`src/components/form/LabelsEditor.tsx` — wrapper для FormFieldRenderer:
адаптирует obj-storage (`Record<string,string>`) ↔ entries (`LabelEntry[]`).
**Sync с parent obj — через signature-ref:** запоминаем sig нашего obj
после `update`, и не сбрасываем local rows на тот же sig обратно. Раньше
был feedback-loop: entries=[{"":""}] → obj={} (пустой ключ отбрасывается) →
useEffect видит «obj не изменился» → setRows([]) → первый клик «Добавить
метку» терял row. С sigRef-guard'ом первая попытка работает.

`<Form.Item label="Метки">` рендерит **сам label** слева 200px;
`LabelsEditorBase` — справа в wrapper-col. Не оставлять label="" во встроенной
обёртке — он не дублируется.

## 6. Array-fields (Static Routes, NIC v4/v6 address pickers)

`ArrayFieldRenderer` (`src/components/form/FormField.tsx`) рендерит AntD
`<Card size="small">` с inline-grid из item-полей:

- Card-title: жирное `field.label` + счётчик `N/maxItems` + кнопка «Добавить».
- Каждый item — flex-row: grid из `itemFields` + `<DeleteOutlined danger>` в углу.
- Каждое поле item — **через `<ArrayItemField>`**: mini-label сверху (11px серый),
  `*` справа для required, `<QuestionCircleOutlined>` info-tooltip если есть
  description. FormFieldRenderer рендерится с `hideLabel=true`.
- `visibleWhen` для array-item полей резолвится относительно `pathPrefix` —
  для дискриминатора oneof внутри array-item (см. §7).

Никаких stacked Tailwind-карточек с многострочным label-блоком — это
«убогий» layout (user-feedback).

## 7. visibleWhen для array-items

`FormFieldRenderer` сначала пытается резолвить `visibleWhen.field` относительно
`pathPrefix`, fallback на top-level:
```ts
const relPath = pathPrefix ? `${pathPrefix}.${rel}` : rel;
const cur = getByPath(value, relPath) ?? getByPath(value, rel);
```

Это позволяет дискриминатору `_kind` внутри `static_routes[i]` управлять
видимостью соседних полей в том же item-е.

## 8. SgRulesEditor

`src/components/form/SgRulesEditor.tsx` — компактный AntD Collapse:
- Каждое правило свёрнуто в одну summary-строку:
  `[DIRECTION-Tag] proto · ports · target`.
- Expand на клик → форма редактирования (RuleBody).
- При «Добавить правило» новое правило открывается автоматически.
- CIDR-блоки внутри правила — chip-list (AntD Tag) с Add-input в стиле
  SubnetCidrChips. Не stacked Input+Trash строки.
- Один шаблон сетки: `1fr 2fr` (label-узкий / value-широкий).

## 9. CIDR-виджеты

`SubnetCidrChips` (controlled, для Create) и `SubnetCidrManager` (RPC-driven,
для Edit) — **визуально идентичны**: AntD `<Card>` с заголовком «IPv4/IPv6
CIDR blocks N блок(ов)», список `<Tag>` (closable, color=`blue`/`geekblue`,
monospace), `<Space.Compact>` с input + кнопка «Add». Edit-вариант показывает
spinner на Tag во время `:add-cidr-blocks` / `:remove-cidr-blocks` RPC.

Не делать Tailwind-only viewport-bound chip-list — должно быть AntD-консистентно
(user-feedback «выглядит убого»).

## 10. RefSelect — extra-info в опциях

`src/components/form/RefSelect.tsx` показывает не только имя:
```
<name или uid> · <extra>
```

`extra` зависит от ресурса (`extraInfoFor` в том же файле):
- `subnets` → CIDR-блоки (v4 + v6 join).
- `addresses` → external IPv4 / internal IPv4 / external IPv6 / internal IPv6.
- `networks` → ipv4_cidr_blocks join.
- `address-pools` → CIDR + `default` если default-пул.
- `zones` → region_id.
- `gateways` → `shared-egress` (тип).
- `route-tables` / `security-groups` → `net:<8-char>` (первые 8 символов network_id).

Если у ресурса `name` пустой — head становится `uid` (fallback). Это критично
для «безымянных» ресурсов (admin AddressPool без name, например).

## 11. Resource registry (`src/lib/resource-registry.tsx`)

Источник истины: каждый ресурс — `ResourceSpec` с полями:
- `id` (plural-ключ, `"subnets"`), `route`, `apiPath`, `payloadKey`, `singular`, `plural`.
- `columns` — для ResourceListPage / table.
- `fields` — для generic form (FormField[]); кастом-формы spec.fields могут
  не использовать, но всё равно следуют тому же контракту.
- `template(ctx)` — initial obj для Create.
- `hydrate(data)` — wire-shape → form-shape для Edit (например `vpc/static_routes`
  oneof; или `nic/v4_address_ids` array<string> → array<{value:string}>).
- `sanitize(obj)` — form-shape → wire-shape перед POST/PATCH (выкидывает UI-
  discriminators типа `_address_kind`, неактивные oneof-ветки, и т.п.).

### Глобальные FormField-константы

В верхней части файла:
- `FIELD_NAME` (strict regex — Cloud/Folder/Organization).
- `FIELD_NAME_VPC` (permissive — VPC-ресурсы).
- `FIELD_NAME_COMPUTE` (lowercase-only — Compute).
- `FIELD_DESCRIPTION`, `FIELD_LABELS`, `FIELD_FOLDER_ID` (hidden).

Все labels — **русские** (Имя, Описание). Description'ы — нормальные продакш-
формулировки, не разработческие («Lowercase, цифры, дефисы»…).

## 12. Backend-quirks (важные для UI)

### 12.1 Gateway.Create

`CreateGatewayRequest` proto имеет oneof `gateway_type` с единственным
вариантом `shared_egress_gateway_spec`. UI шлёт `template: { ... shared_egress_gateway_spec: {} }`.
**Не путать с `shared_egress_gateway`** — это поле в response-сообщении
`Gateway` (после Create). Backend (`kacho-vpc/internal/service/gateway.go:91`)
валидирует oneof — пустой gw_type → `InvalidArgument "Illegal argument gateway"`.

### 12.2 RouteTable.static_routes — только next_hop_address

Proto `StaticRoute.next_hop` — oneof `next_hop_address | gateway_id`. **Backend
поддерживает только `next_hop_address`**: `domain.StaticRoute` хранит только
`NextHopAddress`, handler требует его обязательно. UI не отправляет
`gateway_id`. Когда backend начнёт поддерживать (issue
[kacho-vpc#55](https://github.com/PRO-Robotech/kacho-vpc/issues/55)) — вернём
тоглер IP/Gateway в форму static-route item.

### 12.3 Async-mutations (Operation envelope)

Все мутирующие RPC (`Create/Update/Delete/Move/AddCidrBlocks/...`) возвращают
`Operation` (long-running). Pattern в формах:
1. `api.create()/api.update()` → `extractOperationId(resp)`.
2. Если operation id → `setPendingOpId(id)` → `useOperation(id)` polling до `done=true`.
3. На `op.done && !op.error` — toast success, invalidate, onSuccess, onCancel.
4. На `op.done && op.error` — toast error, **не закрывать форму** (см. §3.5).

### 12.4 Edit-вариант flow

`InlineResourceEditForm` строит `update_mask` через `computeUpdateMask(original, parsed, fields)`
(diff field-by-field) — снимает mask только с реально изменившихся mutable
полей. Это важно для backend: hard-immutable поля в mask → `InvalidArgument`,
silent-ignore в теле без mask — OK.

## 13. Сценарии «детальная страница → создать дочерний»

Все child-create entry-points с детали родителя — через модалку:
- NetworkDetailPage → «Создать подсеть» / «Создать RT» / «Создать SG» →
  `?modal=<plural>-create&networkId=<n>`.
- SubnetDetailPage tab «IP-адреса» → «Зарезервировать IP» →
  `?modal=addresses-create&subnetId=<s>`. `ResourceFormModal` имеет кастом-ветку
  для `addresses+create` с этим контекстом (preset
  `internal_ipv4/v6_address_spec.subnet_id`, `fieldOptionsFilter`
  `_address_kind=[internal,internal_v6]`).
- RowActionsMenu «Создать подсеть» (на network row) → тот же query.

Никаких inline-форм вместо «Общее»-блока (раньше Edit делал это —
`ResourceDetailPage.editing` теперь константно `false`, edit идёт через `?modal=…-edit`).

## 14. Локальный workflow

```bash
# Установка
npm install

# Dev (Vite — но обычно мы тестируем на стенде, не локально)
npm run dev

# Production build (используется для docker-образа)
npm run build

# Type-check
npx tsc --noEmit
```

### Деплой на client-стенд (ttl.sh + kubectl)

```bash
TAG="kacho-$(date +%s)" && IMG="ttl.sh/${TAG}/kacho-ui:24h"
docker build -t "$IMG" -t kacho-ui:dev .
docker push "$IMG"
kubectl -n kacho set image deploy/ui ui="$IMG"
kubectl -n kacho rollout status deploy/ui --timeout=120s
```

`kacho-ui` deployment на client-cluster использует анонимный ttl.sh-registry
(24h TTL), так что каждый раз — новый TAG. На стенде nginx serv'ит SPA из
`dist/` + проксирует REST-paths (`/vpc/...`, `/compute/...`,
`/resource-manager/...`, `/operations/...`, `/organization-manager/...`) на
`api-gateway.kacho.svc.cluster.local:8080`. Конфиг — `deploy/nginx.conf`:
`Cache-Control: no-store` на `index.html`, `1y immutable` на hashed assets.

## 15. Запреты

1. **Для VPC — не вводить отдельный `/<route>/create` или `/<route>/<id>/edit` route.**
   Только `?modal=<spec>-create|edit` поверх current page. Не-VPC page-формы (Compute /
   NLB / System / project-edit) допустимы, но обязаны рендерить `ResourceFormBody`.
2. **Не дублировать `<ResourceFormModal/>` на каждой странице.** `<GlobalResourceFormModal/>`
   уже в Layout — он покрывает все маршруты.
3. **Не использовать vertical-only Tailwind label-input-stack.** Только AntD
   `<Form layout="horizontal" labelCol={...}>`. Visual unity всех модалок.
4. **Не писать скобочные пояснения в labels полей.** Уйдёт в info-tooltip.
5. **Не upgrade'ить shadcn `<Label>` / `<Input>` на AntD без необходимости** —
   в array-items они компактнее. Но **внутри `<Form.Item>`** — только AntD-
   инпуты.
6. **Не вводить лишний layout-`<div maxWidth=…>`** внутри Modal-body —
   `ResourceFormModal` уже ограничивает ширину через `width={860}`.
7. **Все мутации — async через Operation.** Никаких sync-create return ресурса
   — `api.create` отдаёт Operation envelope (verbatim YC).
8. **Не выкладывать на external TLS endpoint admin-ресурсы.** AddressPool /
   Region / Zone / Hypervisor — только cluster-internal listener (api-gateway
   internal mux), `/system/*` UI-paths. См. workspace-CLAUDE.md §«Запреты» #6.

## 16. Ссылки

- Workspace правила: `../../CLAUDE.md`
- Service-nav (иконки сайдбара, источник иконок модалок): `src/lib/service-modules.tsx`
- Resource registry: `src/lib/resource-registry.tsx`
- Modal-диспетчер: `src/components/ResourceFormModal.tsx`
- Глобальный mount: `src/components/GlobalResourceFormModal.tsx` (в `Layout.tsx`)
- Backend-quirks (Gateway/StaticRoute): `../kacho-vpc/internal/service/gateway.go`,
  `route_table_handler.go`, GitHub Issue [kacho-vpc#55](https://github.com/PRO-Robotech/kacho-vpc/issues/55).
