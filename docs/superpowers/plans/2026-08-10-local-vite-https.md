# Local Vite HTTPS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `pnpm --dir frontend dev` serve the local frontend over trusted HTTPS with `vite-plugin-mkcert` while keeping preview, builds, and Playwright E2E on their current protocols.

**Architecture:** Vite will load `vite-plugin-mkcert` only when it is serving the ordinary development mode. The config callback will exclude build, preview, and a dedicated `e2e` mode; Playwright will explicitly select that mode so its existing HTTP URLs remain valid. The `/api` proxy continues to connect to FastAPI over HTTP.

**Tech Stack:** Vite 8, TypeScript 6, pnpm 10, `vite-plugin-mkcert`, Playwright

## Global Constraints

- HTTPS applies only to the ordinary local `pnpm --dir frontend dev` server.
- `pnpm --dir frontend build`, `pnpm --dir frontend preview`, and Playwright E2E retain their current behavior.
- Playwright E2E continues to use `http://127.0.0.1:4173`.
- The `/api` proxy target remains `http://127.0.0.1:8000` unless `VITE_API_PROXY_TARGET` overrides it.
- Certificates and private keys must not be committed to the repository.
- This is an approved configuration-file exception to automated TDD; verify both server modes by starting them and probing their URLs.

---

### Task 1: Configure trusted HTTPS for ordinary Vite development

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/pnpm-lock.yaml`
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/playwright.config.ts`

**Interfaces:**
- Consumes: Vite's `ConfigEnv` fields `command`, `isPreview`, and `mode`; Playwright's existing `webServer.command`.
- Produces: ordinary dev mode at `https://127.0.0.1:5173`; E2E mode at `http://127.0.0.1:4173`.

- [ ] **Step 1: Install the development dependency**

Run:

```bash
pnpm --dir frontend add --save-dev vite-plugin-mkcert
```

Expected: `vite-plugin-mkcert` is added to `frontend/package.json` and its resolved dependency graph is recorded in `frontend/pnpm-lock.yaml`.

- [ ] **Step 2: Confirm the current ordinary dev server is not HTTPS**

Run `pnpm --dir frontend dev --host 127.0.0.1` in one terminal, then probe it from another:

```bash
curl.exe -k --fail --silent --show-error https://127.0.0.1:5173/
```

Expected before the config change: FAIL because the current Vite server speaks HTTP on port 5173. Stop the server after the probe.

- [ ] **Step 3: Enable mkcert only for ordinary dev serving**

Change `frontend/vite.config.ts` to import the plugin and compute a narrow activation flag:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import mkcert from 'vite-plugin-mkcert';

export default defineConfig(({ command, isPreview, mode }) => {
  const useLocalHttps = command === 'serve' && !isPreview && mode !== 'e2e';

  return {
    plugins: [...(useLocalHttps ? [mkcert()] : []), react()],
    resolve: {
      alias: {
        '#app': fileURLToPath(new URL('./src/app', import.meta.url)),
        '#pages': fileURLToPath(new URL('./src/pages', import.meta.url)),
        '#widgets': fileURLToPath(new URL('./src/widgets', import.meta.url)),
        '#entities': fileURLToPath(new URL('./src/entities', import.meta.url)),
        '#shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
        '#assets': fileURLToPath(new URL('./src/assets', import.meta.url)),
      },
    },
    server: {
      proxy: {
        '/api': process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:8000',
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: true,
      exclude: ['node_modules/**', 'e2e/**'],
    },
  };
});
```

- [ ] **Step 4: Keep Playwright on the dedicated HTTP mode**

In `frontend/playwright.config.ts`, change only the server command:

```ts
webServer: {
  command: 'pnpm dev --mode e2e --host 127.0.0.1 --port 4173',
  url: 'http://127.0.0.1:4173',
  reuseExistingServer: false,
},
```

- [ ] **Step 5: Verify the ordinary dev server speaks HTTPS**

Run `pnpm --dir frontend dev --host 127.0.0.1` in one terminal. Allow mkcert to install its local CA if the operating system prompts, then run from another terminal:

```bash
curl.exe -k --fail --silent --show-error https://127.0.0.1:5173/
```

Expected: PASS and an HTML document containing Vite's application entry. Stop the server after the probe.

- [ ] **Step 6: Verify the E2E mode still speaks HTTP**

Run `pnpm --dir frontend dev --mode e2e --host 127.0.0.1 --port 4173` in one terminal, then probe it from another:

```bash
curl.exe --fail --silent --show-error http://127.0.0.1:4173/
```

Expected: PASS and an HTML document. Stop the server after the probe.

- [ ] **Step 7: Run focused static checks**

Run:

```bash
pnpm --dir frontend typecheck
pnpm --dir frontend lint
```

Expected: both commands exit 0 without warnings or errors.

- [ ] **Step 8: Commit the configuration change**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml frontend/vite.config.ts frontend/playwright.config.ts
git commit -m "feat: serve local Vite development over HTTPS"
```

### Task 2: Document HTTPS startup and verify the frontend

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the HTTPS dev behavior and unchanged HTTP backend/E2E behavior from Task 1.
- Produces: accurate local startup instructions for developers.

- [ ] **Step 1: Update local startup documentation**

In the README startup section, change the frontend URL from
`http://127.0.0.1:5173` to `https://127.0.0.1:5173`. Add this sentence immediately
after the URL paragraph:

```text
При первом запуске `pnpm --dir frontend dev` плагин mkcert может запросить разрешение на установку локального доверенного центра сертификации. Сертификаты создаются локально и не добавляются в репозиторий.
```

Keep the API and Swagger URLs on HTTP. Keep the existing note about setting
`COOKIE_SECURE=true` for HTTPS.

- [ ] **Step 2: Run the frontend verification suite**

Run:

```bash
pnpm --dir frontend lint
pnpm --dir frontend typecheck
pnpm --dir frontend test
pnpm --dir frontend test:e2e
pnpm --dir frontend build
```

Expected: all five commands exit 0. Playwright's server log and configured URL remain
HTTP on port 4173; the build completes without trying to install or invoke mkcert.

- [ ] **Step 3: Confirm no certificate artifacts are tracked**

Run:

```bash
git status --short
```

Expected: no generated certificate, key, CA, or mkcert binary appears under the
repository. Only the intended README change and any pre-existing unrelated user changes
remain uncommitted.

- [ ] **Step 4: Commit the documentation change**

```bash
git add README.md
git commit -m "docs: explain local HTTPS startup"
```
