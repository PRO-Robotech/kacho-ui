# Перенос kacho-ui в Figma

Артефакты и инструкции для воспроизведения дизайна kacho-ui в Figma.
Три независимых направления: **токены**, **редактируемые экраны**, **скриншоты-референс**.

> Важно про направление данных. Подключённый MCP `figma-developer-mcp` —
> **только чтение** Figma (Figma → код). Запись на холст (код → Figma) через REST
> API Figma невозможна — только через плагины внутри самой Figma. Поэтому перенос
> идёт инструментами Figma (Tokens Studio, html.to.design), а не через MCP.

---

## 1. Design tokens → Figma Variables/Styles

Файл: [`kacho-tokens.json`](./kacho-tokens.json) — формат **Tokens Studio**.

Содержит:
- `global` — бренд-цвета, radius-шкала, шрифт/веса/размеры, composite-типографика
  (pageTitle / section / h3 / body / label);
- `dark`, `light` — семантика по темам: фоны (page/container/elevated), текст,
  бордеры, primary/secondary/destructive, тона статусов (ok/info/warn/error/
  violet/muted), тени sm/md/lg.

Источники значений: `src/index.css` (CSS-vars обеих тем), `src/lib/theme.ts`
(AntD-токены), `src/typography.css`.

### Импорт
1. В Figma поставь плагин **Tokens Studio for Figma** (бесплатный).
2. Plugins → Tokens Studio → шестерёнка → **Import** → выбери `kacho-tokens.json`
   (или вкладка *Tools → Load from file/JSON*).
3. В плагине появятся наборы `global / dark / light` и темы **Dark/Light**
   (раздел *Themes*).
4. Нажми **Create styles** (или *Export → Styles/Variables*) — токены станут
   нативными Figma Variables + Color/Text/Effect styles, с переключением Dark/Light
   через Variable modes.

---

## 2. Редактируемые экраны → html.to.design

Лучший путь для авторизованных экранов (Dashboard, IAM, System, VPC/Compute/NLB).
**Бэкенд-стенд для этого не нужен** — плагин импортит из твоего залогиненного
браузера и отдаёт редактируемые Figma-слои.

1. Залогинься в живую консоль kacho в браузере (там, где у тебя есть сессия).
2. Figma (web, работает на Linux) → community-плагин **html.to.design** +
   их браузерное расширение *“html.to.design — import current tab”*.
3. Открой нужный экран консоли → расширением «захвати» вкладку → импорт во Figma.
4. Повтори для каждого экрана. Плагин подтянет шрифты, цвета, layout как слои.

Фиделити ~80–90%: AntD Table / Modal / Select после импорта обычно требуют
ручной чистки (auto-layout, объединение в компоненты). Бренд-стиль сверяй с
токенами из п.1.

Список экранов для обхода (из `src/App.tsx`):
- `/dashboard`
- IAM: `/iam/accounts`, `/iam/projects`, `/iam/service-accounts`, `/iam/users`,
  `/iam/groups`, `/iam/roles`, `/iam/access-bindings`, `/iam/access`
- System: `/system/regions`, `/system/zones`, `/system/address-pools`,
  `/system/search`, `/system/cluster/admins`
- Ресурсные list/detail/create по проекту:
  `/projects/:projectId/{vpc,compute,nlb}/<resource>[/:uid[/edit]]`

---

## 3. Скриншоты-референс (Playwright)

Скрипт: [`capture.mjs`](./capture.mjs) → PNG @2x в `shots/`.

Уже снято (рендерятся без бэкенда):
- `shots/auth-signup.{dark,light}.png` — экран входа/регистрации Kachō Console.

Остальные auth-флоу (`/auth/login`, `/registration`, `/recovery`, `/settings`)
рендерятся пусто — они инициализируют Kratos-флоу (`:4433`). Авторизованные
экраны гейтит `RequireAuth` → редирект на Kratos.

### Снять полный набор (когда поднят стенд kacho)
1. Подними стенд: api-gateway (`:8080`), Kratos (`:4433`), Hydra (`:4444`)
   — port-forward'ы; залогинься, чтобы получить сессию.
2. `npm run dev` (vite на `:5173`, прокси на бэкенд берётся из `KACHO_API_BASE`
   и т.д. — см. `vite.config.ts`).
3. Допиши в `capture.mjs` массив `ROUTES` авторизованными путями (список в п.2),
   прокинь cookie сессии в `browser.newContext({ storageState })` либо логинься
   программно в начале скрипта.
4. `node design/figma/capture.mjs` → PNG в `shots/`.
5. В Figma перетащи PNG на холст (или плагин *“Figma to … / drag-drop images”*).
   Это растровый референс, не редактируемые слои.
