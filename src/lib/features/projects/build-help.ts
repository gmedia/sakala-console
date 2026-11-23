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
	'Auto-deploy tidak tersedia untuk proyek dari URL GitHub publik, karena hanya GitHub App yang mengirim webhook.';

export const RELEASE_COMMAND_LABEL = 'Release command';

// Built from the docs base the installation names; see src/lib/config/site-links.ts.
export { RELEASE_COMMAND_DOCS_URL } from '$lib/config/project';

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

/** The release command beside a database choice, where the full help would crowd the card. */
export const RELEASE_COMMAND_SHORT_HELP =
	'Dijalankan sekali setiap deploy, setelah build dan sebelum versi baru menerima trafik, misalnya migration. Kosongkan kalau tidak perlu; bisa diubah nanti di Pengaturan.';

/**
 * The placeholder of a field Sakala fills in itself. An example command there reads like a value
 * that is already set, so examples go in the help text instead.
 */
export const DETECTED_PLACEHOLDER = 'Dideteksi otomatis';

export const PORT_HELP =
	'Kosong berarti diambil dari EXPOSE di Dockerfile, atau 3000 kalau tidak ada. Aplikasimu harus mendengarkan di environment variable PORT.';

export const BUILD_COMMAND_EXAMPLE = 'Contoh: npm run build.';
export const START_COMMAND_EXAMPLE = 'Contoh: npm start.';
export const RELEASE_COMMAND_EXAMPLE = 'Contoh untuk Laravel: php artisan migrate --force.';
export const RELEASE_COMMAND_PLACEHOLDER = 'Tidak ada';
export const ROOT_DIRECTORY_PLACEHOLDER = 'Root repository';
