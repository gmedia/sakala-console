// What sakala-agent really does with these fields: docs/AGENT_API.md, "Field build opsional".
export const BUILD_COMMAND_HELP =
	'Hanya dipakai saat build otomatis dengan Railpack. Kalau repository punya Dockerfile, langkah build mengikuti Dockerfile dan isian ini diabaikan.';

export const START_COMMAND_HELP =
	'Berlaku untuk Dockerfile dan Railpack. Dengan Dockerfile, perintah ini menggantikan entrypoint image dan dijalankan lewat sh, jadi image-nya harus punya sh.';

export const ROOT_DIRECTORY_HELP =
	'Folder aplikasi di dalam repository, misalnya apps/web. Dockerfile dicari di folder ini, dan Railpack membaca folder ini. Kosongkan kalau aplikasinya ada di root repository.';

export const AUTO_DEPLOY_HELP =
	'Setiap push ke branch ini membuat deployment baru. Fitur ini memakai webhook dari GitHub App Sakala, jadi hanya jalan kalau GitHub App-nya berlangganan event push.';

export const AUTO_DEPLOY_UNAVAILABLE_HELP =
	'Auto-deploy tidak tersedia untuk Public Git URL, karena hanya repository yang terhubung lewat GitHub App yang mengirim webhook ke Sakala.';
