# Panduan UI

Console memakai tiga template halaman, satu anggaran teks, dan satu set ikon. Tujuannya satu: halaman yang mirip terasa sama, dan mahasiswa yang baru pertama kali membuka Console tidak disambut paragraf. Keputusan dasarnya dari maintainer pada 25 November 2026: "Sakala terlalu banyak teks", dan tata letak dipilih untuk seluruh Console, bukan per halaman.

Panduan ini melengkapi aturan UI di [AGENTS.md](../AGENTS.md) (token, komponen, glosarium). Kalau keduanya bertentangan, AGENTS.md yang berlaku.

## Tiga template halaman

Setiap halaman memakai salah satu dari tiga template di `src/lib/components/layout/templates/`. Halaman baru memilih template dulu, baru menyusun isinya.

| Template                   | Komponen            | Untuk                                                                                                 | Bentuk                                                |
| -------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Form dan pengaturan        | `FormPageLayout`    | Pengaturan, detail resource (database, bucket, Valkey, jadwal), form panjang yang dibuka berkali-kali | Kolom isian maksimal 48rem di kiri, panel kanan 18rem |
| Daftar, tabel, log, metrik | `ListPageLayout`    | Daftar resource, riwayat deployment, log, grafik, tabel admin                                         | Lebar penuh, tanpa panel                              |
| Tugas fokus                | `FocusedPageLayout` | Wizard, buat resource, login, onboarding, layar status auth                                           | Satu kolom di tengah, lebar baca                      |

### Form dan pengaturan

```svelte
<FormPageLayout panelLabel="Langkah dan bantuan" {panel} after={dangerZone}>
	<!-- form atau kartu milik resource, urut sesuai cara dikerjakan -->
</FormPageLayout>
```

- Dua kolom hanya kalau sidebar tampil (jendela 1024 px ke atas) dan ruang konten paling tidak 56rem (container query). Sidebar dan jarak tepi memakan sekitar 360 px, jadi dua kolom mulai di jendela sekitar 1260 px; laptop 1280 px dan 1366 px sudah dua kolom. Di bawah 1024 px sidebar menjadi drawer, dan panel tetap bertumpuk walaupun ruangnya cukup, supaya tablet tidak bolak-balik antara satu dan dua kolom.
- Lebih sempit dari itu, semuanya bertumpuk: form, panel, lalu `after`. Panel tidak dipindah ke atas: isinya langkah dan panduan, bukan hal pertama yang dicari, dan form adalah tugas utama halaman itu.
- Satu halaman, satu bagian. Pengaturan yang punya banyak bagian dipecah jadi sub-halaman dengan rute sendiri dan navigasi bagian di atasnya (contoh: `/projects/{id}/settings/general`, `/build`, `/domain`, `/processes`, `/schedules`, `/danger`), supaya tiap halaman pendek dan tidak perlu di-scroll panjang. Alamat lama dengan anchor (`/settings#jadwal`) dialihkan ke sub-halamannya.
- Navigasi bagian membungkus ke baris berikutnya di layar sempit, tidak di-scroll ke samping, jadi semua bagian tetap terlihat di 320 px. Tinggi tautannya 44 px di layar sentuh.
- Dua sub-halaman yang mengedit satu form (Umum dan Build dan start) berbagi satu draft. Pindah halaman tidak menghapus isian; bagian yang masih punya perubahan diberi tanda "belum disimpan" di navigasi, dan tombol Simpan di halaman mana pun menyimpan semuanya sambil menyebutkan halaman lainnya.
- `after` untuk yang harus selalu terakhir, yaitu zona berbahaya. Di layar lebar ia ada di bawah form, di layar sempit di bawah panel.
- Panel tidak sticky. Panel yang lebih tinggi dari layar akan terpotong kalau sticky, dan bagian bawahnya tidak bisa dibaca.

### Panel kanan

Panel memakai komponen di `src/lib/components/panel/`, dengan nama kartu yang sama di semua halaman. Panel tidak memuat fakta resource: status, alamat (termasuk custom domain yang aktif), branch, dan port proyek hanya ada di header proyek, dan fakta resource lain (mode, ukuran, region, jumlah proyek, tanggal dibuat Valkey) ada dalam satu baris badge di bawah namanya. Satu tempat untuk satu fakta.

