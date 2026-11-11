# AGENTS.md

Panduan ini berlaku untuk AI agent dan Codex yang bekerja di `sakala-console`.

## Product Boundary

- Repository ini adalah frontend dashboard standalone, bukan backend kedua.
- Business logic, authorization, persistence, deployment orchestration, dan token handling milik `sakala-api` atau `sakala-agent`.
- Jangan menambahkan SvelteKit server route/action untuk fitur produk inti.
- Console tidak boleh mengakses Docker socket atau runtime host.
- Jangan hardcode secret, token, credential, API URL, atau production origin.

## Svelte Architecture

- Gunakan Svelte 5 runes untuk state baru.
- `src/routes` hanya menyusun page/layout dan redirect ringan.
- Domain UI, query, dan mutation berada di `src/lib/features/<domain>`.
- Server state menggunakan TanStack Query; `$state` atau store hanya untuk UI state lokal.
- HTTP hanya melalui `src/lib/api`; jangan memakai `fetch` tersebar di component.
- API Resource dan Scramble OpenAPI `sakala-api` adalah source of truth kontrak.
- Jangan menduplikasi type yang sama di `api`, `features`, dan `types`.
- Gunakan `$env/static/public` untuk environment variable yang boleh masuk browser. Nilai `PUBLIC_*` yang boleh diganti saat container start dibaca lewat `withRuntimeConfig` di `src/lib/config/runtime.ts`; variabel publik baru yang perlu bisa diganti harus ditambahkan di sana, di `docker/entrypoint.sh`, dan di `PUBLIC_KEYS` pada `docker/security-headers.mjs`.

## Authentication

- Browser memakai Sanctum SPA cookie/session auth, bukan JWT di localStorage.
- Unsafe request wajib melewati CSRF bootstrap dan mengirim `X-XSRF-TOKEN`.
- Hanya response `401` yang mengarah ke login. Bedakan `403`, `422`, network, dan server error.
- Client route guard adalah UX boundary; authorization tetap wajib di API.

## UI and Copy

- Token warna, font, ukuran teks, radius, shadow, tinggi kontrol, dan focus ring ada di `src/app.css`, dan `src/lib/design-tokens.spec.ts` menguji kontras serta menolak nilai di luar skala. Desain layar ada di Figma, tetapi Figma hanya panduan.
- Inter untuk teks baca, Montserrat untuk `h1`, `h2`, dan display, JetBrains Mono untuk kode dan log. Ukuran teks hanya 12, 14, 16, 20, 24, 32, dan 48 px. Weight hanya 400, 500, dan 600.
- Pakai `Button`, `Badge`, `FormField`, `EmptyState`, dan `.control-input`. Radius kontrol `rounded-control`, kartu `rounded-card`, overlay `rounded-overlay`. Hanya overlay yang punya shadow.
- Console memakai sidebar di `AppShell`, yang menjadi drawer sampai lebar 1024 px.
- UI light-first, tenang, jelas, accessible, dan tidak memakai dark cyberpunk atau AI glow.
- User-facing copy memakai Bahasa Indonesia.
- Setiap screen memiliki satu primary action dan status tidak boleh bergantung pada warna saja.
- Glosarium copy, satu nama untuk satu hal:
  - `kata sandi`, bukan password; `nilai`, bukan value; `secret`, bukan rahasia; `log`, bukan logs; `deteksi`, bukan detect.
  - `men-deploy` dan `di-deploy`, sesuai EYD V. `deploy`, `build`, `branch`, `repository`, dan `environment variable` tetap bahasa Inggris.
  - Status proyek: `Live`, `Men-deploy`, `Gagal`, `Crash`, `Berhenti`, `Belum deploy`. Status deployment: `Berhasil`, `Men-deploy`, `Mengantre`, `Gagal`, `Dibatalkan`.
  - Label memakai sentence case: `Simpan perubahan`, bukan `Simpan Perubahan`.
- Primitive kompleks seperti dialog, combobox, dan menu harus memakai foundation aksesibilitas matang; jangan hand-roll tanpa alasan.

## Dependencies and Quality

- Gunakan `pnpm add` atau `pnpm add -D`; jangan edit dependency version manual.
- Laravel Echo untuk Reverb sudah terpasang, boundary-nya di `src/lib/realtime`. Jangan memasang chart atau component library sebelum use case dan kontraknya tersedia.
- Jalankan `pnpm quality` sebelum menyelesaikan perubahan.
- Component Svelte baru atau yang diubah harus diperiksa dengan Svelte autofixer.
- Perubahan behavior memerlukan test yang sebanding dengan risikonya.

## Documentation and Commits

- Perbarui docs jika mengubah route, env, API client, auth flow, atau architecture boundary.
- Ikuti Conventional Commits, misalnya `feat(console-projects): add project list`.
- Jangan mengubah governance, sponsorship, brand direction, atau license tanpa persetujuan maintainer.
