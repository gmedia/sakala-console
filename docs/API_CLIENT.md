# API Client

## Base URL

`PUBLIC_API_URL` menunjuk ke `sakala-api`; default lokal adalah `http://api.sakala.localhost:8000`. Application endpoint berada di `/api/v1`.

## Request Flow

Seluruh request produk menggunakan `apiRequest` dari `src/lib/api/client.ts`. Helper tersebut mengatur JSON headers, cookie credentials, CSRF, response kosong, network error, dan Laravel error representation.

Jangan memanggil raw `fetch` dari route atau component. Tambahkan wrapper domain ke `src/lib/api/resources` lalu gunakan melalui TanStack Query di feature terkait.

## Error Model

- `ApiError(401)`: session tidak tersedia. Query dan mutation apa pun mengarah ke login, lihat [Authentication](AUTHENTICATION.md#session-berakhir-di-tengah-jalan).
- `ApiError(403)`: user login tetapi tidak memiliki izin.
- `ApiError(422)`: tampilkan field validation dari `errors`.
- `NetworkError`: tampilkan retry/offline state, bukan login redirect.
- `ApiError(429)`: `message` menyebut waktu tunggu dari `Retry-After`, tersedia juga di `retryAfterSeconds`. `sakala-api` mencantumkan header ini di `exposed_headers` CORS, jadi terbaca lintas origin. Polling yang kena 429 menunggu selama itu, lewat `rateLimitWait()` di `features/deployments/queries.ts`.
- `5xx`: tampilkan service error tanpa mengekspos payload internal.

`ApiError.code` membawa kode stabil dari API kalau ada. `message` memakai teks API untuk penolakan bisnis 4xx: selalu kalau ada `code`, dan untuk 402, 403, 409, 422, dan 423 kalau belum ada `code`. Pesan bawaan Laravel, teks yang memuat nama class atau SQL, serta semua teks pada 401, 419, dan 5xx diganti pesan aman. Tampilkan error di UI lewat `getErrorMessage(error, fallback)`, supaya pesan `ZodError` atau `TypeError` tidak sampai ke user.

## Generated Types

Nyalakan `sakala-api`, lalu jalankan:

```bash
pnpm api:types
```

Command membaca Scramble OpenAPI dari `http://127.0.0.1:8000/docs/api.json` agar local proxy dan
konfigurasi hostname tidak memengaruhi generation. File hasil generation boleh diregenerasi dan
di-commit, tetapi tidak diedit manual.

Tanpa server yang menyala, export dari `sakala-api` ke file di luar repository lalu arahkan
`openapi-typescript` ke file itu. Pakai SQLite yang sudah dimigrasi, bukan `:memory:` kosong: tanpa
tabel, Scramble tidak bisa membaca tipe kolom, sehingga `sequence` dan field nullable keluar sebagai
`string`.

```bash
# di sakala-api
touch /tmp/sakala-openapi.sqlite
export DB_CONNECTION=sqlite DB_DATABASE=/tmp/sakala-openapi.sqlite
php artisan migrate --force
php artisan scramble:export --path=/tmp/sakala-openapi.json

# di sakala-console
pnpm exec openapi-typescript /tmp/sakala-openapi.json -o src/lib/api/generated/schema.d.ts
pnpm exec prettier --write src/lib/api/generated/schema.d.ts
```

## Reference Implementation

Endpoint pilot limits menunjukkan pola kontrak yang wajib diikuti resource baru:

```ts
import { z } from 'zod';
import type { components } from '$lib/api/generated/schema';

type PilotLimits = Pick<
	components['schemas']['PilotLimitsResource'],
	'quotas' | 'runtime_defaults' | 'timeouts'
>;

const pilotLimitsResponseSchema = z.object({
	data: z.object({
		// quotas, runtime_defaults, timeouts
	})
}) satisfies z.ZodType<{ data: PilotLimits }>;
```

Generated OpenAPI type menjaga kecocokan saat development dan build. Zod tetap memeriksa response
nyata saat runtime karena generated TypeScript type tidak tersedia setelah code dikompilasi.

Alur lengkap referensi berada di:

- `src/lib/api/resources/pilot-limits.ts`: HTTP boundary, generated type, dan runtime schema.
- `src/lib/features/projects/queries.ts`: `createPilotLimitsQuery()`, TanStack Query untuk server state.
- `src/lib/features/projects/components/create/PilotQuotaNotice.svelte`: UI yang memakainya.
- `src/lib/api/resources/pilot-limits.spec.ts`: contract parser test.

## Deployment Logs

`GET /deployments/{id}/logs?order=desc&per_page=200` mengembalikan baris terbaru lebih dulu, dan `next_cursor` berjalan mundur ke baris yang lebih lama. `features/deployments/use-deployment-logs.svelte.ts` memakai bentuk ini, jadi baris terakhir log yang gagal tampil dari satu request, sepanjang apa pun lognya. Baris lama dimuat kalau user memintanya. Cache menyimpan paling banyak 10 halaman (2.000 baris).

Event `deployment.log.created` membawa isi barisnya. `log_sequence` sama dengan `sequence` di GET, jadi itu kunci dedupe terhadap history, sedangkan `sequence` di payload adalah penghitung realtime milik deployment dan tidak dipakai untuk baris. Baris masuk ke cache tanpa request. Tail baru dibaca ulang kalau `log_sequence` melompat, saat deployment selesai, atau selama realtime tidak terhubung (tiap 5 detik). Semua request ini ikut `throttle:api`, 60 request per menit per user.

## Notifikasi

Notifikasi hanya berasal dari `sakala-api`, tanpa data contoh. Lonceng membaca `GET app/notifications/unread-count`, dan daftarnya di-page oleh server. API tidak punya parameter pencarian, jadi console juga tidak menawarkannya: filter di sisi client hanya mencari di satu halaman dan akan salah menyatakan "tidak ada hasil".

`useNotificationsLive()` mengikuti event `notification.created` pada channel `users.{id}`, dan event itu membuat query notifikasi dibaca ulang, begitu juga saat realtime tersambung kembali. Polling menjadi cadangannya: 60 detik tanpa realtime dan 5 menit dengan realtime.

Preferensi di `app/notification-preferences` punya empat kategori, sehingga pengaturan di console juga hanya empat.

## Wizard Create Project

Wizard di `/projects/new` punya tiga langkah, dan project baru ada setelah langkah kedua. Figma menaruh "Buat Proyek" di langkah yang sama tapi dialognya bilang project belum dibuat, jadi kode mengikuti keadaan yang benar di backend.

1. Repository. `GET app/github/installations/{id}/repositories` dipanggil per halaman (5 repository) dengan `search` di server, dan jumlah "Menampilkan x dari y" memakai `meta.total`. API hanya mencari di 1.000 repository pertama. Instalasi lebih dari satu memunculkan pilihan akun. `409` berarti instalasi tidak aktif, dan tombol hubungkan ulang menuju `auth/github/installations/{id}/configure`, atau `auth/github/install` kalau statusnya `removed`.
2. Konfigurasi. Port, build, start, dan root directory terlipat di "Pengaturan lanjutan", dan terbuka sendiri kalau ada isinya atau salah satunya error. Branch berasal dari `.../repositories/{id}/branches` atau `repositories/branches?repository_url=`. Yang pertama dipotong API di 100 branch, jadi hanya di situ nama lain boleh diketik. Domain berasal dari `GET app/projects/domain-preview`, tidak dipatok di console. Validasi field meniru `ValidatesBuildConfiguration` di API, dan `422` dipetakan ke field-nya. "Buat Proyek" menjalankan `POST app/projects`, lalu menyimpan env satu per satu. Env yang gagal dijelaskan dan dicoba ulang tanpa membuat project lagi.
3. Auto Detect. `preview_status` dibaca ulang tiap 3 detik selama `pending`. `null` di `stack` berarti tidak diketahui dan ditampilkan begitu. "Detect ulang" memakai `POST app/projects/{id}/inspection`, dan "Deploy sekarang" membuat deployment lalu membuka halaman detail deployment, yang menjadi langkah deploy-nya.

Setelah project dibuat, id-nya masuk ke URL (`?project=`) dengan `replaceState`. Reload membuka langkah 3, bukan form, karena mengirim form lagi akan membuat project kedua. Keluar dari langkah 3 tidak menghapus project.

## Batas Pilot

`GET app/pilot-limits` ditampilkan di dashboard dan wizard sebelum batasnya kena. Saat kuota project habis, wizard tidak bisa dilanjutkan. API tetap penentu akhirnya: penolakannya tampil lewat `getErrorMessage()`.

## Masukan

`POST app/feedback` dipanggil dari `/feedback`, yang bisa membawa `?project=` dan `?deployment=` sebagai konteks yang bisa dilepas user. API menolak masukan yang sama dalam 5 menit dengan `409`, dan teksnya tetap ada di form saat gagal.

## Upload Avatar

PHP hanya mem-parse body multipart pada `POST`. Karena itu `uploadAvatar()` mengirim `POST app/profile` dengan field `_method=PATCH`, dan Laravel meneruskannya ke route `PATCH` yang sama. Field teks tetap memakai `PATCH` dengan JSON.

## Daftar Project

`GET app/projects` mengirim `public_url` dan `latest_deployment`, yang boleh `null` untuk project tanpa deployment. Kartu hanya menautkan URL saat `runtime_status` bernilai `running`. Satu baca daftar berarti satu request untuk enam kartu.

Daftar di-poll dengan `resolveProjectListPollInterval()`: 15 detik saat ada yang sedang berjalan dan 60 detik saat tidak, atau 60 detik dan 5 menit saat socket tersambung. `notification.created` di `users.{id}` juga membaca ulang daftar, karena notifikasi itulah yang mengabarkan akhir deployment. API belum punya channel per project untuk daftar ini.

## Project Header

`deriveProjectHeaderState()` di `features/projects/presentation.ts` adalah satu-satunya tempat yang menentukan klaim header project: badge, boleh tidaknya Redeploy, URL, dan pesan. `project.status` tetap `draft` sampai deployment pertama berhasil, dan deployment yang masih `queued` belum mengubah `runtime_status`, jadi fungsi ini juga membaca deployment terbaru.

`useProjectLiveStatus()` mengikuti `deployment.updated` pada deployment yang berjalan, atau pada deployment aktif kalau tidak ada yang berjalan, karena `project_runtime_status` saat crash dikirim ke sana. Polling menjadi cadangannya: 10 detik saat ada deployment berjalan, 60 detik kalau realtime terhubung atau idle.

`crashed` berarti aplikasi sedang restart atau crash loop, jadi URL tetap tampil dan pesannya bilang URL bisa kadang terbuka. Port yang tampil adalah `serving_port` kalau API mengirimnya, dan `effective_port` ditandai berlaku di deploy berikutnya kalau berbeda.

## Alasan Penangguhan

API belum menaruh alasan penangguhan di project. Alasan itu dikirim sekali lewat notifikasi `project_issue` berjudul `Proyek ditangguhkan`, jadi `findSuspensionReason()` membacanya dari 50 notifikasi terbaru. Kalau notifikasinya sudah tidak ada, header menyebut bahwa alasannya ada di notifikasi dan email. Kontak banding `abuse@sakala.dev` ada di `src/lib/config/project.ts`.

## Hemat Request

`throttle:api` mengizinkan 60 request per menit per user, dibagi semua tab. Aturannya:

- Payload realtime langsung masuk cache (`applyRealtimeDeploymentUpdate`, `applyRealtimeDeploymentEvent`), jadi satu langkah deployment tidak memicu request. Baca ulang hanya terjadi saat deployment selesai, karena `failure` dan `is_active` tidak ada di payload, dan digabung lewat `createCoalescedTask` dan `requestProjectRefresh`.
- Selama realtime terhubung, polling deployment dan event hanya tiap 60 detik sebagai jaring pengaman. Tanpa realtime tiap 5 detik.
- Tab di background tidak polling dan menunda baca ulang sampai dilihat.
- GET yang kena `429` mengisi gerbang di `api/rate-limit.ts`. Sampai `Retry-After` habis, GET lain tidak dikirim, termasuk dari tab lain lewat `localStorage`. Write tetap dikirim, dan `429` dari write tidak menutup gerbang karena limit-nya lebih sempit.
- Event deployment hanya bertambah dan API membatasi 10 per halaman, jadi baca ulang melanjutkan dari halaman terakhir (`resumeCursor`), bukan mengulang semua halaman dari awal.
- Unduh data (`separateRateLimit`) punya limit sendiri, jadi tidak ikut gerbang di atas.
- `AuthGuard` menampilkan waktu tunggu dan mencoba lagi sendiri saat `429`.

`request-budget.svelte.spec.ts` mengukur satu tab pada deployment 5 menit dengan timeline tiruan: paling sibuk 9 request per 60 detik dengan realtime, 64 dengan polling saja.

Skema field yang hanya pelengkap tampilan (`metadata`, `*_resources`, `queue_state`) membaca bentuk tak dikenal sebagai `null`, karena PHP mengirim map kosong sebagai `[]`. Baris event atau log yang rusak dilewati satu per satu, bukan menjatuhkan seluruh daftar.
