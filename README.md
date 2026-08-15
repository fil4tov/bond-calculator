# Bonds

Веб-приложение для расчёта доходности облигаций и ведения личного облигационного портфеля. В приложении можно рассчитывать параметры выпуска, сохранять облигации и операции покупки/продажи, отслеживать купоны и основные показатели портфеля.

Проект состоит из трёх частей:

- `frontend` — одностраничное React-приложение;
- `backend` — REST API, авторизация и бизнес-логика;
- `postgres` — база данных пользователей, облигаций и операций.

## Стек

**Frontend:** React 19, TypeScript, Vite, React Router, TanStack Query, React Hook Form, SCSS Modules, pnpm.

**Backend:** Python 3.13, FastAPI, SQLAlchemy, asyncpg, Pydantic, Alembic, uv.

**Инфраструктура:** PostgreSQL 17, Docker Compose, Nginx.

**Тестирование:** Vitest, Testing Library, Playwright, pytest.

## Запуск через Docker

Понадобится Docker с поддержкой Compose v2.

Создайте файл с настройками окружения и запустите весь стек:

```bash
cp .env.example .env
docker compose up --build -d
```

После запуска доступны:

- приложение — `http://127.0.0.1`;
- API — `http://127.0.0.1/api`;
- Swagger UI — `http://127.0.0.1:8000/docs`.

Проверить состояние контейнеров:

```bash
docker compose ps
```

Остановить приложение:

```bash
docker compose down
```

## Локальный запуск для разработки

Понадобятся Node.js 24+, pnpm 10+, Python 3.13+, uv и Docker. PostgreSQL запускается в Docker, а frontend и backend — локально с автоматической перезагрузкой при изменении кода.

Сначала запустите базу данных:

```bash
docker compose up -d postgres
```

В отдельном терминале запустите backend:

```bash
cd backend
uv sync --frozen
```

Для PowerShell:

```powershell
$env:DATABASE_URL = "postgresql+asyncpg://bonds:bonds_dev_password@127.0.0.1:5432/bonds"
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```

Для Bash:

```bash
export DATABASE_URL="postgresql+asyncpg://bonds:bonds_dev_password@127.0.0.1:5432/bonds"
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```

Ещё в одном терминале запустите frontend:

```bash
cd frontend
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

В dev-режиме доступны:

- приложение — `https://localhost:5173`;
- API — `http://127.0.0.1:8000/api`;
- Swagger UI — `http://127.0.0.1:8000/docs`.

Vite проксирует запросы `/api` на локальный backend. При первом запуске браузер может попросить подтвердить локальный HTTPS-сертификат.

Дополнительные параметры, включая порты и токен T-Invest API, перечислены в `.env.example`.
