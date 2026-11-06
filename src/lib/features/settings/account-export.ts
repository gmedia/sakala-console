import type { AccountExport } from '$lib/api/resources/auth';

export const EXPORT_FILE_NAME = 'sakala-data-export.json';

const COLLECTION_NAMES: Record<string, string> = {
	projects: 'proyek',
	deployments: 'deployment',
	environment_variables: 'environment variable',
	notifications: 'notifikasi',
	feedback: 'masukan'
};

/** A cap on a collection is something the person reading the file needs to know about. */
export function describeTruncatedExport(
	data: Pick<AccountExport, 'truncated' | 'max_items_per_collection'>
): string | null {
	if (data.truncated.length === 0) return null;
	const names = data.truncated.map((name) => COLLECTION_NAMES[name] ?? name).join(', ');
	return `Daftar ${names} hanya berisi ${data.max_items_per_collection} item terbaru.`;
}

export function saveJsonFile(fileName: string, data: unknown): void {
	const url = URL.createObjectURL(
		new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
	);
	const link = document.createElement('a');
	link.href = url;
	link.download = fileName;
	document.body.append(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
}
