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
- `after` untuk yang harus selalu terakhir, yaitu zona berbahaya. Di layar lebar ia ada di bawah form, di layar sempit di bawah panel. Zona berbahaya satu baris: judul dan satu kalimat di kiri, tombol di kanan, alasan tombol mati di bawahnya.
- Edit satu field yang jarang dipakai (ganti nama, ukuran, kuota) tidak mendapat kartu sendiri. Ia jadi aksi "Ubah" (`InlineEditButton`, ikon `EditIcon`) di samping nilainya, di baris judul atau baris fakta, dan membuka editor kecil tepat di bawah nilai itu (`InlineEditor`, `InlineRenameForm`). Fokus masuk ke field, Escape atau Batal menutup dan mengembalikan fokus ke "Ubah", dan setelah tersimpan editor tertutup sendiri. Validasi, pesan, dan permintaan ke API sama dengan form biasa; viewer tidak melihat tombolnya. Langkah panel yang menuju edit itu ("Perbesar ukuran", "Naikkan kuota") menaut ke anchor di samping nilai dan membuka editornya (`openAtAnchor`). Form yang dibuka berkali-kali atau punya banyak field tetap kartu atau halaman sendiri.
- Panel tidak sticky. Panel yang lebih tinggi dari layar akan terpotong kalau sticky, dan bagian bawahnya tidak bisa dibaca.

### Panel kanan

Panel memakai komponen di `src/lib/components/panel/`, dengan nama kartu yang sama di semua halaman. Panel tidak memuat fakta resource: status, alamat (termasuk custom domain yang aktif), branch, dan port proyek hanya ada di header proyek, dan fakta resource lain (status, mesin atau jenis, ukuran atau kuota, region, jumlah proyek, tanggal dibuat untuk Valkey, database, dan bucket) ada dalam satu baris badge di bawah namanya. Satu tempat untuk satu fakta.

1. **Berikutnya** (`PanelNextSteps`): paling banyak tiga langkah (`MAX_PANEL_STEPS`), hanya yang berlaku untuk resource ini sekarang. Label maksimal empat kata dan berupa tautan ke tempatnya, di halaman ini atau sub-halaman lain. Kartu hilang kalau tidak ada langkah. Viewer dan resource yang ditangguhkan tidak mendapat langkah. Langkah yang hilang sendiri begitu dikerjakan (pasang ke proyek, perbesar ukuran, naikkan kuota di Valkey, database, dan bucket) tidak diberi ×, karena tidak ada yang perlu diingat. Di halaman proyek setiap langkah punya tombol × ("Sembunyikan langkah ...") kalau halamannya menyimpan pilihan itu: langkah yang disembunyikan tidak kembali untuk proyek itu, disimpan di `localStorage` per user dan per proyek (`useDismissedSteps`, dipakai bersama kartu Berikutnya di Ringkasan proyek, yang memakai `PanelNextSteps` yang sama di kolom kanannya). Selama ada langkah yang berlaku tapi disembunyikan, tautan kecil "Tampilkan langkah yang disembunyikan" memunculkan semuanya lagi. Kalau semua langkah disembunyikan, kartu Berikutnya hilang dan tautan itu pindah ke kartu Bantuan; halaman tanpa Bantuan tidak menampilkan panel sama sekali. Setelah menyembunyikan, fokus pindah ke tombol × langkah berikutnya (atau sebelumnya, lalu ke tautan pemulih); setelah memulihkan, fokus ke judul Berikutnya.
2. **Bantuan** (`PanelHelp`): tautan panduan dengan nama pendek, terbuka di tab baru, hanya yang relevan dengan halaman itu. Resource yang belum punya halaman panduan boleh menaruh penjelasan yang dilipat ("Mode cache", "Laravel", "Node.js").

Halaman yang tidak punya langkah dan panduan tidak mendapat panel sama sekali.

