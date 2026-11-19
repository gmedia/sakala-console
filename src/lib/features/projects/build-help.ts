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

/** sakala-landing's guide to the release command, the one the setting's help points at. */
export const RELEASE_COMMAND_DOCS_URL = 'https://sakala.dev/docs/perintah-rilis';

/** What sakala-api's stack detection calls a Laravel project. */
export const LARAVEL_FRAMEWORK = 'laravel';
/** The release command a Laravel app with a database usually needs. */
export const LARAVEL_RELEASE_COMMAND = 'php artisan migrate --force';

export function isLaravelStack(stack: { framework?: string | null } | null | undefined): boolean {
	return stack?.framework?.toLowerCase() === LARAVEL_FRAMEWORK;
}

// The old version keeps serving while this runs, which is why the help asks for compatible migrations.
export const RELEASE_COMMAND_HELP =
	'Dijalankan sekali setiap deployment, setelah build dan sebelum versi baru menerima trafik. Cocok untuk migration database. Kalau gagal, deployment dibatalkan dan versi sebelumnya tetap melayani. Versi lama masih melayani selama perintah ini berjalan, jadi migration harus tetap cocok dengannya. Jangan taruh seeder di sini.';
