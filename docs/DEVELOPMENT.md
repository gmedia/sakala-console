# Development

## Workflow

1. Jalankan `pnpm install`. Node.js minimal 22.12, dan pnpm mengikuti versi `packageManager` di `package.json`.
2. Salin `.env.example` menjadi `.env`. Isinya konfigurasi publik, dan nilai bawaannya langsung jalan untuk lokal.
3. Jalankan `sakala-api` pada domain lokal.
4. Jalankan `pnpm dev`.
5. Buat resource API sebelum feature query/mutation.
6. Susun page dari feature component, bukan business logic langsung di route.

## Ikon

Import ikon satu per satu, misalnya `phosphor-svelte/lib/Check` atau `@lucide/svelte/icons/check`, bukan dari barrel-nya. ESLint menolak import dari barrel. Barrel `phosphor-svelte` di-prebundle Vite menjadi 20 MB JavaScript, dan itu membuat test browser crash saat cache Vite kosong. Alasannya ada di [Testing](TESTING.md#component).

## Warna

Pakai token di `src/app.css`, bukan hex. ESLint menolak hex di class `.svelte`, dan `src/lib/design-tokens.spec.ts` menguji kontras tiap token. Ilustrasi SVG dan logo pihak ketiga boleh memakai hex di `fill` dan `stroke`.

## State Policy

TanStack Query digunakan untuk data server. Svelte runes digunakan untuk local UI state. Jangan menyalin response API ke `$state` global.

## Realtime

Laravel Echo dan Pusher client sudah terpasang, boundary-nya di `src/lib/realtime`. Channel baru harus mendokumentasikan auth endpoint, event name, payload, reconnect, dan fallback polling.

## Quality

```bash
pnpm exec playwright install chromium   # sekali per mesin
pnpm quality
pnpm test:e2e
```

Pre-commit hook hanya memformat dan lint file staged. Full quality gate tetap wajib sebelum pull request.
