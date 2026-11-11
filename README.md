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
pnpm exec playwright install chromium   # sekali per mesin, untuk component dan E2E test
pnpm dev
```

Console tersedia di `http://app.sakala.localhost:5173` jika host lokal tersebut diarahkan ke loopback. API default berada di `http://api.sakala.localhost:8000`.

`.env` hanya berisi konfigurasi publik yang ikut masuk ke browser, jadi jangan menaruh secret di sana. Nilai dari `.env.example` langsung jalan untuk pengembangan lokal. Biarkan `PUBLIC_REVERB_KEY` kosong kalau belum menjalankan Reverb: console tetap jalan dengan polling. Build dan test membaca file ini juga, tetapi tidak butuh `sakala-api`, karena API-nya di-mock.

Rincian alur kerja ada di [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md), dan cara menjalankan test ada di [docs/TESTING.md](docs/TESTING.md).

## Container Image

`Dockerfile` membangun static SPA SvelteKit lalu menyajikannya melalui Caddy internal pada port `8080`.

`PUBLIC_API_URL`, `PUBLIC_APP_URL`, dan `PUBLIC_REVERB_*` adalah konfigurasi publik yang dibundel saat build, bukan secret runtime. Deployment mengirim seluruh set nilai untuk satu environment sebagai satu file env melalui BuildKit secret `frontend_env` (di-mount sebagai `.env.production`), plus hash file tersebut sebagai build arg `FRONTEND_ENV_SHA` supaya perubahan nilai selalu memicu build ulang. `PUBLIC_REVERB_KEY` adalah app key publik Reverb; app secret tidak pernah masuk ke file ini.

```bash
cp .env.example .env.docker.local   # isi nilai untuk environment target
docker build \
  --secret id=frontend_env,src=.env.docker.local \
  --build-arg FRONTEND_ENV_SHA="$(sha256sum .env.docker.local | awk '{print $1}')" \
  -t sakala-console:local .
docker run --rm -p 8080:8080 sakala-console:local
```

Image menyajikan `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, dan `Referrer-Policy`, dan menolak dibingkai situs lain lewat `frame-ancestors 'none'`. Policy-nya ditulis `docker/security-headers.mjs` saat build dari file env yang sama, jadi origin API dan Reverb milik instalasi self-hosted atau staging ikut tanpa konfigurasi kedua. Build gagal kalau `PUBLIC_API_URL` tidak ada.

### Konfigurasi saat container start

Image yang sudah jadi, termasuk yang terbit di `ghcr.io`, bisa diarahkan ke instalasi lain tanpa build ulang. Isi variabel yang sama sebagai environment container:

| Variabel               | Isi                                                                 | Contoh                    |
| ---------------------- | ------------------------------------------------------------------- | ------------------------- |
| `PUBLIC_API_URL`       | URL `sakala-api`, wajib `http://` atau `https://`                   | `https://api.example.com` |
| `PUBLIC_APP_URL`       | URL console ini, wajib `http://` atau `https://`                    | `https://app.example.com` |
| `PUBLIC_REVERB_HOST`   | host Reverb, huruf, angka, titik, dan tanda hubung saja             | `api.example.com`         |
| `PUBLIC_REVERB_PORT`   | port Reverb, 1 sampai 65535                                         | `443`                     |
| `PUBLIC_REVERB_SCHEME` | `http` atau `https`                                                 | `https`                   |
| `PUBLIC_REVERB_KEY`    | app key publik Reverb (`REVERB_APP_KEY`); kosong mematikan realtime | `isi-app-key-publik`      |

```bash
docker run --rm -p 8080:8080 \
  -e PUBLIC_API_URL=https://api.example.com \
  -e PUBLIC_APP_URL=https://app.example.com \
  -e PUBLIC_REVERB_HOST=api.example.com -e PUBLIC_REVERB_PORT=443 \
  -e PUBLIC_REVERB_SCHEME=https -e PUBLIC_REVERB_KEY=isi-app-key-publik \
  ghcr.io/gmedia/sakala-console:<versi>
```

Saat container start, `docker/entrypoint.sh` memeriksa setiap nilai, lalu menulis dua file: `/runtime-config.js`, yang dimuat `src/app.html` sebelum aplikasi jalan, dan `Content-Security-Policy` yang menyebut origin API dan Reverb yang baru. Nilai yang tidak valid menghentikan container dengan pesan yang menyebut variabelnya, jadi console yang tidak bisa menghubungi API-nya tidak pernah tersaji.

- Variabel yang tidak diisi memakai nilai saat build. Container yang tidak mengisi satu pun menyajikan file hasil build apa adanya, jadi deployment yang sudah ada tidak berubah.
- Mengisi variabel dengan nilai kosong tetap dihitung mengisi. `PUBLIC_REVERB_KEY=` mematikan realtime, dan console kembali ke polling.
- `/runtime-config.js` berasal dari origin yang sama dan dikirim dengan `Cache-Control: no-cache`, jadi CSP tetap `script-src 'self'` plus hash script inline SvelteKit, tanpa `unsafe-inline`. Nilai baru berlaku setelah container dibuat ulang.
- Dengan root filesystem read-only, pasang tmpfs di `/run/sakala-console`; entrypoint mengisinya setiap start.

`tests/container/runtime-config.sh` membuktikan perilaku ini terhadap image sungguhan: build, jalankan dengan beberapa set env, lalu periksa file config, CSP, dan penolakan nilai yang salah. Tambahkan `BROWSER=1` untuk membuka console di Chromium dan memastikan ia memanggil API yang dikonfigurasi. Skrip ini butuh Docker dan tidak dijalankan CI.

Domain, TLS, reverse proxy host, dan environment deployment dikelola oleh repository deployment terpisah. Image ini tidak menyimpan credential atau origin production.

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
