# GitHub Actions workflows — kacho-ui

## docker-build.yml — DockerHub multi-arch image build (KAC-127)

Собирает Docker-образ `kacho-ui` под `linux/amd64` + `linux/arm64` и
публикует multi-arch manifest в DockerHub. Дополняет `ci.yaml` (type-check + build),
не заменяет его.

### Триггеры

- push в `main`
- push в `KAC-*` (epic / feature ветки)
- push тегов `v[0-9]+.[0-9]+.[0-9]+` и `...rc[0-9]+`

### Образы и теги

| Образ | Теги |
|---|---|
| `<DOCKERHUB_USERNAME>/kacho-ui` | `<branch>-<sha8>` (multiarch), `amd64-<branch>-<sha8>`, `arm64-<branch>-<sha8>` |

`kacho-ui` — nginx-образ: serves SPA + reverse-proxy на api-gateway.

### Требуемые GitHub secrets

| Secret | Назначение |
|---|---|
| `DOCKERHUB_USERNAME` | Docker Hub username (он же namespace для образов) |
| `DOCKERHUB_TOKEN` | Docker Hub access token (scope: Read/Write/Delete) |

Креды одинаковые для всех `kacho-*` репозиториев (один Docker Hub-аккаунт).

### Установка secrets (user-action)

```bash
gh secret set DOCKERHUB_USERNAME --body "<value>" --repo PRO-Robotech/kacho-ui
gh secret set DOCKERHUB_TOKEN    --body "<value>" --repo PRO-Robotech/kacho-ui
```

### Build context

`kacho-ui` — self-contained: `Dockerfile` копирует только собственные файлы репо.
Build context = `.`, sibling-чекаут не нужен.

### arm64 runner (GitHub-hosted)

Job `docker-build-arm64` гоняется на GitHub-hosted native ARM64-раннере
`runs-on: ubuntu-24.04-arm` (KAC-127). Раньше использовался `self-hosted`
раннер — при offline/busy он вешал job в `pending` бесконечно и `build arm64`
check никогда не зеленел. Hosted ARM64-раннер native — QEMU-эмуляция для
`linux/arm64` не нужна (шаг `Enable QEMU emulation` в arm64-job убран).