1. **Berikutnya** (`PanelNextSteps`): paling banyak tiga langkah (`MAX_PANEL_STEPS`), hanya yang berlaku untuk resource ini sekarang. Label maksimal empat kata dan berupa tautan ke tempatnya, di halaman ini atau sub-halaman lain. Kartu hilang kalau tidak ada langkah. Viewer dan resource yang ditangguhkan tidak mendapat langkah. Di halaman proyek setiap langkah punya tombol × ("Sembunyikan langkah ...") kalau halamannya menyimpan pilihan itu: langkah yang disembunyikan tidak kembali untuk proyek itu, disimpan di `localStorage` per user dan per proyek (`useDismissedSteps`, dipakai bersama kartu langkah di Ringkasan proyek). Selama ada langkah yang berlaku tapi disembunyikan, tautan kecil "Tampilkan langkah yang disembunyikan" memunculkan semuanya lagi. Kalau semua langkah disembunyikan, kartu Berikutnya hilang dan tautan itu pindah ke kartu Bantuan; halaman tanpa Bantuan tidak menampilkan panel sama sekali. Setelah menyembunyikan, fokus pindah ke tombol × langkah berikutnya (atau sebelumnya, lalu ke tautan pemulih); setelah memulihkan, fokus ke judul Berikutnya.
2. **Bantuan** (`PanelHelp`): tautan panduan dengan nama pendek, terbuka di tab baru, hanya yang relevan dengan halaman itu. Resource yang belum punya halaman panduan boleh menaruh penjelasan yang dilipat ("Mode cache", "Laravel", "Node.js").

Halaman yang tidak punya langkah dan panduan tidak mendapat panel sama sekali.

Langkah dan isi panel diturunkan dari fungsi murni di modul fitur (`deriveSettingsSteps` di `features/projects/settings-panel.ts`, `deriveValkeySteps` di `features/valkeys/panel.ts`), supaya aturannya bisa diuji tanpa browser.

Panel hanya membaca query yang sudah dipegang halaman atau header. TanStack Query membaginya per key, jadi panel tidak menambah permintaan ke API.

### Daftar, tabel, log, metrik

```svelte
<ListPageLayout {toolbar} controls={showControls ? controls : undefined}>
	<ProjectList ... />
</ListPageLayout>
```

- `toolbar`: satu baris, status di kiri (badge atau meter kuota) dan aksi utama di kanan.
- `controls`: filter dan pencarian, hanya setelah ada yang perlu disaring.
- Daftar kosong pertama kali (first run) boleh keluar dari template dan memakai `EmptyState` atau kartu ajakan, karena di situ teks panjang memang membantu.

### Tugas fokus

```svelte
<FocusedPageLayout>
	<!-- satu tugas, satu tombol utama -->
</FocusedPageLayout>
```

Satu kolom selebar `max-w-reading` di tengah, tanpa panel. Halaman login dan register tetap memakai `AuthSplitLayout`; kolom form di dalamnya mengikuti aturan yang sama.

## Anggaran teks

| Tempat                               | Batas                                                                         |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| Judul kartu atau bagian              | Paling banyak 4 kata                                                          |
| Deskripsi di bawah judul             | Satu baris, sekitar 12 kata                                                   |
| Hint di bawah field                  | Satu kalimat pendek, sebaiknya contoh (`Contoh: apps/web.`)                   |
| Keadaan (tersimpan, menunggu, gagal) | Satu kalimat per keadaan                                                      |
| Status dan kuota                     | Badge atau meter, bukan kalimat                                               |
| Penjelasan lengkap                   | Di balik "Pelajari", tooltip, atau bagian yang dilipat                        |
| Teks panjang                         | Hanya untuk error yang perlu langkah perbaikan, dan layar kosong pertama kali |

Contoh dari halaman Pengaturan proyek: hint release command sebelumnya 50 kata. Sekarang satu baris "Sekali tiap deploy, misalnya migration.", dan penjelasan lengkapnya ada di "Pelajari" bagian Lanjutan.

Kuota yang tidak sedang membatasi apa pun juga masuk "Pelajari". Kuota yang sudah penuh, atau bernilai 0, tetap tampil karena itulah alasan tombolnya mati.

## Ikon