Langkah dan isi panel diturunkan dari fungsi murni di modul fitur (`deriveNextSteps` di `features/projects/overview/next-steps.ts` untuk Ringkasan proyek, `deriveSettingsSteps` di `features/projects/settings-panel.ts`, `deriveValkeySteps` di `features/valkeys/panel.ts`, `deriveDatabaseSteps` di `features/databases/panel.ts`, `deriveBucketSteps` di `features/buckets/panel.ts`, `deriveScheduleSteps` di `features/workloads/schedule-panel.ts`), supaya aturannya bisa diuji tanpa browser.

Panel hanya membaca query yang sudah dipegang halaman atau header. TanStack Query membaginya per key, jadi panel tidak menambah permintaan ke API.

### Daftar, tabel, log, metrik

```svelte
<ListPageLayout {toolbar} controls={showControls ? controls : undefined}>
	<ProjectList ... />
</ListPageLayout>
```

- `toolbar`: satu baris, status di kiri (badge atau meter kuota) dan aksi utama di kanan.
- `controls`: filter dan pencarian, hanya setelah ada yang perlu disaring.
- `fill`: halaman log (detail deployment) mengisi tinggi jendela dari 1024 px ke atas, supaya log berakhir di tepi bawah jendela dan di-scroll di dalamnya. Jarak antarbaris lebih rapat, supaya tingginya untuk log.
- Variabel yang diisi Sakala dari database, bucket, atau Valkey (`InjectedVariables`) memakai satu kalimat di bawah judul sumbernya. Nilainya tampil tersembunyi seperti secret, hanya baris yang ditimpa variabel proyek yang mendapat badge, dan penjelasannya di "Pelajari".
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

Penjelasan sejenis memakai ukuran huruf yang sama di semua halaman; yang boleh berbeda hanya warnanya, untuk membedakan konteks dari error (keputusan maintainer, 26 November 2026):

| Jenis teks                                                             | Ukuran    |
| ---------------------------------------------------------------------- | --------- |
| Deskripsi kartu, kalimat keadaan, alasan tombol mati, error form       | `text-sm` |
| Hint dan error di bawah field (`FormField`), detail baris dalam daftar | `text-xs` |
| Badge                                                                  | `text-xs` |

## Ikon

