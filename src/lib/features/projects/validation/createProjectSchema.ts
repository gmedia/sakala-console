import { z } from 'zod';
import { ApiError } from '$lib/api/errors';

export const createProjectFormSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, 'Nama proyek wajib diisi')
		.max(120, 'Nama proyek maksimal 120 karakter'),
	branch: z.string().trim().min(1, 'Branch wajib dipilih'),
	repository: z.discriminatedUnion('type', [
		z.object({
			type: z.literal('github_installation'),
			installation_id: z.string().min(1, 'GitHub installation ID wajib diisi'),
			repository_id: z.number().int().positive('Repository GitHub harus dipilih')
		}),
		z.object({
			type: z.literal('public_url'),
			url: z
				.string()
				.trim()
				.min(1, 'URL repository wajib diisi')
				.url('Format URL tidak valid')
				.regex(
					/^https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(\.git)?$/,
					'URL harus berupa repository GitHub publik (contoh: https://github.com/user/repo)'
				)
		})
	])
});

export type CreateProjectFormData = z.infer<typeof createProjectFormSchema>;

export function generateSlug(name: string): string {
	const normalized = name
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, '')
		.replace(/[\s_-]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return normalized.slice(0, 63);
}

export function generateDomainPreview(name: string, baseDomain = 'run.sakala.dev'): string {
	const slug = generateSlug(name);
	if (!slug) return `preview.${baseDomain}`;
	return `${slug}.${baseDomain}`;
}

export type CreateProjectFieldErrors = {
	name?: string;
	branch?: string;
	repository?: string;
	general?: string;
};

export function mapCreateProjectErrors(error: unknown): CreateProjectFieldErrors {
	if (error instanceof ApiError && error.isValidationError) {
		const fieldErrors: CreateProjectFieldErrors = {};
		const errors = error.errors;

		if (errors.name && errors.name.length > 0) {
			fieldErrors.name = errors.name[0];
		}
		if (errors.branch && errors.branch.length > 0) {
			fieldErrors.branch = errors.branch[0];
		}
		if (errors['repository.url'] && errors['repository.url'].length > 0) {
			fieldErrors.repository = errors['repository.url'][0];
		} else if (
			errors['repository.installation_id'] &&
			errors['repository.installation_id'].length > 0
		) {
			fieldErrors.repository = errors['repository.installation_id'][0];
		} else if (
			errors['repository.repository_id'] &&
			errors['repository.repository_id'].length > 0
		) {
			fieldErrors.repository = errors['repository.repository_id'][0];
		} else if (errors.repository && errors.repository.length > 0) {
			fieldErrors.repository = errors.repository[0];
		}

		const hasFieldErrors = fieldErrors.name || fieldErrors.branch || fieldErrors.repository;
		if (!hasFieldErrors && error.message) {
			fieldErrors.general = error.message;
		}

		return fieldErrors;
	}

	if (error instanceof ApiError) {
		if (error.status === 403) {
			return {
				general: error.message || 'Anda tidak memiliki izin atau telah mencapai batas kuota proyek.'
			};
		}
		return { general: error.message || 'Terjadi kesalahan pada server. Silakan coba lagi.' };
	}

	if (error instanceof Error) {
		return { general: error.message };
	}

	return { general: 'Gagal membuat proyek. Silakan coba lagi nanti.' };
}
