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
- `NetworkError`: tampilkan retry/offline state, bukan login redirect. Judul dan teksnya satu untuk seluruh Console, `CONNECTION_ERROR_COPY` di `lib/components/feedback/connection-copy.ts` ("Tidak dapat terhubung ke server"). `isConnectionFailure()` di `api/errors.ts` juga mengenali chunk Console yang gagal dimuat; `handleError` di `src/hooks.client.ts` menandainya `connection: true`, sehingga halaman error root menampilkan pesan koneksi itu, bukan "Error 500".
- `ApiError(429)`: `message` menyebut waktu tunggu dari `Retry-After`, tersedia juga di `retryAfterSeconds`. `sakala-api` mencantumkan header ini di `exposed_headers` CORS, jadi terbaca lintas origin. Polling yang kena 429 menunggu selama itu, lewat `rateLimitWait()` di `features/deployments/queries.ts`.
- `5xx`: tampilkan service error tanpa mengekspos payload internal.

`ApiError.code` membawa kode stabil dari API kalau ada. `message` memakai teks API untuk penolakan bisnis 4xx: selalu kalau ada `code`, dan untuk 402, 403, 409, 422, dan 423 kalau belum ada `code`. Pesan bawaan Laravel, teks yang memuat nama class atau SQL, serta semua teks pada 401, 419, dan 5xx diganti pesan aman. Tampilkan error di UI lewat `getErrorMessage(error, fallback)`, supaya pesan `ZodError` atau `TypeError` tidak sampai ke user.

Field lain di body error, misalnya `limit` dan `current` pada `PROJECT_WAKE_LIMIT_EXCEEDED`, ada di `ApiError.details` tanpa divalidasi. Bacalah lewat schema Zod di resource yang mendokumentasikannya, contohnya `parseWakeLimitDetails()` di `api/resources/project-wake.ts`, atau `parseContainerLimitDetails()` dan `parseReplicasUnsupportedDetails()` di `api/resources/project-deploy-refusals.ts`, yang mengikuti tabel kode error di `docs/API_CONVENTIONS.md` sakala-api karena body-nya belum ada di OpenAPI. Kode yang dibaca Console disimpan sebagai konstanta di `api/errors.ts`.

## Generated Types

`src/lib/api/generated/openapi.json` adalah export Scramble OpenAPI dari `sakala-api` yang di-commit,
dan `schema.d.ts` di-generate dari file itu. Keduanya tidak diedit manual dan tidak diformat
Prettier, supaya `pnpm api:types:check` bisa membandingkannya byte per byte. Check itu berjalan di
`pnpm quality` dan CI tanpa API yang menyala; ia membuktikan `schema.d.ts` cocok dengan
`openapi.json`, bukan bahwa `openapi.json` sama dengan API terbaru.

Untuk mengikuti API, export ulang `openapi.json` dari tag atau commit `sakala-api` yang dituju, lalu
generate:

```bash
# di sakala-api
touch /tmp/sakala-openapi.sqlite
export DB_CONNECTION=sqlite DB_DATABASE=/tmp/sakala-openapi.sqlite
php artisan migrate --force
php -d memory_limit=1G artisan scramble:export --path=<sakala-console>/src/lib/api/generated/openapi.json

# di sakala-console
pnpm api:types
pnpm check
```

Dengan batas memori PHP bawaan (128 MB), export berhenti dengan `FatalError` setelah menulis file; `-d memory_limit=1G` membuatnya selesai dengan exit 0 dan isi yang sama. Pakai SQLite yang sudah dimigrasi, bukan `:memory:` kosong: tanpa tabel, Scramble tidak bisa membaca
tipe kolom, sehingga `sequence` dan field nullable keluar sebagai `string`. Hasilnya sama dengan
PostgreSQL. Kalau API sedang menyala, `curl -fsS http://127.0.0.1:8000/docs/api.json -o
src/lib/api/generated/openapi.json` juga bisa.

Aturan saat tipe hasil generation tidak cocok dengan kode:

- Status dan enum lain yang ditampilkan (`status`, `trigger`, `runtime_status`, `role`, jawaban
  onboarding) tetap dibaca Zod sebagai `string`, dan tipe Console melebarkannya dengan `Omit<...> &
{ status: string }`. Nilai baru dari API yang lebih baru tetap tampil, dan label punya fallback.
- Field yang wajib di API tetapi belum dikirim API lama (`workspace`, `workspace_id`,
  `limit_profile`, kuota container) tetap opsional di Zod dan di tipe Console.
- Kalau Zod lebih ketat dari dokumen OpenAPI, tipe yang dipakai aplikasi adalah `z.output`
  schema, dan schema tetap `satisfies` tipe hasil generation.
- Kalau dokumen OpenAPI salah dibanding response nyata, jangan edit file generated. Override field
  itu di tipe Console dengan komentar yang menyebut kesalahannya, dan laporkan ke `sakala-api`.
  Saat ini tidak ada override seperti itu. `sakala-api` punya test yang gagal kalau ada field
  tanpa tipe di dokumennya.
- Route tanpa nama mendapat operation id dari nama controller, yang berubah kalau controller
  berubah. Untuk route itu, ambil tipe lewat `paths['/v1/...']`, seperti events dan log deployment.

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

Satu baris dari API hanya punya `sequence`, `stream` (`stdout`, `stderr`, `system`), `message`, dan `recorded_at`, tanpa level. `stderr` bukan error: git, BuildKit, Railpack, npm, dan composer menulis progres biasa ke sana, sehingga log deployment yang berhasil sebagian besar `stderr`. Karena itu level baris ditentukan di `features/deployments/log-classification.ts` dari deployment-nya: baris hanya `error` kalau deployment gagal, waktunya ada di jendela tahap yang gagal (dari `failure.stage` dan event tahap agent, lalu `finished_at` ditambah 30 detik toleransi jam), dan isinya menyebut error (`error`, `ERR!`, `fatal`, `failed`, `failure`, `exception`, `traceback`, `panic` sebagai kata), ditambah baris `stderr` terakhir di jendela itu. `warning` hanya untuk baris yang menyebut `warn` atau `warning` sebagai kata. Baris `system` dari agent tidak pernah error. Warna, label (ikon dan kata `error`, atau `warn`), filter "Hanya error", "Lihat error di log", dan "Salin ringkasan error" memakai klasifikasi yang sama. Daftar kata itu heuristik, dan sebaiknya diganti level per baris kalau agent nanti mengirimnya.

Alat log bekerja pada baris yang sudah dimuat: pencarian tanpa membedakan huruf besar (`/` memfokuskan field-nya), "Hanya error", tautan baris `#L<sequence>` (nomor di gutter adalah `sequence` log, jadi tetap sama antarhalaman; membuka tautan memuat halaman lama sampai barisnya ada), dan "Unduh .txt" (`<proyek>-deployment-<nomor>.txt`). Log dibatasi 2.000 baris di browser, jadi daftar tidak divirtualisasi.

Event `deployment.log.created` membawa isi barisnya. `log_sequence` sama dengan `sequence` di GET, jadi itu kunci dedupe terhadap history, sedangkan `sequence` di payload adalah penghitung realtime milik deployment dan tidak dipakai untuk baris. Baris masuk ke cache tanpa request. Tail baru dibaca ulang kalau `log_sequence` melompat, saat deployment selesai, atau selama realtime tidak terhubung (tiap 5 detik). Semua request ini ikut `throttle:api`, 60 request per menit per user.