Pakai ikon dari `src/lib/components/icons.ts`, berdasarkan konsepnya, bukan nama Phosphor-nya. Modul itu me-re-export file Phosphor satu per satu, jadi aturan "jangan import dari barrel" di [DEVELOPMENT.md](DEVELOPMENT.md#ikon) tetap terpenuhi.

| Konsep     | Export                 | Phosphor        | Arti                                |
| ---------- | ---------------------- | --------------- | ----------------------------------- |
| Proyek     | `ProjectIcon`          | SquaresFour     | Aplikasi yang di-deploy             |
| Database   | `DatabaseIcon`         | Database        | Database terkelola                  |
| Bucket     | `BucketIcon`           | Archive         | Object storage                      |
| Valkey     | `ValkeyIcon`           | Memory          | Valkey terkelola                    |
| Domain     | `DomainIcon`           | Globe           | Alamat dan custom domain            |
| Deploy     | `DeployIcon`           | ArrowsClockwise | Deploy dan redeploy                 |
| Rotasi     | `RotateCredentialIcon` | Key             | Ganti password atau secret key      |
| Ubah       | `EditIcon`             | PencilSimple    | Buka editor inline di samping nilai |
| Worker     | `WorkerIcon`           | Cpu             | Proses worker                       |
| Jadwal     | `ScheduleIcon`         | CalendarBlank   | Jadwal dan run                      |
| Jalankan   | `RunIcon`              | Play            | Jalankan sekarang, aktifkan lagi    |
| Jeda       | `PauseIcon`            | Pause           | Jeda jadwal                         |
| Error      | `ErrorIcon`            | WarningCircle   | Gagal, perlu tindakan               |
| Berhasil   | `SuccessIcon`          | CheckCircle     | Selesai dengan baik                 |
| Saran      | `SuggestionIcon`       | Lightbulb       | Berikutnya, saran Laravel           |
| Panduan    | `GuideIcon`            | BookOpenText    | Bantuan dan dokumentasi             |
| Pengaturan | `SettingsIcon`         | GearSix         | Pengaturan                          |

Aturannya:

- Ikon selalu dengan label pendek. Ikon tanpa label hanya untuk aksi universal: salin, hapus, cari, tutup, buka di tab baru. Tombol ikon seperti itu tetap punya `aria-label`.
- Satu ikon, satu arti. Konsep baru yang butuh ikon ditambahkan ke tabel ini dan ke `icons.ts` dulu.
- Paling banyak satu atau dua ikon per kartu. Ikon yang sama di setiap baris daftar dihitung satu.
- Ganti password dan secret key (database, bucket, Valkey) memakai `RotateCredentialIcon`, bukan panah melingkar, sejak gelombang kedua (26 November 2026).
- Jalankan sekarang dan Aktifkan lagi memakai `RunIcon`, Jeda memakai `PauseIcon` (gelombang ketiga, 26 November 2026).
- Yang belum mengikuti: `ArrowsClockwise` masih dipakai untuk "Muat ulang" di admin (Ringkasan operator, detail proyek), halaman error, `AuthGuard`, dan status yang sedang berjalan di `StatusIndicator`. Muat ulang perlu konsep sendiri (misalnya `ArrowClockwise` satu panah) saat halaman admin dirapikan.

## Status

Status selalu berupa `Badge` dengan teks, tidak bergantung pada warna saja. Kuota berupa badge ("Kuota: 2 dari 5 proyek") atau meter (`StorageBar`), bukan kalimat. Kalimat hanya muncul kalau status itu menghalangi sesuatu, dan isinya langkah yang bisa diambil.

## Progressive disclosure

- `LearnMore` (`src/lib/components/ui/LearnMore.svelte`) untuk penjelasan yang dilipat. Labelnya "Pelajari" dengan topik yang dibacakan pembaca layar ("Pelajari build dan start"), atau nama subjek kalau isinya cara pakai ("Laravel").
- Satu "Pelajari" per bagian, di akhir bagian, bukan satu per field.
- Bagian yang jarang diubah dan bisa menghentikan deploy dilipat seluruhnya (Lanjutan), dan terbuka sendiri kalau sudah berisi nilai atau ada tautan yang menuju ke dalamnya.

## Inventaris rute

Setiap rute Console dipetakan ke satu template. Yang sudah memakai template baru ditandai "Sudah". Sisanya menunggu keputusan maintainer untuk diluncurkan.

| Rute                                                                                                                                                                            | Template  | Status      | Yang perlu dikerjakan                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/projects`                                                                                                                                                                     | Daftar    | Sudah       | Kuota jadi badge, catatan viewer satu kalimat                                                                                                                                                                                                                                                                                   |
| `/projects/new`                                                                                                                                                                 | Fokus     | Sudah       | `FocusedPageLayout`, wizard di tengah; tanpa kalimat pembuka di langkah repository; kuota jadi badge; hint nama, environment variable, auto-deploy, dan isian Pengaturan lanjutan satu baris seperti Pengaturan > Build, penjelasan lengkap (port, command, auto-deploy, batas pilot) di "Pelajari"                             |
| `/projects/[id]` (Ringkasan)                                                                                                                                                    | Daftar    | Sudah       | `ListPageLayout`; diagram dan grafik tetap lebar penuh; judul diagram tanpa baris pengantar; langkah berikutnya memakai `PanelNextSteps` ("Berikutnya", label empat kata, tanpa badan kalimat, × dan "Tampilkan langkah yang disembunyikan" seperti di Pengaturan); status, alamat, dan Redeploy tetap di header                |
| `/projects/[id]/deployments`                                                                                                                                                    | Daftar    | Sudah       | Filter waktu dan pencarian di `controls`, hanya kalau riwayatnya lebih dari satu halaman; baris push yang dilewati atau ditahan tidak mengulang statusnya di judul, penjelasannya dua kalimat dengan tautan panduan monorepo                                                                                                    |
| `/projects/[id]/deployments/[deploymentId]`                                                                                                                                     | Daftar    | Sudah       | `ListPageLayout fill`: breadcrumb dan pesan commit di toolbar, tahapan di kiri dan log lebar penuh seperti sebelumnya; pemberitahuan data tertinggal satu kalimat. Banner gagal tetap memakai teks dari katalog error API, karena itu error yang perlu langkah perbaikan                                                        |
| `/projects/[id]/environments`                                                                                                                                                   | Daftar    | Sudah       | Lebar penuh; satu baris per variabel dengan badge Secret dan Menimpa; tombol tambah di bawah daftar selebar labelnya; bagian database, bucket, dan Valkey satu kalimat, nilai tersembunyi, penjelasan di "Pelajari"                                                                                                             |
| `/projects/[id]/monitoring`                                                                                                                                                     | Daftar    | Sudah       | Waktu pembaruan dan rentang di toolbar; cara menghitung CPU dan restart di "Pelajari" pada kartunya; batas memori tetap tampil karena itu garis di grafiknya                                                                                                                                                                    |
| `/projects/[id]/settings/general`, `/build`, `/domain`, `/processes`, `/schedules`, `/danger`                                                                                   | Form      | Sudah       | Satu sub-halaman per bagian; panel Berikutnya dan Bantuan; hint satu baris. `/settings` mengalihkan ke Umum, atau ke bagian yang disebut anchor lamanya                                                                                                                                                                         |
| `/projects/[id]/settings/schedules/new`, `.../[scheduleId]/edit`                                                                                                                | Fokus     | Sudah       | `FocusedPageLayout`; hint perintah dan ekspresi cron satu baris ("Contoh: 30 2 * * *."), format cron dan cara perintah dijalankan di satu "Pelajari" di akhir bagian Kapan; nama tanpa hint, label "Pilihan cepat" hanya untuk pembaca layar                                                                                    |
| `/projects/[id]/settings/schedules/[scheduleId]`                                                                                                                                | Form      | Sudah       | Status, waktu, run berikutnya, dan batas waktu satu baris di bawah nama; ganti nama dan batas waktu lewat "Ubah"; "Ubah jadwal" untuk form lengkap; riwayat run satu baris per run; panel Berikutnya ("Lihat run gagal") dan Bantuan (cara jadwal berjalan, riwayat dan log dilipat); hapus di `after`                          |
| `/databases`                                                                                                                                                                    | Daftar    | Sudah       | Pengantar satu baris dan kuota (badge jumlah dan meter penyimpanan) di toolbar sebelah tombol buat; kalimat hanya saat kuota menghalangi                                                                                                                                                                                        |
| `/databases/[databaseId]`                                                                                                                                                       | Form      | Sudah       | Fakta (status, PostgreSQL, region, jumlah proyek, tanggal dibuat) satu baris di bawah nama; ganti nama lewat "Ubah" di samping nama; hapus di `after`; panel Berikutnya (tanpa ×) dan Bantuan (panduan database, release command, cara migration dilipat)                                                                       |
| `/buckets`                                                                                                                                                                      | Daftar    | Sudah       | Sama dengan `/databases`; meter memakai jatah yang dialokasikan, dengan jumlah terpakai di bawahnya                                                                                                                                                                                                                             |
| `/buckets/[bucketId]`                                                                                                                                                           | Form      | Sudah       | Fakta (status, S3 privat, kuota, region, jumlah proyek, tanggal dibuat) satu baris di bawah nama; ganti nama dan kuota lewat "Ubah" di samping nilainya; hapus di `after`; panel Berikutnya (pasang, naikkan kuota) dan Bantuan (panduan bucket, Laravel dan backup dilipat)                                                    |
| `/valkeys`                                                                                                                                                                      | Daftar    | Sudah       | Sama dengan `/databases` dan `/buckets`: pengantar satu baris, kuota (badge jumlah dan meter memori) di toolbar sebelah tombol buat; layar kosong pertama kali tetap memakai penjelasan lengkap                                                                                                                                 |
| `/valkeys/new`                                                                                                                                                                  | Fokus     | Sudah       | `FocusedPageLayout`; deskripsi satu baris; hint ukuran dan region pendek; jaringan privat, alasan region, dan cara jatah memori dicadangkan di "Pelajari"                                                                                                                                                                       |
| `/valkeys/[valkeyId]`                                                                                                                                                           | Form      | Sudah       | Fakta (status, mode, ukuran, region, jumlah proyek, tanggal dibuat) satu baris di bawah nama; ganti nama dan ukuran lewat "Ubah" di samping nilainya; hapus di `after`; panel Berikutnya dan Bantuan; penjelasan mode dan cara pakai Laravel dan Node dilipat                                                                   |
| `/settings` (akun)                                                                                                                                                              | Form      | Sudah       | Navigasi bagian (Profil, Akun dan keamanan, Notifikasi) membungkus seperti pengaturan proyek, alamat `?tab=` tetap; panel cukup Bantuan (privasi, syarat, penggunaan wajar); hapus akun di `after` hanya di Akun dan keamanan; email dan tanggal bergabung satu baris di bawah foto; Notifikasi satu kartu dengan tiga kelompok |
| `/workspaces/[workspaceId]`                                                                                                                                                     | Form      | Sudah       | Peran, "Workspace tim", profil batas, dan pemakaian ("1 dari 5 proyek") sebagai badge di bawah nama; ganti nama lewat "Ubah"; anggota dan undangan di kiri, tombol undang di kartu anggota; Bantuan berisi panduan Batas pilot, peran dan cara batas berlaku dilipat; keluar dan hapus di `after`                               |
| `/notifications`                                                                                                                                                                | Daftar    | Sudah       | Template daftar di dalam lebar baca: filter di kiri dan tandai semua di kanan toolbar, undangan yang menunggu di atasnya                                                                                                                                                                                                        |
| `/workspace-invitations`, `/workspace-invitations/[invitationId]`                                                                                                               | Fokus     | Sudah       | `FocusedPageLayout`; pengundang, peran, dan masa berlaku satu kalimat                                                                                                                                                                                                                                                           |
| `/feedback`                                                                                                                                                                     | Fokus     | Sudah       | `FocusedPageLayout`; tanpa kalimat pembuka, peringatan data sensitif satu kalimat, hint jumlah karakter                                                                                                                                                                                                                         |
| `/onboarding`                                                                                                                                                                   | Fokus     | Sudah       | `FocusedPageLayout`; yang bisa dilakukan jadi tiga langkah bernomor tanpa ikon, tautan panduan satu kalimat                                                                                                                                                                                                                     |
| `/login`, `/register`, `/forgot-password`, `/reset-password`                                                                                                                    | Fokus     | Sudah       | Tetap `AuthSplitLayout`; deskripsi satu baris, keadaan (terkirim, tautan tidak lengkap) satu kalimat; persetujuan syarat dan Pemberitahuan Privasi saat daftar tidak diubah                                                                                                                                                     |
| `/email-verified`, `/email-changed`, `/notifications/unsubscribe`                                                                                                               | Fokus     | Sudah       | `AuthStatusScreen`; satu kalimat per keadaan, judulnya yang menyebut hasilnya                                                                                                                                                                                                                                                   |
| `/admin`                                                                                                                                                                        | Daftar    | Belum       | Ringkasan operator lebar penuh                                                                                                                                                                                                                                                                                                  |
| `/admin/projects`, `/admin/users`, `/admin/workspaces`, `/admin/agents`, `/admin/audit`, `/admin/failures`, `/admin/feedback`, `/admin/custom-domains`, `/admin/limit-profiles` | Daftar    | Belum       | Tabel lebar penuh; filter di `controls`                                                                                                                                                                                                                                                                                         |
| `/admin/projects/[id]`, `/admin/users/[id]`, `/admin/workspaces/[id]`, `/admin/agents/[id]`, `/admin/deployments/[id]`                                                          | Form      | Belum       | Detail dengan aksi operator; status dan batas sebagai badge di bawah nama                                                                                                                                                                                                                                                       |
| `/admin/limit-profiles/new`, `/admin/limit-profiles/[id]`                                                                                                                       | Form      | Belum       | Form panjang berkelompok; kalau tetap panjang, pecah per kelompok seperti pengaturan proyek                                                                                                                                                                                                                                     |
| `/`, `/dashboard`, `/auth/github/callback`                                                                                                                                      | Tidak ada | Tidak perlu | Hanya mengalihkan                                                                                                                                                                                                                                                                                                               |
