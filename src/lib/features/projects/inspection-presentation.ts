import type { Project } from './type';

export type InspectionState = 'loading' | 'pending' | 'succeeded' | 'failed';

/** `null` is a fact here: the inspection does not know. It is never replaced with a guess. */
export type DetectedValue = { kind: 'known'; text: string } | { kind: 'unknown'; text: string };

const UNKNOWN: DetectedValue = { kind: 'unknown', text: 'Belum diketahui' };
const UNDETECTED: DetectedValue = { kind: 'unknown', text: 'Tidak terdeteksi' };

const BUILDER_LABELS: Record<string, string> = {
	dockerfile: 'Dockerfile terdeteksi',
	railpack: 'Build otomatis dengan Railpack'
};

const FAILURE_MESSAGES: Record<string, (branch: string) => string> = {
	branch_not_found: (branch) =>
		`Branch ${branch} tidak ditemukan di repository. Ganti branch-nya di tab Pengaturan proyek, lalu klik Detect ulang.`,
	repository_access_denied: () =>
		'Sakala tidak punya akses untuk membaca repository ini. Periksa akses GitHub repository-nya, lalu klik Detect ulang.',
	github_unavailable: () =>
		'Sakala gagal menghubungi GitHub. Biasanya ini sementara, jadi coba Detect ulang beberapa saat lagi.',
	github_rate_limited: () =>
		'Sakala sedang mencapai batas permintaan ke GitHub. Ini bukan masalah di repository kamu. Coba Detect ulang beberapa saat lagi.'
};

export function getInspectionState(project: Pick<Project, 'preview_status'>): InspectionState {
	if (project.preview_status === 'pending') return 'pending';
	if (project.preview_status === 'succeeded') return 'succeeded';
	return 'failed';
}

export function getInspectionFailureMessage(
	project: Pick<Project, 'branch' | 'inspection_error_code'>
): string {
	const describe = project.inspection_error_code
		? FAILURE_MESSAGES[project.inspection_error_code]
		: undefined;
	return (
		describe?.(project.branch) ??
		'Deteksi tidak selesai, jadi hasilnya belum diketahui. Klik Detect ulang untuk mencobanya lagi.'
	);
}

function detected(project: Pick<Project, 'preview_status'>, value: string | null | undefined) {
	if (value) return { kind: 'known', text: value } satisfies DetectedValue;
	return getInspectionState(project) === 'failed' ? UNDETECTED : UNKNOWN;
}

export function getDetectedBuilder(project: Pick<Project, 'preview_status' | 'stack'>) {
	const builder = project.stack?.builder;
	return detected(project, builder ? (BUILDER_LABELS[builder] ?? builder) : null);
}

export function getDetectedFramework(project: Pick<Project, 'preview_status' | 'stack'>) {
	return detected(project, project.stack?.framework);
}

export function getDetectedPackageManager(
	project: Pick<Project, 'preview_status' | 'stack' | 'inspection'>
) {
	return detected(project, project.stack?.package_manager ?? project.inspection?.package_manager);
}

/** Names where the number comes from, because only a configured port is the user's own choice. */
export function getPortDescription(
	project: Pick<Project, 'configured_port' | 'detected_port' | 'effective_port'>
): string {
	if (project.configured_port !== null) return `${project.effective_port} (kamu yang mengisi)`;
	if (project.detected_port !== null) return `${project.effective_port} (terdeteksi)`;
	return `${project.effective_port} (bawaan)`;
}

export function getInspectionNotes(project: Pick<Project, 'inspection'>): string[] {
	const inspection = project.inspection;
	if (!inspection) return [];

	const notes: string[] = [];
	if (inspection.env_example_found) {
		notes.push(
			'Repository ini punya .env.example. Cocokkan isinya dengan variabel di tab Environment Variables sebelum deploy.'
		);
	}
	if (inspection.compose_found) {
		notes.push(
			'Repository ini punya file Compose, tapi Sakala tidak menjalankannya. Build memakai Dockerfile atau Railpack.'
		);
	}
	return notes;
}

export function getInspectedFiles(project: Pick<Project, 'inspection'>): string[] {
	return (project.inspection?.manifests ?? []).filter(
		(file): file is string => typeof file === 'string'
	);
}
