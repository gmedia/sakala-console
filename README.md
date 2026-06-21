# Sakala Console

Frontend dashboard standalone untuk Sakala, project deployment open-source yang membantu project bergerak dari repository Git menuju URL publik tanpa memulai dari konfigurasi server manual.

Console berjalan di `app.sakala.dev` dan berkomunikasi dengan Laravel control plane di `sakala-api`. Repository ini tidak menyimpan business logic deployment dan tidak memiliki backend SvelteKit sendiri.

## Stack

- SvelteKit dan Svelte 5 runes
- TypeScript
- Tailwind CSS v4
- adapter-static dalam SPA mode
- TanStack Svelte Query untuk server state
- Zod untuk validasi boundary terpilih
- Vitest dan Playwright
- pnpm

## Requirements

- Node.js 22.12 atau lebih baru
- pnpm 10.31
- `sakala-api` untuk integrasi HTTP
- Chromium Playwright untuk component/E2E test

## Quickstart

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Console tersedia di `http://app.sakala.localhost:5173` jika host lokal tersebut diarahkan ke loopback. API default berada di `http://api.sakala.localhost:8000`.

## Commands

```bash
pnpm dev             # development server
pnpm build           # static SPA build
pnpm check           # Svelte dan TypeScript diagnostics
pnpm lint            # ESLint
pnpm format:check    # Prettier check
pnpm test            # unit dan component test
pnpm test:e2e        # browser flow test
pnpm api:types       # generate types dari Scramble OpenAPI
pnpm quality         # local quality gate
```

Pasang browser test sekali pada mesin baru:

```bash
pnpm exec playwright install chromium
```

## Architecture

- `src/routes`: komposisi halaman dan route groups.
- `src/lib/api`: HTTP, CSRF, error, query, dan generated API contract.
- `src/lib/features`: UI dan query/mutation per domain ketika fitur mulai dibuat.
- `src/lib/components/ui`: primitive reusable.
- `src/lib/components/layout`: shell dan navigation.
- `src/lib/stores`: UI state lokal, bukan cache response API.

Laravel API Resource dan Scramble OpenAPI adalah source of truth kontrak HTTP. Jalankan `pnpm api:types` ketika endpoint berubah; jangan menulis ulang seluruh kontrak sebagai interface manual.

Lihat [ARCHITECTURE.md](ARCHITECTURE.md), [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md), dan [docs/API_CLIENT.md](docs/API_CLIENT.md).

## Project Status

Foundation console sudah tersedia. GitHub auth, onboarding, project CRUD, deployment, dan realtime akan ditambahkan bertahap setelah kontrak API masing-masing tersedia.

Sakala diinisiasi oleh maintainer Sakala dan didukung GMEDIA sebagai founding sponsor dan infrastructure supporter. Sakala dilisensikan dengan Apache License 2.0.