## Notifikasi

Notifikasi hanya berasal dari `sakala-api`, tanpa data contoh. Lonceng membaca `GET app/notifications/unread-count`, dan daftarnya di-page oleh server. API tidak punya parameter pencarian, jadi console juga tidak menawarkannya: filter di sisi client hanya mencari di satu halaman dan akan salah menyatakan "tidak ada hasil".

`useNotificationsLive()` mengikuti event `notification.created` pada channel `users.{id}`, dan event itu membuat query notifikasi dibaca ulang, begitu juga saat realtime tersambung kembali. Polling menjadi cadangannya: 60 detik tanpa realtime dan 5 menit dengan realtime.

Preferensi di `app/notification-preferences` punya lima kategori lonceng (boolean datar) dan objek `email` untuk tiga kategori yang bisa diemail (`deployment_success`, `deployment_failure`, `project_issue`; gmedia/sakala-api#177). API sebelum email tidak mengirim `email`, dan schema mengisinya dengan default API (`false`, `true`, `true`). Halaman Notifikasi menampilkan dua kolom, Lonceng dan Email; `account_security` dan `workspace` menulis "Email penting selalu dikirim". Setiap switch langsung disimpan dengan `PATCH` sebagian (misalnya `{ "email": { "deployment_success": true } }`): switch bergerak dulu, kembali kalau API menolak, dan error `422` di `email.<kategori>` tampil di baris itu.

`/notifications/unsubscribe` adalah halaman publik untuk tautan berhenti berlangganan di email (GET API mengarah ke sini). Halaman itu tidak mengubah apa pun sampai dikonfirmasi, lalu mengirim `POST api/v1/public/notifications/unsubscribe` dengan query string persis seperti yang diterima, tanpa cookie, cookie CSRF, maupun `X-XSRF-TOKEN` (`apiRequest` dengan `anonymous: true`). `403`, `404`, `422`, dan `429` punya pesan masing-masing.

## Wizard Create Project

Wizard di `/projects/new` punya tiga langkah: Repository, Konfigurasi, dan Deploy. Project baru ada setelah langkah kedua.

1. Repository. `GET app/github/installations/{id}/repositories` dipanggil per halaman (5 repository) dengan `search` di server, dan jumlah "Menampilkan x dari y" memakai `meta.total`. API hanya mencari di 1.000 repository pertama. Instalasi lebih dari satu memunculkan pilihan akun. `409` berarti instalasi tidak aktif, dan tombol hubungkan ulang menuju `auth/github/installations/{id}/configure`, atau `auth/github/install` kalau statusnya `removed`. Tab "URL GitHub publik" menerima alamat seperti yang disalin orang (tanpa `https://`, `/` di akhir, `.git`, `/tree/<branch>/...`, `/blob/...`, bentuk SSH, atau `owner/repo`) dan menormalkannya lewat `normalizeGithubRepositoryUrl()` ke `https://github.com/owner/repo`. Hanya bentuk itu yang dikirim ke `POST app/github/repositories/validate` dan ke `repository.url`. Di bawahnya ada repo contoh (`STARTER_EXAMPLES` di `src/lib/config/starter-examples.ts`): memilihnya mengisi URL publik, root directory, release command, nama proyek, dan variabel yang dibutuhkan (`APP_KEY` Laravel dibuat di browser dengan Web Crypto), lalu memvalidasi repo dan maju ke Konfigurasi. `?example=<id>` melakukan hal yang sama saat wizard dibuka, dan `#contoh` menggulung ke daftarnya.
2. Konfigurasi. Workspace dipilih di langkah 1 dan di sini hanya disebut. Port, build, start, release, dan root directory terlipat di "Pengaturan lanjutan", dengan placeholder "Dideteksi otomatis" (contoh perintah ada di teks bantuan, supaya tidak terbaca seperti nilai yang sudah terisi). Branch berasal dari `.../repositories/{id}/branches` atau `repositories/branches?repository_url=`. Yang pertama dipotong API di 100 branch, jadi hanya di situ nama lain boleh diketik. Domain berasal dari `GET app/projects/domain-preview`. Validasi field meniru `ValidatesBuildConfiguration` di API, dan `422` dipetakan ke field-nya. Isi file `.env` bisa ditempel (tombol "Tempel dari .env", atau menempel beberapa baris ke field nama): `EnvImportPanel` membacanya dengan `parse` dari `dotenv`, menandai kunci yang sudah ada dengan pilihan Lewati (bawaan) atau Timpa, menyimpan semuanya sebagai secret kecuali dimatikan (yang terlihat seperti kredensial tetap secret dan disebut namanya), dan tidak menambahkan `PORT`, karena agent mengisinya dari port proyek; di wizard nilai itu menjadi Port proyek kalau belum diisi. "Buat dan deploy" dan "Buat tanpa deploy" sama-sama menjalankan `POST app/projects`, lalu menyimpan env satu per satu. Env yang gagal dijelaskan dan dicoba ulang tanpa membuat project lagi. "Buat tanpa deploy" lalu membuka halaman proyek.
3. Deploy. Setelah "Buat dan deploy", deployment pertama dimulai sendiri (`POST app/projects/{id}/deployments` dengan idempotency key) begitu port-nya pasti, lalu halaman detail deployment terbuka. API memakukan `container_port` saat deployment dibuat (`configured_port`, lalu `detected_port` dari `EXPOSE` Dockerfile hasil inspeksi, lalu 3000), jadi port dianggap pasti kalau Port diisi atau inspeksi sudah `succeeded` (`isPortSettled()`). Tanpa Port, langkah ini menunggu `preview_status` (dibaca ulang tiap 5 detik) lalu deploy tanpa klik lagi. Inspeksi yang gagal tidak memicu deploy; "Deteksi ulang" memakai `POST app/projects/{id}/inspection`. Setelah 2 menit menunggu, "Deploy sekarang" bisa diklik dengan peringatan soal Dockerfile. Kalau `stack.monorepo` ada (root directory adalah package workspace JavaScript, sakala-api #179), hasil deteksi menampilkan workspace, package, dan perintah build dan start turunan dari `package.json` lewat `MonorepoSummary`. Timeline halaman deployment menampilkan perintah yang benar-benar dipakai dari metadata event `deployment.workspace.detected` (dibaca dengan schema Zod; bentuk lain diabaikan), di bawah tahap Menganalisis proyek, atau Build proyek kalau event analisis tidak ada.

   Inspeksi yang `succeeded` dari API dengan kontrak wizard env + database (gmedia/sakala-api#184) membawa `inspection.env_example` (isi `.env.example`, `.env.sample`, atau `.env.dist`, paling banyak 200 entri) dan `inspection.database_hint` (`likely`, `engine`, `signals`, `suggested_release_command`). Kalau ada yang perlu dikonfirmasi (baris yang bisa disimpan dan belum ada di proyek, atau `database_hint.likely`), langkah 3 menampilkan fase Persiapan alih-alih deploy otomatis, dengan satu aksi utama "Deploy sekarang". Pengecualiannya tetap: "Buat dan deploy" dengan Port terisi langsung deploy, dan "Buat tanpa deploy" membuka halaman proyek; saran tetap ada di tab Variabel. Aturan pengelompokan variabel ada di `features/projects/env-suggestions/classify-env-example.ts` (Diisi Sakala, Dibuatkan Sakala, Perlu kamu isi, Dari .env.example), secret acak dibuat di browser dengan `crypto.getRandomValues` (`features/projects/secret-generation.ts`), dan contoh yang terlihat seperti kredensial tidak pernah dipakai sebagai nilai atau petunjuk. Kartu database punya tiga pilihan: database baru (bawaan kalau `likely`, `databases.available` di pilot-limits, dan kuota masih ada), database workspace yang sudah ada (yang belum `ready`, dipakai proyek lain, atau beda region tetap tampil tapi nonaktif dengan alasannya), atau tanpa database. Urutan "Deploy sekarang" ada di `features/projects/first-deploy/run-first-deploy.ts`: `PUT` release command kalau disarankan dan proyek belum punya, variabel satu per satu (berhenti kalau ada yang ditolak, lalu simpan ulang atau lanjut tanpanya), lalu `POST app/workspaces/{w}/databases` dengan `project_id` dan `deploy_when_ready: true` (API yang men-deploy setelah database siap), atau `POST .../attachments/{project}` lalu deploy, atau langsung deploy. Selama `databases[0].deploy_when_ready.status` `waiting`, project dibaca ulang tiap 3 detik; `started` membuka deployment-nya, `skipped` menjelaskan alasannya dan menawarkan "Deploy sekarang", atau "Deploy tanpa database" (lepas database lalu deploy) kalau database gagal dibuat. Penolakan dipetakan dari `code` (`DATABASE_UNAVAILABLE`, `DATABASE_LIMIT_EXCEEDED`, `DATABASE_STORAGE_LIMIT_EXCEEDED`, `DATABASE_REGION_UNAVAILABLE`, `DATABASE_CROSS_REGION_UNSUPPORTED`, `PROJECT_DATABASE_ALREADY_ATTACHED`, `DATABASE_NOT_READY`). Reload di tengah menunggu database menampilkan status menunggu, bukan Persiapan lagi.

Setelah project dibuat, id-nya masuk ke URL (`?project=`, ditambah `&deploy=1` untuk "Buat dan deploy") dengan `replaceState`. Reload membuka langkah 3, bukan form, karena mengirim form lagi akan membuat project kedua. Kalau `latest_deployment` sudah ada, reload membuka deployment itu alih-alih membuat yang kedua. Keluar dari langkah 3 tidak menghapus project.

Tab Variabel di halaman proyek memakai `EnvImportPanel` yang sama: kunci baru disimpan dengan `POST`, kunci yang ditimpa dengan `PATCH .../environment-variables/{id}`, satu per satu, dan yang gagal disebut namanya. Kalau inspeksi membawa entri `env_example`, tombol "Isi dari .env.example" membuka panel yang sama dengan sumber dari classifier yang sama: baris "Perlu kamu isi" punya input langsung di panel (kosong berarti dilewati), kunci yang sudah ada mengikuti Lewati atau Timpa, tetapi kunci acak yang sudah ada (misalnya `APP_KEY`) tidak pernah diganti. Tautan `#isi-dari-env-example` (dari langkah berikutnya di Ringkasan) membuka panel itu langsung.

## Batas Pilot

`GET app/pilot-limits` ditampilkan di dashboard dan wizard sebelum batasnya kena. Saat kuota project habis, wizard tidak bisa dilanjutkan. API tetap penentu akhirnya: penolakannya tampil lewat `getErrorMessage()`.

Batas itu milik satu workspace. Tanpa `workspace_id` API menjawab untuk workspace pribadi, jadi Console hanya mengirim parameter itu untuk workspace tim (`limitsWorkspaceId()`), dan key cache-nya `['pilot-limits', id ?? 'personal']`, sehingga invalidasi `queryKeys.pilotLimits` tetap menyegarkan semua workspace.

## Workspace

Setiap project dimiliki workspace (ADR-018 di sakala-landing). Setiap user punya workspace pribadi, dan workspace tim punya peran `owner`, `member`, dan `viewer`. Kontraknya ada di `src/lib/api/resources/workspaces.ts`. Schema Zod di sana ditulis sebelum workspace masuk ke OpenAPI yang di-generate, dan tetap menjadi kontrak runtime-nya. Schema itu diuji terhadap respons yang benar-benar dikirim API di `tests/fixtures/workspaces/*.json`, diambil dari factory sakala-api lewat test Pest sekali jalan yang tidak di-commit ke API. Field debug Laravel (`exception`, `file`, `line`, `trace`) dibuang dari fixture, karena production tidak mengirimnya.

- Workspace aktif dipilih di sidebar dan disimpan di `localStorage` per user (`sakala.active-workspace.{userId}`), lewat `features/workspaces/selection.svelte.ts`. Tanpa pilihan, atau kalau user sudah keluar dari tim yang tersimpan, yang aktif adalah workspace pribadi. Orang yang tidak punya tim tidak melihat perubahan apa pun selain switcher-nya.
- Daftar project mengirim `workspace_id` workspace aktif. Kalau `GET app/workspaces` gagal, misalnya API lama tanpa workspace, daftar dibaca tanpa parameter dan API mengembalikan project dari semua workspace user. Kartu project menyebut workspace-nya begitu user punya tim.
- Wizard membuat project di workspace aktif kalau user boleh membuat project di sana, selain itu di workspace pribadi, dan pilihan bisa diganti di wizard. `workspace_id` hanya dikirim untuk workspace tim, karena tanpa parameter API memakai workspace pribadi.
- Resource project membawa `workspace` tanpa peran user. Peran diambil dari `GET app/workspaces` lewat `useProjectAccess()`. Untuk `viewer` halaman project hanya bisa dibaca: tanpa Redeploy, batalkan deployment, tombol tampilkan nilai secret, ubah atau hapus variabel, form pengaturan, dan hapus project. Selama peran di workspace tim belum diketahui, kontrol itu juga disembunyikan supaya tidak sempat muncul. API tetap penentunya dan menolak semua itu dengan `403`.
- Penolakan dibaca dari `code`: `TEAM_LIMIT_EXCEEDED` (batas tim yang dimiliki), `LAST_WORKSPACE_OWNER`, `WORKSPACE_NOT_EMPTY`, `WORKSPACE_IS_PERSONAL`, `ALREADY_WORKSPACE_MEMBER`, `EMAIL_VERIFICATION_REQUIRED`, `INVITATION_EXPIRED`, `INVITATION_ALREADY_ACCEPTED`, `INVITATION_DECLINED`, `INVITATION_REVOKED`, dan `INVITATION_EMAIL_MISMATCH`. Teksnya ada di `features/workspaces/presentation.ts`. Aturan pemilik terakhir juga ditegakkan di UI dari daftar anggota, sebelum ada yang mencoba.
- Email undangan menautkan ke `/workspace-invitations/{id}?token=...` (`WorkspaceInvitationNotification` di API). Halaman itu membaca undangan lewat `GET app/workspace-invitations/{id}?token=` (`getWorkspaceInvitation()`), jadi tautan yang dikirim ke email lain tetap menampilkan nama workspace, peran, pengundang, dan masa berlaku, tanpa alamat undangan. `can_accept` dan `accept_error_code` memberi tahu sebelum diklik kalau akun ini tidak bisa menerimanya: undangan pemilik untuk email lain, sudah menjadi anggota, atau batas tim yang dimiliki. Token yang salah atau tidak lengkap dijawab `404` tanpa `code` apa pun status undangannya; dengan token yang benar, undangan yang sudah diterima, ditolak, dibatalkan, atau kedaluwarsa dijawab `409` dengan kodenya masing-masing, dan setiap kode punya pesannya sendiri.
- Pembacaan itu, menerima, dan menolak berbagi rate limit 5 per menit di API. Karena itu query-nya tidak di-retry dan tidak dimuat ulang saat jendela kembali fokus, memakai `separateRateLimit`, dan key-nya `['workspace-invitation', id, token]` di luar prefix `workspaces`, supaya invalidasi setelah menerima tidak membacanya lagi.
- Notifikasi kategori `workspace` membuka undangannya lewat `invitation_id`, atau timnya lewat `workspace_id` untuk perubahan peran. Notifikasi lama tanpa keduanya membuka `/workspace-invitations`. Halaman notifikasi menampilkan undangan yang tertunda di atas daftar notifikasi.
- `projects_count` dan `active_deployments_count` di resource workspace tampil di switcher dan di halaman tim. Tombol hapus tim tetap membaca `quotas.current_projects_count` dari `pilot-limits`, yang dimuat segar di halaman itu.
- Keluar dari tim atau menghapusnya memanggil `forgetWorkspace()` (`features/workspaces/forget.ts`): tim itu langsung dibuang dari daftar di cache, workspace pribadi menjadi yang aktif (juga yang tersimpan), lalu semua query milik tim itu (anggota, undangan, `pilot-limits?workspace_id=`, dan daftar project yang difilter ke tim itu, dikenali lewat `workspaceIdOfQueryKey()` di `query-keys.ts`) dibatalkan dan dihapus, bukan di-invalidate. Yang disegarkan hanya daftar workspace, daftar project, dan batas. Dulu invalidasi itu membuat Console membaca lagi tim yang sudah tidak bisa diakses dan mendapat `403`, `404`, dan `422`.
- Kalau orang lain mengeluarkan user atau menghapus timnya, query milik tim itu dijawab `403`, `404`, atau `422`. `reportWorkspaceQueryError()` di `query-client.ts` meneruskannya ke `handleWorkspaceAccessLost`, yang membaca ulang daftar workspace dulu, karena `403` bisa juga berarti peran berubah. Kalau tim itu memang hilang dari daftar, Console melupakannya dengan cara yang sama, memberi toast, dan pindah dari halaman tim ke `/projects`. Satu workspace hanya diperiksa sekali dalam satu waktu, jadi rentetan error tidak menjadi loop.
- Pengaturan notifikasi punya kategori `workspace` (undangan dan keanggotaan tim). Email undangan tetap dikirim walaupun kategori itu dimatikan. Schema preferensi ditulis dari resource API, dan `workspace` dibaca `true` kalau API belum mengirimnya, sesuai default-nya.

## Masukan

`POST app/feedback` dipanggil dari `/feedback`, yang bisa membawa `?project=` dan `?deployment=` sebagai konteks yang bisa dilepas user. API menolak masukan yang sama dalam 5 menit dengan `409`, dan teksnya tetap ada di form saat gagal.

## Upload Avatar

PHP hanya mem-parse body multipart pada `POST`. Karena itu `uploadAvatar()` mengirim `POST app/profile` dengan field `_method=PATCH`, dan Laravel meneruskannya ke route `PATCH` yang sama. Field teks tetap memakai `PATCH` dengan JSON.

## Daftar Project

`GET app/projects` mengirim `public_url` dan `latest_deployment`, yang boleh `null` untuk project tanpa deployment. Kartu hanya menautkan URL saat `runtime_status` bernilai `running` atau `sleeping` dan project tidak ditangguhkan, karena membuka URL project yang tidur membangunkannya (`isListedProjectUrlReachable()`). Satu baca daftar berarti satu request untuk enam kartu.

`useProjectListLive()` mengikuti `deployment.updated` di channel `deployment.{id}` untuk setiap deployment yang masih berjalan di halaman itu, jadi tiap tahap membaca ulang daftar, satu request per rentetan event. Channel-nya tetap terbuka selama deployment itu berjalan dan ditutup begitu selesai. `notification.created` di `users.{id}` juga membaca ulang daftar, karena notifikasi itulah yang mengabarkan akhir deployment. API belum punya channel per project atau per user yang mengabarkan deployment baru, jadi deployment yang dimulai dari tempat lain, misalnya webhook, hanya terlihat lewat polling `resolveProjectListPollInterval()`: tanpa realtime 15 detik saat ada yang berjalan dan 60 detik saat tidak, dengan realtime 5 menit sebagai jaring pengaman.

## Project Header

`deriveProjectHeaderState()` di `features/projects/presentation.ts` adalah satu-satunya tempat yang menentukan klaim header project: badge, boleh tidaknya Redeploy, URL, dan pesan. `project.status` tetap `draft` sampai deployment pertama berhasil, dan deployment yang masih `queued` belum mengubah `runtime_status`, jadi fungsi ini juga membaca deployment terbaru.

`useProjectLiveStatus()` mengikuti `deployment.updated` pada deployment yang berjalan, atau pada deployment aktif kalau tidak ada yang berjalan, karena `project_runtime_status` saat crash dikirim ke sana. Polling menjadi cadangannya: 10 detik saat ada deployment berjalan, 60 detik kalau realtime terhubung atau idle.

`sleeping` berarti project ditidurkan karena sepi. Ini perilaku normal: badge "Tidur" bernada `muted`, URL tetap tampil karena membukanya membangunkan project, dan pesannya menyebut jendela sepi dari `project_idle_sleep_minutes` di `GET app/pilot-limits` kalau user anggota workspace itu (`useProjectIdleWindow()`). Tombol Bangunkan (tidak tampil untuk viewer) memanggil `POST app/projects/{project}/wake` lewat `createWakeProjectMutation()`. Jawabannya `202` dengan project yang masih `sleeping`; sampai node melapor, `useProjectWake()` membaca ulang project setiap 5 detik selama paling lama 2 menit, dan `deployment.updated` di channel deployment aktif mempercepatnya kalau realtime terhubung. `PROJECT_WAKE_LIMIT_EXCEEDED` menyebut batas aplikasi aktif beserta angkanya, `PROJECT_SUSPENDED` dan `PROJECT_NOT_SLEEPING` membaca ulang project, dan yang terakhir tidak menampilkan pesan.

## Replika

Project bisa berjalan sebagai beberapa container di belakang router node. `replicas` adalah pengaturan untuk deployment berikutnya, `max_replicas` batas efektif workspace (1 berarti replika belum aktif), `serving_replicas` jumlah yang dijalankan deployment yang sedang melayani, dan `replicas_ready` jumlah yang lolos health check menurut heartbeat. Keempatnya dibaca opsional, dan API lama dianggap 1. Aturan dan copy-nya ada di `features/projects/replicas.ts`.

- Tab Pengaturan punya input angka "Replika" dari 1 sampai `max_replicas`. Saat `max_replicas` 1, input-nya nonaktif dan menyebut "Replika belum aktif untuk workspace ini". Nilainya bagian dari draft pengaturan (`projectConfigErrors()` dan `buildConfigPayload()` di `projectDetailState.svelte.ts`), jadi Simpan dan Redeploy di header sama-sama mengirimnya, dan hanya kalau berubah. Pengaturan yang sudah di atas batas karena admin menurunkannya tidak diperiksa sampai diubah. `422` pada `replicas` tampil di field-nya.
- Setelah tersimpan, API mengembalikan `redeploy_required: true`. Tab Pengaturan dan Environment Variables memakai `RedeployRequiredNotice` yang sama, dengan teks dari `REDEPLOY_REQUIRED_COPY`.
- Header menampilkan "2/3 replika sehat" (`replicas_ready`/`serving_replicas`) di samping status selama project melayani lebih dari satu replika, bernada netral, dan `warning` hanya kalau yang siap lebih sedikit. Sebelum node melapor, header hanya menyebut "3 replika". `deriveProjectHeaderState()` mengisinya di `replicaHealth`.
- `getDeployErrorMessage()` di `presentation.ts` dipakai kedua alur redeploy. `PROJECT_REPLICAS_UNSUPPORTED` menyebut pengaturan Replika di tab Pengaturan, beserta `node_maximum` kalau node punya batas yang lebih kecil, dan `ACTIVE_CONTAINER_LIMIT_EXCEEDED` dengan `requested` lebih dari 1 menyebut jumlah replika dan container. Penolakan lain, atau tanpa angka, memakai teks API. Bangunkan memakai `requested` dari `PROJECT_WAKE_LIMIT_EXCEEDED` dengan cara yang sama.
- Halaman workspace menyebut batas replika per proyek dan bahwa setiap replika dihitung sebagai satu aplikasi aktif. Admin mengatur "Maks. replika" di profil batas (kosong berarti 1, rentang 1 sampai 10 dari `MAX_REPLICAS_RANGE`), melihatnya di kolom "Replika", dan di batas workspace.

`crashed` berarti aplikasi sedang restart atau crash loop, jadi URL tetap tampil dan pesannya bilang URL bisa kadang terbuka. Port yang tampil adalah `serving_port` kalau API mengirimnya, dan `effective_port` ditandai berlaku di deploy berikutnya kalau berbeda.

## Release command

`release_command` dijalankan agent sekali setiap deployment, setelah build dan sebelum versi baru menerima trafik, misalnya untuk migration. Field-nya dibaca opsional, dan API lama dianggap tidak punya. Label dan teks bantuannya ada di `features/projects/build-help.ts`.

- Tab Pengaturan dan langkah Persiapan deployment punya field "Release command" dengan aturan yang sama seperti command lain di `buildConfigurationSchema`. Nilainya bagian dari draft pengaturan, jadi Simpan dan Redeploy mengirimnya hanya kalau berubah, dan mengosongkannya mengirim `null`. Setelah tersimpan, API mengembalikan `redeploy_required: true`.
- `getDeployErrorMessage()` mengganti teks `PROJECT_RELEASE_COMMAND_UNSUPPORTED` dengan pesan yang menyebut field-nya dan bahwa mengosongkannya berarti deploy tanpa perintah itu.
- `release_command_failed` dan `release_command_timeout` punya judul sendiri di `status-config.ts`. Ringkasan dan saran tetap dari API; teks Console hanya dipakai kalau API belum mengenal kodenya (`failure` kosong atau kategori `unknown`).

## Monitoring

Tab Metrik (`/projects/{id}/monitoring`) membaca `GET app/projects/{project}/metrics?range=1h|6h|24h|7d|30d` (gmedia/sakala-api#128). Tipenya di-generate dari branch `feat/project-metrics` sakala-api (PR #175); schema Zod di `api/resources/project-metrics.ts` mengubah `t` (awal step, ISO 8601 UTC) menjadi detik Unix, dan setiap bentuk titik `satisfies` tipe hasil generation. `range` selalu dikirim, karena tanpa parameter API menjawab untuk 1 jam, sedangkan Console memakai 24 jam. `series.per_replica` tidak diminta dan tidak dibaca.

- `cpu_percent` adalah persen dari satu core, dijumlah semua replika, jadi bisa lebih dari 100. Nilainya bacaan sesaat (sekitar 1 detik) yang diambil sekali per menit, bukan rata-rata satu menit penuh, dan catatan di kartu CPU menyebutnya.
- `memory_bytes` juga jumlah semua replika. `memory_limit_bytes` adalah satu angka: jumlah batas replika di step terbaru, `null` tanpa data atau kalau ada replika tanpa batas. Batas itu hanya berlaku selama jumlah replika sama, jadi garis putus-putusnya digambar dari titik memori terbaru ke belakang selama jumlah replika masih sama dengan step terbaru (`memoryChart()` di `features/projects/monitoring/chart-data.ts`), dan catatannya menyebut kalau garis itu tidak mencakup seluruh rentang.
- `restarts` menghitung restart container selama berjalan. Hitungan di agent mulai dari nol setiap container dinyalakan lagi (bangun dari tidur, restart, replika dipulihkan), dan catatan di kartu Restart menyebutnya.
- Titik yang tidak ada adalah celah. `alignColumns()` menyisipkan baris `null` setelah jarak lebih dari 1,5 kali `step_seconds`, jadi garis berhenti di situ dan tidak menyeberangi celah. Titik yang rusak dilewati satu per satu.
- Grafik memakai [uPlot](https://github.com/leeoniya/uPlot) di `TimeSeriesChart.svelte`, satu-satunya tempat library itu dipakai, dan hanya dimuat bersama tab ini. Warnanya dibaca dari token lewat elemen tersembunyi, karena canvas tidak mengerti `var()`, dan setiap garis punya kontras minimal 3:1 terhadap kartu. Canvas disembunyikan dari pembaca layar; setiap kartu adalah `figure` dengan judul dan ringkasan teks (nilai terakhir dan tertinggi dalam rentang) sebagai deskripsinya.
- Rentang ada di query string (`?range=7d`, default `24h` tanpa parameter), lewat `useListUrl()`, jadi bisa dibagikan dan Back membatalkannya.
- Hemat request: tab ini membaca ulang tiap 60 detik hanya untuk rentang sampai 24 jam dan hanya selama `runtime_status` `running`. Rentang 7 dan 30 hari, proyek yang tidur atau berhenti, dan tab di background tidak polling (`resolveMetricsPollInterval()`, `refetchIntervalInBackground` mati). `429` menunggu `Retry-After`. Waktu baca terakhir tampil di atas grafik.
- Proyek yang tidur tidak mengirim sampel, dan tab ini menyebutnya. Kalau semua seri kosong, tab menampilkan "Belum ada data metrik dalam {rentang}" dengan tombol untuk melihat 30 hari terakhir.

## Push yang Dilewati di Riwayat

Di monorepo, push hanya men-deploy proyek yang terkena perubahan (gmedia/sakala-api#181): file yang berubah di folder `root_directory` proyek itu, atau file bersama di luar folder proyek mana pun. Push yang hanya mengubah folder proyek lain tidak menjadi deployment, dan tab Riwayat (`/projects/{id}/deployments`) menampilkannya dari `GET app/projects/{project}/skipped-pushes`. Tipenya di-generate dari branch `feat/selective-push-deploys` sakala-api; yang diambil dari export OpenAPI branch itu hanya path dan schema `SkippedPushResource`, supaya perubahan API lain yang belum dipakai Console tidak ikut.

- Satu request per halaman riwayat: `since` berisi `created_at` deployment tertua di halaman itu dan `per_page=100` (`skippedPushesSince()` di `features/projects/skipped-pushes.ts`). Setiap catatan membawa `after_deployment_id`, yaitu deployment terbaru saat push datang, dan `groupSkippedPushes()` menaruhnya tepat di atas deployment itu. Catatan yang mengikuti deployment di halaman lain ditampilkan di halaman tersebut.
- Pencarian mencari nomor deployment, jadi selama ada pencarian push yang dilewati tidak diminta dan tidak tampil.
- Request ini tidak dicoba ulang dan galatnya diabaikan: API sebelum fitur ini menjawab `404`, dan riwayat deployment tetap utuh tanpa catatan tersebut.
- `SkippedPushRow` memakai grid yang sama dengan `DeploymentRow`, tetapi tenang: lingkaran putus-putus dengan ikon, teks `muted`, tanpa nomor, tanpa link, dan tanpa warna error. Judulnya "Dilewati — tidak ada perubahan di apps/web" dan membungkus di layar sempit supaya nama folder tetap terbaca. Tombol info (popover bits-ui) menjelaskan aturannya dan menampilkan sampai 5 file contoh beserta jumlah sisanya.

## Rollback, Versi yang Melayani, dan Restart

Kontraknya `DeploymentResource.triggered_by`, `rollback`, `rollback_target`, `ProjectResource.auto_deploy_pause` dan `restart`, `POST app/projects/{project}/deployments/{deployment}/rollback`, dan `POST app/projects/{project}/restart` (sakala-api, rollback dan Restart). Semua field ini dibaca opsional, jadi API lama hanya membuat fiturnya tidak tampil. Teks dan aturannya ada di `features/deployments/history-presentation.ts`, `features/deployments/rollback.ts`, `features/projects/auto-deploy-pause.ts`, dan `features/projects/restart.ts`.

- "Sedang melayani" (`isServingDeployment()`) menandai deployment `is_active` selama `runtime_status` `running`, `sleeping`, atau `deploying` (versi lama masih melayani sampai agent pindah). Proyek yang crash, berhenti, gagal, atau belum pernah live tidak punya tanda. Riwayat dan Ringkasan membaca project dari cache yang sama dengan header, tanpa request tambahan.
- Pemicu (`describeDeploymentTrigger()`): di workspace tim memakai `triggered_by.name` ("Rani, redeploy manual", "Bima, push ke main", "Rani, rollback ke #4"); workspace pribadi, nama `null`, dan `kind` `system` memakai label lama. Riwayat hanya menampilkan baris pemicu di workspace tim, dan untuk rollback di workspace mana pun.
- Rollback: menu baris "Kembalikan ke versi ini" hanya untuk baris dengan `rollback_target` dan user yang boleh deploy (`useProjectAccess().readOnly`). Dialog membandingkan versi yang melayani dan tujuan, menyebut bahwa environment variable tetap yang sekarang, apakah image masih tersimpan (`rollback_target.image_expected`), dan jeda auto-deploy kalau `auto_deploy` menyala atau sudah dijeda. Satu `Idempotency-Key` per dialog, diganti setelah penolakan. `DEPLOYMENT_NOT_ROLLBACK_TARGET` dibaca dari `reason`, error deploy lain lewat `getDeployErrorMessage()`. Berhasil membuka halaman deployment baru.
- Banner jeda auto-deploy (`AutoDeployPausedBanner`) tampil selama `auto_deploy_pause` tidak `null`. Nomor versi tujuan diambil dari `rollback.target_sequence` deployment rollback itu (daftar terbaru, atau satu baca deployment). "Nyalakan lagi auto-deploy" mengirim `auto_deploy: true` lewat `createUpdateProjectMutation()`; viewer membaca siapa yang bisa menyalakannya. Selama jeda, Redeploy di header bernama "Redeploy commit terbaru", dan `RedeployRequiredNotice` menjelaskan hal yang sama dengan tombol sekunder. Push yang ditahan (`reason` `auto_deploy_paused` di skipped pushes) tampil sebagai "Ditahan".
- Restart ada di menu Redeploy (Hick, satu aksi utama) selama `runtime_status` `running` atau `crashed`, dengan dialog konfirmasi. Selama `restart` tidak `null`, header menampilkan "Sedang restart" dan `useProjectRestart()` membaca ulang project tiap 5 detik paling lama 2 menit. Hasilnya hanya dikatakan dari `restart.outcome` di broadcast `deployment.updated` untuk command yang diminta halaman itu; polling saja tidak menyimpulkan berhasil. `PROJECT_NOT_RUNNING`, `PROJECT_RUNTIME_BUSY`, dan `PROJECT_SUSPENDED` dibaca dari `code`.

## Ringkasan Proyek

`/projects/{id}` adalah tab Ringkasan, tab pertama halaman proyek. Dulu alamat ini dialihkan ke `/projects/{id}/deployments`; sekarang Riwayat tetap di alamatnya sendiri, dan link lama ke `/deployments` tetap jalan. Tab ini tidak menambah endpoint dan hanya memakai data yang sudah dikirim API:

- Diagram alur pengunjung (`overview/topology.ts`, `TopologyCard.svelte`) berupa kanvas dengan tiga bingkai. "Jaringan" berisi Alamat dari `public_url` atau `default_domain`, dan Sakala Edge. "Region …" memakai `region`; nilai `null` ditulis "otomatis". Bingkai ini berisi Node dan Aplikasi. Aplikasi memakai status yang sama dengan header (`deriveProjectHeaderState()`), port dari `getPortDisplay()`, dan satu titik per replika dari `serving_replicas` dan `replicas_ready` (`deriveReplicaCells()`). "Terpasang" berisi database yang terpasang (kalau `databases` di resource proyek tidak kosong), jumlah environment variable, dan apakah `release_command` diatur. Blok database menampilkan nama dan status database, dan popover-nya menautkan ke halaman database. Tanpa database tidak ada blok pengganti. Setiap blok adalah tombol popover bits-ui yang berisi penjelasan dan link tindakannya. Kotak Sakala Edge mengikuti `SAKALA_EDGE_IN_FRONT` di `src/lib/config/project.ts`.
- Metrik 24 jam memakai `createProjectMetricsQuery()` dengan rentang `24h`, query yang sama dengan default tab Metrik. Grafiknya tiga `TimeSeriesChart` kecil (`compact`, `legend={false}`) dengan kolom dari `chart-data.ts`, jadi celah dan batasnya sama dengan tab Metrik. Komponen grafik di-import secara dinamis, jadi uPlot dimuat setelah angka tampil, dan chunk-nya dipakai bersama tab Metrik. Proyek yang belum pernah di-deploy tidak meminta metrik.
- Deployment terbaru memakai `createRecentDeploymentsQuery()`, query yang sudah dibaca header, lalu menampilkan lima yang terbaru.
- Langkah berikutnya (`overview/next-steps.ts`) paling banyak tiga, dari keadaan nyata: `.env.example` ada (`inspection.env_example_found`) tetapi environment variable kosong, Laravel (`stack.framework`) tanpa `release_command`, auto-deploy mati untuk proyek GitHub App, dan satu replika padahal `max_replicas` lebih dari satu. Viewer dan proyek yang ditangguhkan tidak mendapat saran. Saran yang disembunyikan disimpan per proyek di `localStorage` (`sakala.overview-dismissed-steps.{projectId}`).
- Biaya request saat tab dibuka: project dan deployment terbaru dipakai bersama header, ditambah satu baca environment variable (tanpa polling) dan satu baca metrik, yang polling tiap 60 detik hanya selama proyek `running` dan tab terlihat, sama seperti tab Metrik.

## Database

Database PostgreSQL terkelola milik workspace (ADR-020, bagian "Database" di `docs/API_CONVENTIONS.md` sakala-api), bukan milik proyek. Kontraknya ada di `src/lib/api/resources/databases.ts`: schema Zod yang `satisfies` tipe hasil generation dan diuji terhadap respons asli API di `tests/fixtures/databases/*.json`. Fixture itu diambil dari sakala-api `main` (PR #178) lewat test Pest sekali jalan yang tidak di-commit ke API; password di dalamnya nilai uji acak. Field tambahan pada penolakan dibaca `parseDatabaseRefusal()` di `api/resources/database-refusals.ts`, dan kodenya ada di `DATABASE_ERROR_CODES` (`api/errors.ts`). Teks, status, kuota, dan pemetaan error ada di `features/databases/presentation.ts`.

- `/databases` membaca database workspace aktif (`GET app/workspaces/{workspace}/databases`) dan kuotanya dari `max_databases`, `current_databases_count`, `max_database_storage_mb`, dan `current_database_storage_bytes` di `GET app/pilot-limits`. Keempat field kuota dibaca opsional; API lama tanpa field itu tidak mendapat ringkasan kuota. 1 MB sama dengan 1024 × 1024 byte, seperti `DatabaseSize` di API. Pada 80% kuota penyimpanan tampil "hampir penuh", pada 100% "penuh" (API mengunci semua database workspace). Tombol "Buat database" tidak tampil untuk viewer, dan dialognya menjelaskan alasan sebelum form kalau kuota habis (admin Sakala tidak dibatasi di Console, API yang memutuskan).
- Halaman database di `/databases/{id}?workspace={workspace}`. Workspace ada di query string karena API men-scope database dengan workspace, dan database bisa milik workspace selain yang aktif. Tanpa parameter itu dipakai workspace aktif. Pilihan region "Otomatis" menyebut `default_region` workspace (dari `GET app/workspaces`, sakala-api #180), misalnya "Otomatis (jkt)", atau menjelaskan bahwa Sakala memilih server kalau nilainya `null`. `?project={id}` di daftar menampilkan konteks proyek, memilih region proyek di dialog buat, dan diteruskan ke halaman database, yang membuka dialog pasang dengan proyek itu terpilih begitu database siap.
- Daftar dan halaman database polling tiap 5 detik hanya selama ada database `provisioning` atau `deleting` (`resolveDatabasePollInterval()`), lalu berhenti. API tidak memberi persentase, jadi tahap pembuatan hanya tiga: permintaan diterima, server database membuat, siap.
- Host, port, nama database, dan user datang dari `connection` di `DatabaseResource` (sakala-api #180) dan tampil untuk semua anggota, termasuk viewer; `null` sampai database `ready` atau `locked` dan node melaporkan alamatnya, dan dari API #178 yang belum mengirimnya dibaca `null`. Password dan `DATABASE_URL` (`GET .../credentials`) hanya untuk pemilik workspace dan admin Sakala (`databaseAccess()`). Setiap pembacaan diaudit API, jadi Console membacanya lewat mutation saat tombol "Tampilkan password" ditekan, bukan query: password tidak masuk cache TanStack dan request dikirim dengan `cache: 'no-store'`. "Sembunyikan" dan rotasi membuang nilainya dari state komponen. Anggota dan viewer melihat penjelasan tanpa request apa pun.
- Pasang, lepas, dan rotasi password baru berlaku di deploy berikutnya. Setelah masing-masing, kartu "Proyek terpasang" menampilkan catatan redeploy per proyek dengan link ke tab Variabel proyek itu, tempat `RedeployRequiredNotice` dan tombol Redeploy berada. Dialog pasang memakai daftar proyek workspace yang sama (`per_page` paling banyak 6, pencarian di server). Daftar itu membawa `databases` versi ringan (`id`, `name`, `status`), jadi proyek yang sudah memakai database lain tidak bisa dipilih dan ditandai "memakai <nama>"; field itu dibaca opsional untuk API lama, dan `PROJECT_DATABASE_ALREADY_ATTACHED` tetap dijelaskan dari teks API.
- API belum menyediakan daftar extension yang sudah terpasang atau status permintaan yang sedang berjalan. Kartu Extension hanya menandai yang diminta selama kunjungan itu ("Diminta"), dan kegagalan terakhir dibaca dari `last_failure` dengan `command` `InstallDatabaseExtension`.
- Tab Variabel proyek menampilkan `databases[0].variables` sebagai baris "dari database …" yang nilainya disembunyikan, dan `overridden_variables` sebagai "Ditimpa proyek". Variabel proyek dengan nama yang sama ditandai "Menimpa database" di daftar atas. Proyek Laravel dengan database tanpa release command mendapat petunjuk `php artisan migrate --force` dan link ke panduan release command.
- Kunci cache database ada di bawah `['workspaces', 'databases', workspaceId]`, jadi `workspaceIdOfQueryKey()` mengenalinya dan `forgetWorkspace()` membuangnya saat user keluar dari tim.

## Alasan Penangguhan

Header membaca alasan dari `suspension.reason` di project, dan API mengosongkan `suspension` begitu penangguhan dibuka. Alasan itu ditulis admin, jadi selalu ditampilkan sebagai teks. Kalau nilainya `null`, header menyebut bahwa alasannya ada di notifikasi dan email. Kontak banding `abuse@sakala.dev` ada di `src/lib/config/project.ts`.

## Hemat Request

`throttle:api` mengizinkan 60 request per menit per user, dibagi semua tab. Aturannya:

- Payload realtime langsung masuk cache (`applyRealtimeDeploymentUpdate`, `applyRealtimeDeploymentEvent`), jadi satu langkah deployment tidak memicu request. Baca ulang hanya terjadi saat deployment selesai, karena `failure` dan `is_active` tidak ada di payload, dan digabung lewat `createCoalescedTask` dan `requestProjectRefresh`.
- Selama realtime terhubung, polling deployment dan event hanya tiap 60 detik sebagai jaring pengaman. Tanpa realtime tiap 5 detik.
- Tab di background tidak polling dan menunda baca ulang sampai dilihat, kecuali baca ulang saat deployment selesai (`request({ evenIfHidden: true })`). Payload akhir hanya membawa status, jadi tanpa baca itu halaman menampilkan deployment gagal tanpa penyebabnya, dan Redeploy terkunci karena proyek masih terbaca men-deploy. Biayanya satu kali per deployment.
- GET yang kena `429` mengisi gerbang di `api/rate-limit.ts`. Sampai `Retry-After` habis, GET lain tidak dikirim, termasuk dari tab lain lewat `localStorage`. Write tetap dikirim, dan `429` dari write tidak menutup gerbang karena limit-nya lebih sempit.
- Event deployment hanya bertambah dan API membatasi 10 per halaman, jadi baca ulang melanjutkan dari halaman terakhir (`resumeCursor`), bukan mengulang semua halaman dari awal.
- Unduh data (`separateRateLimit`) punya limit sendiri, jadi tidak ikut gerbang di atas.
- `AuthGuard` menampilkan waktu tunggu dan mencoba lagi sendiri saat `429`.

`request-budget.svelte.spec.ts` mengukur satu tab pada deployment 5 menit dengan timeline tiruan: paling sibuk 9 request per 60 detik dengan realtime, 64 dengan polling saja.

Skema field yang hanya pelengkap tampilan (`metadata`, `*_resources`, `queue_state`) membaca bentuk tak dikenal sebagai `null`, karena PHP mengirim map kosong sebagai `[]`. Baris event atau log yang rusak dilewati satu per satu, bukan menjatuhkan seluruh daftar.

`image_reference` dan `agent_node_id` ikut diparse tetapi sengaja tidak ditampilkan. `image_reference` adalah tag image lokal di node, misalnya `sakala/project-<id>:<sha>`, yang tidak bisa di-pull atau dipakai user. `agent_node_id` adalah ID internal node. Keduanya tidak membantu user memperbaiki apa pun. Yang menandai build sudah tampil, yaitu commit SHA dan nomor deployment, dan link "Kirim masukan" membawa ID deployment, sehingga admin bisa menemukan image dan node-nya dari situ.

### Redeploy tanpa build (image reuse)

`POST app/projects/{id}/deployments` tanpa `force_build` membiarkan API memutuskan: kalau commit, pengaturan build, dan variabel yang dibaca saat build sama dengan deployment aktif, image-nya dipakai ulang. Tombol Redeploy (`RedeployButton`) selalu mengirim tanpa field itu. Menu di sebelahnya, yang hanya muncul kalau proyek punya `active_deployment_id`, berisi "Build ulang dari awal" yang mengirim `force_build: true`. Menu yang sama ada di header proyek dan di banner deployment yang gagal atau dibatalkan; `RedeployRequiredNotice` dan redeploy dari rotasi password database tetap tombol biasa.

Sebelum perubahan variabel disimpan, tab Variabel menyebut apa yang terjadi di redeploy berikutnya, di samping tombol simpan (tambah, ubah, hapus, dan "Tempel dari .env"), lewat `VariableBuildHint`. Tombol simpan merujuk teks itu dengan `aria-describedby`. Keputusannya ada di `decideVariableBuild()` (`features/projects/variable-build.ts`) dari `variable_changes` di resource proyek: `requires_build: true` berarti setiap perubahan variabel proyek memicu build, dengan `reason` `static_site`, `prerender_framework`, atau `unknown_stack`. Untuk server biasa (`requires_build: false`), kunci yang diawali salah satu `build_time_prefixes` (case-sensitive) atau sama dengan salah satu `build_time_keys` memicu build dengan alasan `build_time_prefix`, dan kunci lain memakai ulang image. Satu kunci yang butuh build membuat seluruh batch build. Variabel dari database yang terpasang tidak pernah memicu build, dan proyek tanpa `active_deployment_id` tidak dijanjikan restart karena deploy berikutnya pasti build. API lama tanpa `variable_changes` memakai daftar prefix v0.9.0 dan tidak menyebut apa pun untuk kunci lain. Teksnya ada di `VARIABLE_BUILD_COPY` di `presentation.ts`, dengan nama framework dari `stack.framework` lewat `getFrameworkLabel()`.

`build` di resource deployment (`mode`, `image_source_deployment_id`, `image_source_sequence`, `fallback_reason`) dibaca dengan Zod di `api/resources/deployment.ts`. API lama yang belum mengirimnya dibaca sebagai `built`, dan alasan fallback yang tidak dikenal sebagai `image_unavailable` (`api/resources/deployment-build.ts`). Daftar deployment tidak diparse, jadi di sana `build` opsional. `getImageBuildState()` di `features/deployments/image-reuse-presentation.ts` menggabungkan resource dengan event agent: event `deployment.image.reuse_skipped` sudah dianggap fallback sebelum resource terbaru datang. Deployment `reused` memakai timeline `REUSED_IMAGE_PIPELINE_STAGES`, dengan satu langkah "Memakai image dari deployment #N (tanpa build)" dari event `deployment.image.reused` sebagai pengganti tahap clone, analisis, dan build. Selama release command berjalan API masih `queued`, jadi langkah itu dianggap berjalan begitu event-nya tercatat. Fallback menampilkan catatan netral di atas tahapan, dan Riwayat serta kartu deployment terbaru menulis "Tanpa build · image #N".

## Area Admin

Halaman `/admin/*` memakai endpoint `api/v1/admin` dari `sakala-api`. Kontraknya ada di `src/lib/api/resources/admin/`. Schema Zod di sana ditulis sebelum endpoint admin masuk ke OpenAPI yang di-generate, jadi tetap menjadi kontraknya dan tipe diturunkan dengan `z.infer`. Schema itu diuji terhadap respons yang benar-benar dikirim API (`tests/fixtures/admin/*.json`, diambil dari factory sakala-api lewat test Pest sekali jalan), dan mock e2e (`tests/e2e/fixtures/admin.ts`) menyajikan respons yang sama. Kalau resource admin di API berubah, ambil ulang fixture-nya; `admin.spec.ts` gagal kalau ada fixture sukses yang tidak diuji.

Akses ditentukan API. Console menampilkan menu "Area admin" dan membuka `/admin/*` hanya untuk `role: 'admin'` dari `GET auth/user`; selain itu `AdminGuard` menampilkan halaman 403. Kalau API menjawab 403 di tengah sesi, misalnya peran admin baru dicabut, halaman menampilkan penolakan itu, bukan data kosong.

- Daftar memakai pagination server, 25 baris per halaman. Halaman, pencarian, filter, dan rentang waktu ada di query string (`features/admin/url-state.ts`), jadi tampilan bisa dibagikan dan tombol Back membatalkan filter. Nilai yang akan ditolak API dibuang saat URL dibaca, sehingga tautan rusak membuka daftar tanpa filter.
- Rentang waktu (`7d`, `30d`, `90d`, `custom`, dan `all` di kegagalan dan audit) selalu hari penuh WIB. `to` dari API eksklusif, jadi hari terakhir yang ditampilkan adalah hari sebelumnya. Semua tanggal di area admin ditulis dalam WIB, apa pun zona waktu browser.
- Overview di-cache API 60 detik dan dibaca ulang Console tiap 5 menit; `generated_at` tampil sebagai "Dihitung ...". Kartu "Perlu perhatian" memakai `meta.total` dari daftar masukan berstatus `open` dan node `offline`, satu baris per query.
- Setiap mutasi wajib membawa `reason` (maks. 500) dan melewati `ReasonDialog`, yang menyebut objek dan akibatnya, memberi fokus ke kolom alasan, dan hanya mengirim satu kali. Stop, suspend, unsuspend, dan reconcile juga mengirim `Idempotency-Key` yang dibuat per dialog, jadi mengirim ulang setelah jaringan putus tidak membuat command kedua. `202` berarti command sudah diantrekan, belum selesai.
- `409` tanpa `code` (state proyek tidak mengizinkan) ditampilkan dengan pesan API. `409 LIMIT_PROFILE_IN_USE` menautkan ke daftar workspace yang memakai profil itu.
- Token node dari `POST agents` dan `POST agents/{id}/rotate` hanya disimpan di state dialog, tidak di cache query (mutasinya `gcTime: 0` dan di-`reset()`), dan dialognya baru bisa ditutup setelah admin mencentang "Saya sudah menyimpan token ini".
- Setiap perubahan admin meng-invalidate semua query yang diawali `['admin']`.
- Yang tidak ditampilkan karena API tidak punya datanya: log proses agent, restart agent, alamat IP node, laporan abuse, dan suspend akun pengguna.
