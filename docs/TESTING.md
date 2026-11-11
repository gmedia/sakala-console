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

## Component

Gunakan Vitest Browser + Playwright untuk behavior component yang membutuhkan DOM. Jangan menguji detail class visual yang mudah berubah; uji role, label, state, dan interaction.

Import ikon satu per satu (`phosphor-svelte/lib/Check`), dan ESLint menolak import dari barrel. Barrel `phosphor-svelte` di-prebundle Vite menjadi 20 MB JavaScript, dan dengan cache Vite yang kosong, seperti di CI, renderer Chromium crash di 8 dari 10 run dengan pesan `Browser connection was closed`. Kalau pesan itu muncul di mesinmu, cek dulu apakah ada import dari barrel. Untuk mengulang kondisi CI, hapus `node_modules/.vite` lalu jalankan `pnpm test:component`.

## End-to-End

Gunakan Playwright untuk user flow bernilai tinggi: login redirect, protected route, create project, deployment progress, dan error recovery. API dapat di-mock pada console test sampai integration environment tersedia.

Mock harus memakai bentuk respons API yang sebenarnya, bukan bentuk yang paling rapi. Misalnya PHP mengirim map kosong sebagai `[]`, jadi `metadata` di fixture event ditulis `[]`, bukan `null`. Mock yang terlalu rapi pernah meloloskan timeline yang rusak di semua deployment sungguhan.

CI memasang Chromium sekali, lalu menjalankan unit, component, build, dan E2E test.

`tests/e2e/a11y-floor.spec.ts` membuka semua route di lebar 320, 768, 1024, 1280, dan 1366 px, dengan data biasa dan string sangat panjang, lalu mengukur DOM yang benar-benar dirender lewat `tests/e2e/fixtures/dom-audit.ts`: tidak ada yang melewati viewport, kontras teks 4,5:1, tepi input 3:1, target minimal 24 px (44 px untuk aksi utama di bawah 768 px), satu `h1`, satu `main`, dan `<title>` sendiri. Spec yang sama berjalan lewat keyboard: skip link, focus trap drawer, focus yang terlihat, dan debounce pencarian.

`tests/e2e/runtime-config.spec.ts` mengganti `/runtime-config.js` dan memastikan bundle hasil build memanggil API yang disebut di sana. Entrypoint container diuji tanpa Docker di `src/lib/config/entrypoint.spec.ts`, dan terhadap image sungguhan lewat `tests/container/runtime-config.sh` (butuh Docker, tidak dijalankan CI; tambahkan `BROWSER=1` untuk cek Chromium).

Token warna diuji terpisah di `src/lib/design-tokens.spec.ts`, jadi perubahan nilai di `app.css` yang menjatuhkan kontras gagal tanpa perlu browser.

## Tip: host dengan jaringan tidak stabil

Ini opsional. Kalau jaringan host sering putus dan test browser ikut gagal, jalankan test di network namespace yang hanya punya loopback, dengan batas waktu supaya tidak menggantung:

```bash
timeout 400 unshare -rn bash -c 'ip link set lo up; exec pnpm -s test:component'
```

Perintah yang sama berlaku untuk `test:e2e`, dengan syarat folder `build/` sudah ada dan server preview dijalankan di namespace yang sama. Instalasi Chromium tetap perlu dilakukan di luar namespace, karena di dalamnya tidak ada internet.
