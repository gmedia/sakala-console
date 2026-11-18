// What sakala-agent really does with these fields: docs/AGENT_API.md, "Field build opsional".
export const BUILD_COMMAND_HELP =
	'Hanya dipakai saat build otomatis dengan Railpack. Kalau ada Dockerfile, isian ini diabaikan.';

export const START_COMMAND_HELP =
	'Berlaku untuk Dockerfile dan Railpack. Dengan Dockerfile, image-nya harus punya sh.';

export const ROOT_DIRECTORY_HELP =
	'Folder aplikasi di dalam repository, misalnya apps/web. Kosongkan kalau ada di root.';

export const AUTO_DEPLOY_HELP =
	'Setiap push ke branch ini membuat deployment baru, selama GitHub App Sakala berlangganan event push.';

export const AUTO_DEPLOY_UNAVAILABLE_HELP =
	'Auto-deploy tidak tersedia untuk Public Git URL, karena hanya GitHub App yang mengirim webhook.';

export const RELEASE_COMMAND_LABEL = 'Release command';

// The old version keeps serving while this runs, which is why the help asks for compatible migrations.
export const RELEASE_COMMAND_HELP =
	'Dijalankan sekali setiap deployment, setelah build dan sebelum versi baru menerima trafik. Cocok untuk migration database. Kalau gagal, deployment dibatalkan dan versi sebelumnya tetap melayani. Versi lama masih melayani selama perintah ini berjalan, jadi migration harus tetap cocok dengannya. Jangan taruh seeder di sini.';
