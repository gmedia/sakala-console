# Testing

Salin `.env.example` menjadi `.env` dan pasang Chromium sekali per mesin, lalu jalankan test sesuai kebutuhan. Test tidak butuh `sakala-api`, karena API-nya di-mock.

```bash
pnpm exec playwright install chromium

pnpm test:unit        # Vitest di Node
pnpm test:component   # Vitest Browser dengan Chromium
pnpm test:e2e         # Playwright, build dan preview otomatis
```

## Unit

Gunakan Vitest node untuk utility, parsing, API error mapping, query key, dan logic tanpa browser.

Schema workspace diuji terhadap respons asli sakala-api di `tests/fixtures/workspaces`, yang dibaca lewat `src/lib/testing/workspace-fixtures.ts`. Component test dan mock e2e (`tests/e2e/fixtures/workspaces.ts`) memakai fixture yang sama, jadi bentuk respons dan pesan error-nya tidak dikarang ulang.

Schema database diuji dengan cara yang sama terhadap `tests/fixtures/databases`, lewat `src/lib/testing/database-fixtures.ts`. `errorFromDatabaseFixture()` ikut membawa field tambahan penolakan (`limit`, `projects`, `database_region`) ke `ApiError.details`. Mock e2e `tests/e2e/fixtures/databases.ts` memakai fixture yang sama dan menyimpan perubahan di memori, jadi buat, pasang, lepas, dan hapus terlihat di baca berikutnya seperti di API.

Schema bucket diuji dengan cara yang sama terhadap `tests/fixtures/buckets`, lewat `src/lib/testing/bucket-fixtures.ts`. Fixture itu diambil dari branch gmedia/sakala-api#204 lewat test Pest sekali jalan yang tidak di-commit ke API, termasuk penolakan dengan field tambahannya (`limit`, `limit_mb`, `current_mb`, `requested_mb`, `bucket`). Mock e2e `tests/e2e/fixtures/buckets.ts` memakai fixture yang sama dan menyimpan perubahan di memori.

Schema worker dan jadwal (ADR-022) diuji terhadap `tests/fixtures/workloads`, lewat `src/lib/testing/workload-fixtures.ts`. Fixture itu diambil dari sakala-api main ea7287b lewat test Pest sekali jalan yang tidak di-commit, dengan flag menyala kecuali yang berakhiran `-off`. Test aturan form membandingkan pesan Console dengan pesan validasi API di fixture, jadi perbedaan kata ketahuan. Mock e2e `tests/e2e/fixtures/workloads.ts` memakai fixture yang sama dan menyimpan perubahan di memori.

## Component

Gunakan Vitest Browser + Playwright untuk behavior component yang membutuhkan DOM. Jangan menguji detail class visual yang mudah berubah; uji role, label, state, dan interaction.

Import ikon satu per satu (`phosphor-svelte/lib/Check`), dan ESLint menolak import dari barrel. Barrel `phosphor-svelte` di-prebundle Vite menjadi 20 MB JavaScript, dan dengan cache Vite yang kosong, seperti di CI, renderer Chromium crash di 8 dari 10 run dengan pesan `Browser connection was closed`. Kalau pesan itu muncul di mesinmu, cek dulu apakah ada import dari barrel. Untuk mengulang kondisi CI, hapus `node_modules/.vite` lalu jalankan `pnpm test:component`.

## End-to-End

Gunakan Playwright untuk user flow bernilai tinggi: login redirect, protected route, create project, deployment progress, dan error recovery. API dapat di-mock pada console test sampai integration environment tersedia.

Mock harus memakai bentuk respons API yang sebenarnya, bukan bentuk yang paling rapi. Misalnya PHP mengirim map kosong sebagai `[]`, jadi `metadata` di fixture event ditulis `[]`, bukan `null`. Mock yang terlalu rapi pernah meloloskan timeline yang rusak di semua deployment sungguhan.

CI memasang Chromium sekali, lalu menjalankan unit, component, build, dan E2E test.