Pakai ikon dari `src/lib/components/icons.ts`, berdasarkan konsepnya, bukan nama Phosphor-nya. Modul itu me-re-export file Phosphor satu per satu, jadi aturan "jangan import dari barrel" di [DEVELOPMENT.md](DEVELOPMENT.md#ikon) tetap terpenuhi.

| Konsep     | Export           | Phosphor        | Arti                      |
| ---------- | ---------------- | --------------- | ------------------------- |
| Proyek     | `ProjectIcon`    | SquaresFour     | Aplikasi yang di-deploy   |
| Database   | `DatabaseIcon`   | Database        | Database terkelola        |
| Bucket     | `BucketIcon`     | Archive         | Object storage            |
| Valkey     | `ValkeyIcon`     | Memory          | Valkey terkelola          |
| Domain     | `DomainIcon`     | Globe           | Alamat dan custom domain  |
| Deploy     | `DeployIcon`     | ArrowsClockwise | Deploy dan redeploy       |
| Worker     | `WorkerIcon`     | Cpu             | Proses worker             |
| Jadwal     | `ScheduleIcon`   | CalendarBlank   | Jadwal dan run            |
| Error      | `ErrorIcon`      | WarningCircle   | Gagal, perlu tindakan     |
| Berhasil   | `SuccessIcon`    | CheckCircle     | Selesai dengan baik       |
| Saran      | `SuggestionIcon` | Lightbulb       | Berikutnya, saran Laravel |
| Panduan    | `GuideIcon`      | BookOpenText    | Bantuan dan dokumentasi   |
| Pengaturan | `SettingsIcon`   | GearSix         | Pengaturan                |

Aturannya:

- Ikon selalu dengan label pendek. Ikon tanpa label hanya untuk aksi universal: salin, hapus, cari, tutup, buka di tab baru. Tombol ikon seperti itu tetap punya `aria-label`.
- Satu ikon, satu arti. Konsep baru yang butuh ikon ditambahkan ke tabel ini dan ke `icons.ts` dulu.
- Paling banyak satu atau dua ikon per kartu. Ikon yang sama di setiap baris daftar dihitung satu.
- Yang belum mengikuti: `ArrowsClockwise` juga dipakai untuk rotasi password dan kunci (database, bucket, Valkey), padahal artinya deploy. Itu perlu ikon sendiri saat halaman-halaman itu dirapikan.

## Status

Status selalu berupa `Badge` dengan teks, tidak bergantung pada warna saja. Kuota berupa badge ("Kuota: 2 dari 5 proyek") atau meter (`StorageBar`), bukan kalimat. Kalimat hanya muncul kalau status itu menghalangi sesuatu, dan isinya langkah yang bisa diambil.

## Progressive disclosure

- `LearnMore` (`src/lib/components/ui/LearnMore.svelte`) untuk penjelasan yang dilipat. Labelnya "Pelajari" dengan topik yang dibacakan pembaca layar ("Pelajari build dan start"), atau nama subjek kalau isinya cara pakai ("Laravel").
- Satu "Pelajari" per bagian, di akhir bagian, bukan satu per field.
- Bagian yang jarang diubah dan bisa menghentikan deploy dilipat seluruhnya (Lanjutan), dan terbuka sendiri kalau sudah berisi nilai atau ada tautan yang menuju ke dalamnya.

## Inventaris rute

Setiap rute Console dipetakan ke satu template. Yang sudah memakai template baru ditandai "Sudah". Sisanya menunggu keputusan maintainer untuk diluncurkan.

| Rute                                                                                                                                                                            | Template  | Status      | Yang perlu dikerjakan                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/projects`                                                                                                                                                                     | Daftar    | Sudah       | Kuota jadi badge, catatan viewer satu kalimat                                                                                                                                                 |
| `/projects/new`                                                                                                                                                                 | Fokus     | Belum       | Wizard sudah satu kolom, tapi rata kiri; pindah ke `FocusedPageLayout` supaya di tengah. Hint build/start memakai teks panjang yang sama dengan Pengaturan dulu                               |
| `/projects/[id]` (Ringkasan)                                                                                                                                                    | Daftar    | Belum       | Kanvas dan grafik sudah lebar penuh; kartu langkah berikutnya bisa memakai `PanelNextSteps` tanpa badan kalimat                                                                               |
| `/projects/[id]/deployments`                                                                                                                                                    | Daftar    | Belum       | Riwayat lebar penuh; cek panjang teks baris push yang dilewati                                                                                                                                |
| `/projects/[id]/deployments/[deploymentId]`                                                                                                                                     | Daftar    | Belum       | Log lebar penuh dengan tahapan di kiri; pertahankan bentuknya, rapikan teks banner gagal                                                                                                      |
| `/projects/[id]/environments`                                                                                                                                                   | Daftar    | Belum       | Tabel variabel lebar penuh; saran `.env.example` dan bagian database/Valkey perlu anggaran teks                                                                                               |
| `/projects/[id]/monitoring`                                                                                                                                                     | Daftar    | Belum       | Grafik lebar penuh; keterangan grafik ke "Pelajari"                                                                                                                                           |
| `/projects/[id]/settings/general`, `/build`, `/domain`, `/processes`, `/schedules`, `/danger`                                                                                   | Form      | Sudah       | Satu sub-halaman per bagian; panel Berikutnya dan Bantuan; hint satu baris. `/settings` mengalihkan ke Umum, atau ke bagian yang disebut anchor lamanya                                       |
| `/projects/[id]/settings/schedules/new`, `.../[scheduleId]/edit`                                                                                                                | Fokus     | Belum       | Form jadwal sudah satu kolom; pindah ke tengah, hint cron ke "Pelajari"                                                                                                                       |
| `/projects/[id]/settings/schedules/[scheduleId]`                                                                                                                                | Form      | Belum       | Riwayat run di kolom kiri; status dan run berikutnya sebagai badge di bawah nama jadwal; panel Berikutnya dan Bantuan                                                                         |
| `/databases`                                                                                                                                                                    | Daftar    | Belum       | Paragraf pengantar jadi satu baris, kuota jadi meter di toolbar                                                                                                                               |
| `/databases/[databaseId]`                                                                                                                                                       | Form      | Belum       | Sudah punya panel kanan sendiri (petunjuk dan pengaturan); samakan dengan Valkey: fakta sebagai badge di bawah nama, pengaturan ke kolom kiri, panel Berikutnya dan Bantuan, hapus di `after` |
| `/buckets`                                                                                                                                                                      | Daftar    | Belum       | Sama dengan `/databases`                                                                                                                                                                      |
| `/buckets/[bucketId]`                                                                                                                                                           | Form      | Belum       | Sama dengan detail database                                                                                                                                                                   |
| `/valkeys`                                                                                                                                                                      | Daftar    | Belum       | Kuota sudah ringkasan; cek panjang teks layar kosong                                                                                                                                          |
| `/valkeys/new`                                                                                                                                                                  | Fokus     | Belum       | Kartu mode sudah ringkas; pindah ke tengah                                                                                                                                                    |
| `/valkeys/[valkeyId]`                                                                                                                                                           | Form      | Sudah       | Fakta (status, mode, ukuran, region, jumlah proyek, tanggal dibuat) satu baris di bawah nama; panel Berikutnya dan Bantuan; penjelasan mode dan cara pakai Laravel dan Node dilipat           |
| `/settings` (akun)                                                                                                                                                              | Form      | Belum       | Tab akun dan notifikasi; panel cukup Bantuan, hapus akun di `after`                                                                                                                           |
| `/workspaces/[workspaceId]`                                                                                                                                                     | Form      | Belum       | Anggota dan undangan di kiri; peran, profil batas, dan kuota sebagai badge atau meter di bawah nama workspace                                                                                 |
| `/notifications`                                                                                                                                                                | Daftar    | Belum       | Daftar notifikasi; sekarang dibatasi lebar baca, tidak perlu lebar penuh untuk teks pendek                                                                                                    |
| `/workspace-invitations`, `/workspace-invitations/[invitationId]`                                                                                                               | Fokus     | Belum       | Satu keputusan (terima atau tolak); pindah ke tengah                                                                                                                                          |
| `/feedback`                                                                                                                                                                     | Fokus     | Belum       | Satu form; pindah ke tengah                                                                                                                                                                   |
| `/onboarding`                                                                                                                                                                   | Fokus     | Belum       | Sudah satu aksi utama; cek teks sambutan                                                                                                                                                      |
| `/login`, `/register`, `/forgot-password`, `/reset-password`                                                                                                                    | Fokus     | Belum       | Tetap `AuthSplitLayout`; kolom form mengikuti anggaran teks                                                                                                                                   |
| `/email-verified`, `/email-changed`, `/notifications/unsubscribe`                                                                                                               | Fokus     | Belum       | `AuthStatusScreen` sudah di tengah; satu kalimat per keadaan                                                                                                                                  |
| `/admin`                                                                                                                                                                        | Daftar    | Belum       | Ringkasan operator lebar penuh                                                                                                                                                                |
| `/admin/projects`, `/admin/users`, `/admin/workspaces`, `/admin/agents`, `/admin/audit`, `/admin/failures`, `/admin/feedback`, `/admin/custom-domains`, `/admin/limit-profiles` | Daftar    | Belum       | Tabel lebar penuh; filter di `controls`                                                                                                                                                       |
| `/admin/projects/[id]`, `/admin/users/[id]`, `/admin/workspaces/[id]`, `/admin/agents/[id]`, `/admin/deployments/[id]`                                                          | Form      | Belum       | Detail dengan aksi operator; status dan batas sebagai badge di bawah nama                                                                                                                     |
| `/admin/limit-profiles/new`, `/admin/limit-profiles/[id]`                                                                                                                       | Form      | Belum       | Form panjang berkelompok; kalau tetap panjang, pecah per kelompok seperti pengaturan proyek                                                                                                   |
| `/`, `/dashboard`, `/auth/github/callback`                                                                                                                                      | Tidak ada | Tidak perlu | Hanya mengalihkan                                                                                                                                                                             |
