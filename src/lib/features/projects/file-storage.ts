import {
	FILE_STORAGE_GUIDE_ANCHORS,
	fileStorageGuideUrl,
	type FileStorageGuideAnchor
} from '$lib/config/project';
import { isLaravelStack } from './build-help';
import type { EnvExampleEntry, Project } from './type';

/**
 * On hosted Sakala, anything an app writes to its container's filesystem is gone once the container
 * stops: the project sleeping, Restart, a crash and its automatic restart, and every deploy,
 * Redeploy, or rollback. Sakala has no file storage of its own yet, so uploads belong in
 * S3-compatible object storage. The guide says how per framework.
 */

/** What sakala-api's stack detection calls a Node app (`stack.provider`). */
export const NODE_PROVIDER = 'node';

/** Laravel's disk setting in `.env.example` (`FILESYSTEM_DRIVER` before Laravel 9). */
export const LARAVEL_FILE_KEYS: readonly string[] = ['FILESYSTEM_DISK', 'FILESYSTEM_DRIVER'];

/**
 * The common names of an upload folder in `.env.example`. Kept small on purpose: a key that only
 * might mean files of the app's own (APP_URL, CACHE_DRIVER, AWS_BUCKET) does not count, so the note
 * stays rare enough to be read.
 */
export const UPLOAD_FILE_KEYS: readonly string[] = [
	'UPLOAD_DIR',
	'UPLOAD_PATH',
	'UPLOADS_DIR',
	'UPLOADS_PATH'
];

export const FILE_STORAGE_COPY = {
	note: 'File yang ditulis aplikasimu di dalam container, misalnya foto yang di-upload pengguna, hilang saat proyek tidur, di-restart, atau di-deploy ulang. Simpan file upload di object storage yang kompatibel dengan S3.',
	sleeping: 'File yang ditulis aplikasi di dalam container hilang saat proyek tidur.',
	guideLink: 'Panduan penyimpanan file'
} as const;

type InspectedApp = {
	stack: Pick<NonNullable<Project['stack']>, 'provider' | 'framework'> | null | undefined;
	envEntries: readonly Pick<EnvExampleEntry, 'key'>[];
};

export type FileStorageNote = { guideUrl: string };

/**
 * The note before a first deploy, when the inspection suggests the app keeps files on its own disk:
 * a Laravel app (its `storage/app` is where uploads go by default), or an upload key in
 * `.env.example`. `null` otherwise. The link opens the guide's section for the app's framework.
 */
export function fileStorageNote({ stack, envEntries }: InspectedApp): FileStorageNote | null {
	const keys = new Set(envEntries.map((entry) => entry.key));
	const laravel = isLaravelStack(stack) || LARAVEL_FILE_KEYS.some((key) => keys.has(key));
	if (!laravel && !UPLOAD_FILE_KEYS.some((key) => keys.has(key))) return null;

	return { guideUrl: fileStorageGuideUrl(guideAnchor({ laravel, provider: stack?.provider })) };
}

/** The guide's section for a project's framework, for notes that are not about one finding. */
export function projectFileStorageGuideUrl(stack: InspectedApp['stack']): string {
	return fileStorageGuideUrl(
		guideAnchor({ laravel: isLaravelStack(stack), provider: stack?.provider })
	);
}

function guideAnchor({
	laravel,
	provider
}: {
	laravel: boolean;
	provider: string | null | undefined;
}): FileStorageGuideAnchor | null {
	if (laravel) return FILE_STORAGE_GUIDE_ANCHORS.laravel;
	if (provider?.toLowerCase() === NODE_PROVIDER) return FILE_STORAGE_GUIDE_ANCHORS.node;
	return null;
}