`tests/e2e/a11y-floor.spec.ts` membuka semua route di lebar 320, 768, 1024, 1280, dan 1366 px, dengan data biasa dan string sangat panjang, lalu mengukur DOM yang benar-benar dirender lewat `tests/e2e/fixtures/dom-audit.ts`: tidak ada yang melewati viewport, kontras teks 4,5:1, tepi input 3:1, target minimal 24 px (44 px untuk aksi utama di bawah 768 px), satu `h1`, satu `main`, dan `<title>` sendiri. Spec yang sama berjalan lewat keyboard: skip link, focus trap drawer, focus yang terlihat, dan debounce pencarian.

`tests/e2e/runtime-config.spec.ts` mengganti `/runtime-config.js` dan memastikan bundle hasil build memanggil API yang disebut di sana. Entrypoint container diuji tanpa Docker di `src/lib/config/entrypoint.spec.ts`, dan terhadap image sungguhan lewat `tests/container/runtime-config.sh` (butuh Docker, tidak dijalankan CI; tambahkan `BROWSER=1` untuk cek Chromium). Skrip yang sama memastikan file yang tidak ada di bawah `/_app/` dijawab `404` tanpa `text/html`, sementara deep link tetap mendapat `index.html` dengan `Cache-Control: no-cache`.

`tests/e2e/databases.spec.ts` menjalankan perjalanan database: daftar dan status, buat (termasuk penolakan kuota), pasang dan lepas, hapus yang diblokir, kredensial per peran, rotasi password, extension, sisi proyek, dan audit DOM di 320 dan 1280 px. Screenshot untuk PR ditulis kalau `DATABASE_SCREENSHOTS` berisi folder tujuan, misalnya `DATABASE_SCREENSHOTS=/tmp/console-databases-screens pnpm test:e2e tests/e2e/databases.spec.ts`; tanpa itu test screenshot dilewati.

`tests/e2e/buckets.spec.ts` menjalankan perjalanan bucket: kapan menu Bucket muncul (API tanpa bucket, kuota 0, server tanpa penyimpanan), daftar dan kuota, buat (juga dari proyek dengan `project_id`), pasang, secret key per peran, rotasi dengan redeploy dan status `unknown`, ubah kuota, lepas lalu hapus, tab Variabel, dan audit DOM di 320 dan 1280 px. Screenshot ditulis kalau `BUCKET_SCREENSHOTS` berisi folder tujuan.

`tests/e2e/workers.spec.ts` dan `tests/e2e/schedules.spec.ts` menjalankan perjalanan ADR-022: flag mati (tidak ada yang baru dan tidak ada request), daftar worker dengan crash, tambah worker dari saran Laravel dengan keyboard, viewer, filter proses di log, daftar dan buat jadwal dengan pratinjau WIB, riwayat run dengan run gagal dan terlewat, log run, Run now dan penolakannya, Stop run, jadwal yang dijeda otomatis, 320 px, dan audit DOM di 320 dan 1280 px. Screenshot ditulis kalau `WORKLOAD_SCREENSHOTS` berisi folder tujuan.

`tests/e2e/admin.spec.ts` menjalankan perjalanan utama area admin terhadap `tests/e2e/fixtures/admin.ts`, mock yang menyajikan respons asli API dari `tests/fixtures/admin`, termasuk penolakan untuk akun bukan admin. Spec yang sama mengukur semua halaman admin di 320 dan 1280 px dengan `auditDom`.

Token warna diuji terpisah di `src/lib/design-tokens.spec.ts`, jadi perubahan nilai di `app.css` yang menjatuhkan kontras gagal tanpa perlu browser.

## Tip: host dengan jaringan tidak stabil

Ini opsional. Kalau jaringan host sering putus dan test browser ikut gagal, jalankan test di network namespace yang hanya punya loopback, dengan batas waktu supaya tidak menggantung:

```bash
timeout 400 unshare -rn bash -c 'ip link set lo up; exec pnpm -s test:component'
```

Perintah yang sama berlaku untuk `test:e2e`, dengan syarat folder `build/` sudah ada dan server preview dijalankan di namespace yang sama. Instalasi Chromium tetap perlu dilakukan di luar namespace, karena di dalamnya tidak ada internet.
