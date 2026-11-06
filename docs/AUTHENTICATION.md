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

`AuthGuard` juga menjaga `/onboarding` lewat route group `(onboarding)`: user tanpa session diarahkan ke login, dan user yang sudah menyelesaikan onboarding diarahkan ke `/projects`.

### Persetujuan Dokumen

Formulir daftar punya satu kotak centang wajib, dengan teks yang tertulis di `sakala-api/docs/AUTHENTICATION.md`. Console mengirim `accept_terms` bersama `terms_version` dan `acceptable_use_version` dari `GET auth/options`, yaitu versi yang benar-benar ditampilkan. Pemberitahuan Privasi hanya ditautkan, tanpa kotak, karena tidak disetujui. Kalau versinya tidak bisa dibaca, formulir tidak bisa dikirim dan menawarkan "Coba lagi".

Saat `GET auth/user` menjawab `legal_acceptance_required: true`, misalnya setelah login pertama lewat GitHub atau setelah versi berganti, `AuthGuard` menampilkan `LegalAcceptanceScreen` sebelum app dan sebelum onboarding, lalu memanggil `POST auth/legal-acceptance`. `/settings` tetap terbuka, supaya orang bisa mengunduh data dan menghapus akun tanpa harus setuju dulu. Versi yang ditolak `422` berarti dokumennya baru saja berubah: kotaknya dikosongkan dan options dibaca ulang.

Kalau dokumen berganti saat session berjalan, API menjawab `403 LEGAL_ACCEPTANCE_REQUIRED`. `reportApiError()` membaca ulang user, dan layar persetujuan muncul sendiri.

### Hapus Akun dan Unduh Data

`DeleteAccountSection` di tab akun memanggil `DELETE auth/account` dengan email yang diketik ulang, ditambah `current_password` kalau akunnya punya kata sandi. `403 REAUTHENTICATION_REQUIRED` menampilkan tombol masuk ulang per provider yang aktif, dengan `return_url` ke `/settings`. Akun admin tidak ditawari tombolnya, karena API menjawab `409 ADMIN_ACCOUNT_CANNOT_BE_DELETED`. Masa simpan yang disebut dialog berasal dari `deleted_project_retention_days` di `GET app/pilot-limits`.

`GET auth/account/export` punya rate limit sendiri, jadi request-nya memakai `separateRateLimit`. Dengan begitu `429` di sini tidak menghentikan semua read yang lain, dan sebaliknya.

### Session Berakhir di Tengah Jalan

`401` dari query atau mutation apa pun, termasuk polling, mengarah ke `/login?returnTo=<path aman>`. `QueryCache` dan `MutationCache` di `src/lib/api/query-client.ts` melaporkannya ke `handleSessionExpired()` (`src/lib/features/auth/session-expiry.ts`), yang hanya bekerja di route group `(app)` dan `(onboarding)`, memutus realtime, lalu mengosongkan cache setelah navigasi supaya data session lama tidak terbaca oleh user berikutnya.

Mutation yang `401`-nya punya arti lain memasang `meta: { handlesUnauthenticated: true }`. Saat ini itu login (kata sandi salah) dan logout. `403`, `419`, `422`, network, dan `5xx` tidak ikut mengarah ke login.

### Pilihan Masuk dan Pengiriman Email

Halaman masuk, daftar, lupa kata sandi, dan Pengaturan membaca `GET /api/v1/auth/options` lewat `useAuthOptions()`. `src/lib/features/auth/availability.ts` mengubah jawabannya menjadi pilihan yang ditawarkan.

| Keadaan                                                  | Yang terjadi                                                                                                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Masih memuat                                             | Skeleton. Pilihan yang bergantung pada flag belum muncul, jadi tidak ada yang tampil lalu hilang.                                                       |
| `email_delivery_enabled: false`                          | Daftar lewat email, "Lupa Kata Sandi?", kirim ulang verifikasi, dan ganti email disembunyikan, dengan penjelasan yang menyebut provider yang berfungsi. |
| `providers.google: false` atau `providers.github: false` | Provider itu tidak ditawarkan, termasuk bila tersimpan sebagai "Terakhir Digunakan".                                                                    |
| Request gagal                                            | Perilaku lama: semua pilihan tampil. Bila API menolak, `message` dari `EMAIL_DELIVERY_UNAVAILABLE` ditampilkan apa adanya.                              |

Login dengan email dan kata sandi tetap ditawarkan saat email mati, karena akun yang sudah terverifikasi masih bisa memakainya tanpa email.

### Halaman dari Tautan Email

| Route                           | Datang dari                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| `/email-verified?status=`       | Link verifikasi. `status` selain `success` dan `error` tidak diklaim sebagai hasil apa pun. |
| `/email-changed?status=`        | Link konfirmasi ganti email, dengan aturan `status` yang sama.                              |
| `/reset-password?token=&email=` | Link reset. Keduanya dibaca sekali ke memori, lalu dihapus dari address bar.                |

Token reset tidak boleh disimpan di storage atau ditulis ke log. Akibatnya, memuat ulang halaman reset menghilangkan token, dan halaman meminta user mengambil tautan baru.

Teks lupa kata sandi dan kirim ulang verifikasi selalu generik ("kalau email ini terdaftar..."), mengikuti API yang menjawab sama untuk email terdaftar maupun tidak. Aturan kata sandi di UI hanya minimal 8 karakter, sesuai `Password::defaults()` di `sakala-api`.

### Logout

`useLogout()` (`src/lib/features/auth/mutations.ts`) memanggil `queryClient.clear()` setelah logout success, ini menghapus seluruh cache TanStack Query.
