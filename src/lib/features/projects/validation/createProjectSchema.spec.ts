import { describe, it, expect } from 'vitest';
import {
	createProjectFormSchema,
	generateSlug,
	generateDomainPreview,
	mapCreateProjectErrors
} from './createProjectSchema';
import { ApiError } from '$lib/api/errors';

describe('createProjectFormSchema', () => {
	it('memvalidasi form dengan input github_installation yang valid', () => {
		const input = {
			name: 'my-project',
			branch: 'main',
			repository: {
				type: 'github_installation' as const,
				installation_id: 'inst-123',
				repository_id: 456
			}
		};

		const result = createProjectFormSchema.safeParse(input);
		expect(result.success).toBe(true);
	});

	it('memvalidasi form dengan input public_url yang valid', () => {
		const input = {
			name: 'sakala-demo',
			branch: 'develop',
			repository: {
				type: 'public_url' as const,
				url: 'https://github.com/user/demo-repo'
			}
		};

		const result = createProjectFormSchema.safeParse(input);
		expect(result.success).toBe(true);
	});

	it('menolak nama proyek kosong atau hanya spasi', () => {
		const input = {
			name: '   ',
			branch: 'main',
			repository: {
				type: 'public_url' as const,
				url: 'https://github.com/user/demo-repo'
			}
		};

		const result = createProjectFormSchema.safeParse(input);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.flatten().fieldErrors.name).toContain('Nama proyek wajib diisi');
		}
	});

	it('menolak nama proyek lebih dari 120 karakter', () => {
		const input = {
			name: 'a'.repeat(121),
			branch: 'main',
			repository: {
				type: 'public_url' as const,
				url: 'https://github.com/user/demo-repo'
			}
		};

		const result = createProjectFormSchema.safeParse(input);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.flatten().fieldErrors.name).toContain(
				'Nama proyek maksimal 120 karakter'
			);
		}
	});

	it('menolak public_url yang bukan GitHub', () => {
		const input = {
			name: 'valid-name',
			branch: 'main',
			repository: {
				type: 'public_url' as const,
				url: 'https://gitlab.com/user/repo'
			}
		};

		const result = createProjectFormSchema.safeParse(input);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.flatten().fieldErrors.repository).toBeDefined();
		}
	});
});

describe('generateSlug & generateDomainPreview', () => {
	it('menghasilkan slug yang bersih dan lowercase', () => {
		expect(generateSlug('My Awesome App!')).toBe('my-awesome-app');
		expect(generateSlug('Project_Name_2026')).toBe('project-name-2026');
		expect(generateSlug('   leading-trailing-spaces   ')).toBe('leading-trailing-spaces');
	});

	it('memotong slug maksimal 63 karakter', () => {
		const longName = 'a'.repeat(100);
		const slug = generateSlug(longName);
		expect(slug.length).toBe(63);
	});

	it('menghasilkan domain preview dengan baseDomain default', () => {
		expect(generateDomainPreview('My App')).toBe('my-app.run.sakala.dev');
	});

	it('menangani string kosong pada generateDomainPreview', () => {
		expect(generateDomainPreview('')).toBe('preview.run.sakala.dev');
	});
});

describe('mapCreateProjectErrors', () => {
	it('memetakan error 422 Laravel ke field name dan branch', () => {
		const apiError = new ApiError('Data tidak valid', 422, {
			name: ['Nama project tersebut tidak dapat digunakan.'],
			branch: ['The selected branch is invalid.']
		});

		const mapped = mapCreateProjectErrors(apiError);
		expect(mapped.name).toBe('Nama project tersebut tidak dapat digunakan.');
		expect(mapped.branch).toBe('The selected branch is invalid.');
		expect(mapped.general).toBeUndefined();
	});

	it('memetakan error repository.url ke field repository', () => {
		const apiError = new ApiError('Data tidak valid', 422, {
			'repository.url': ['The repository url format is invalid.']
		});

		const mapped = mapCreateProjectErrors(apiError);
		expect(mapped.repository).toBe('The repository url format is invalid.');
	});

	it('mengembalikan pesan general jika tidak ada error field spesifik', () => {
		const apiError = new ApiError('Ada kesalahan validasi.', 422, {});
		const mapped = mapCreateProjectErrors(apiError);
		expect(mapped.general).toBe('Ada kesalahan validasi.');
	});

	it('mengembalikan pesan kuota jika error status 403', () => {
		const apiError = new ApiError('Batas proyek tercapai', 403);
		const mapped = mapCreateProjectErrors(apiError);
		expect(mapped.general).toBe('Batas proyek tercapai');
	});

	it('menangani generic Error standar', () => {
		const error = new Error('Network timeout');
		const mapped = mapCreateProjectErrors(error);
		expect(mapped.general).toBe('Network timeout');
	});
});
