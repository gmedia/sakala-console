# Authentication

## Strategy

Console first-party memakai Laravel Sanctum SPA cookie/session auth. JWT atau bearer token tidak disimpan di browser. Agent dan future CLI memakai mekanisme token terpisah.

## Local Domains

```text
Console: http://app.sakala.localhost:5173
API:     http://api.sakala.localhost:8000
Cookie:  .sakala.localhost
```

API harus mengizinkan console pada CORS dan `SANCTUM_STATEFUL_DOMAINS`.

## Unsafe Requests

Sebelum `POST`, `PUT`, `PATCH`, atau `DELETE`, API client mengambil `/sanctum/csrf-cookie` jika `XSRF-TOKEN` belum tersedia. Token cookie dikirim kembali pada `X-XSRF-TOKEN`, dan request selalu memakai `credentials: include`.

## OAuth Direction

Flow GitHub yang akan diimplementasikan:

```text
Console -> API GitHub redirect -> GitHub -> API callback
API creates session -> redirect to Console -> Console fetches current user
```

Auth guard console hanya mengelola loading dan navigation. Seluruh resource tetap dilindungi middleware dan Policy API.

## Current User Query Cache

Console menyimpan hasil dari `api/v1/auth/user` melalui TanStack Query dengan query key `['auth', 'currentUser']` di (`src/lib/api/query-keys.ts`), gunakan `useCurrentUser()` pada (`src/lib/features/auth/queries.ts`) untuk mengakses data user saat ini. Tidak boleh mendefinisikan key baru untuk data yang sama.

### Stale time

Data dianggap fresh selama 5 menit, identitas user jarang berubah dalam satu sesi aktif, sehingga navigasi antar halaman tidak perlu refetch ulang.

### Retry Policy

- `401`: tidak di retry karena hasilnya tidak akan berubah oleh percobaan ulang.
- `403` / `network` / `5xx` : bisa di retry karena berpotensi kondisi sementara, bisa di retry sampai 3 kali.

### Auth Guard

Auth guard (`src/lib/features/auth/components/AuthGuard.svelte`) akan membaca status saat ini untuk menentukan apa yang akan dirender.

- `401` -> redirect ke `/login?returnTo=<path aman>`.
- `419` -> tetap di halaman dan menampilkan pesan error sesi kedaluwarsa (CSRF expired) dengan aksi untuk muat ulang halaman
- `403` / `network` / `5xx` -> tetap di halaman dan menampilkan pesan error dengan option untuk retry.
- `pending` -> menampilkan skeleton loading, tidak merender konten protected dan tidak melakukan redirect apa pun sampai status final.

### Logout

`useLogout()` (`src/lib/features/auth/mutations.ts`) memanggil `queryClient.clear()` setelah logout success, ini menghapus seluruh cache TanStack Query.
