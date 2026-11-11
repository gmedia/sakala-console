import { describe, it, expect } from 'vitest';
import {
	buildConfigurationSchema,
	createProjectFormSchema,
	mapCreateProjectErrors
} from './createProjectSchema';
import { ApiError, NetworkError } from '$lib/api/errors';

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

	it('menerima nama proyek dengan karakter bebas yang dinormalisasi slug backend', () => {
		const input = {
			name: 'sakala.io / app (staging)',
			branch: 'main',
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

describe('buildConfigurationSchema mirrors the API rules', () => {
	const empty = { configured_port: '', build_command: '', start_command: '', root_directory: '' };
	const firstError = (input: Partial<typeof empty>, field: keyof typeof empty) => {
		const result = buildConfigurationSchema.safeParse({ ...empty, ...input });
		return result.success ? undefined : result.error.flatten().fieldErrors[field]?.[0];
	};

	it('reads empty fields as not set', () => {
		expect(buildConfigurationSchema.parse(empty)).toEqual({
			configured_port: null,
			build_command: null,
			start_command: null,
			root_directory: null
		});
	});

	it('reads a port as a number', () => {
		expect(buildConfigurationSchema.parse({ ...empty, configured_port: ' 8080 ' })).toMatchObject({
			configured_port: 8080
		});
	});

	it.each(['0', '65536', 'abc', '80.5', '-1'])('refuses port %s', (port) => {
		expect(firstError({ configured_port: port }, 'configured_port')).toContain('1 sampai 65535');
	});

	it.each(['1', '65535'])('accepts port %s', (port) => {
		expect(firstError({ configured_port: port }, 'configured_port')).toBeUndefined();
	});

	it('refuses a command over 1000 characters', () => {
		expect(firstError({ build_command: 'a'.repeat(1001) }, 'build_command')).toContain('1000');
		expect(firstError({ build_command: 'a'.repeat(1000) }, 'build_command')).toBeUndefined();
	});

	it('refuses a command with more than one line, and says how to fix it', () => {
		expect(firstError({ start_command: 'npm ci\nnpm start' }, 'start_command')).toContain('&&');
	});

	it.each(['apps/web', 'apps/web-2', 'a.b/c_d'])('accepts root directory %s', (directory) => {
		expect(firstError({ root_directory: directory }, 'root_directory')).toBeUndefined();
	});

	it.each(['/apps', 'apps/', 'apps//web', 'apps web'])(
		'refuses root directory %s as not relative',
		(directory) => {
			expect(firstError({ root_directory: directory }, 'root_directory')).toContain('path relatif');
		}
	);

	it.each(['..', '../etc', 'apps/..', './apps', 'apps/./web'])(
		'refuses root directory %s as leaving the repository',
		(directory) => {
			expect(firstError({ root_directory: directory }, 'root_directory')).toContain('. atau ..');
		}
	);
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

	it('tidak menampilkan pesan Error mentah ke user', () => {
		const mapped = mapCreateProjectErrors(new Error('Network timeout'));
		expect(mapped.general).toBe('Proyek belum berhasil dibuat. Silakan coba lagi.');
	});

	it('menampilkan pesan koneksi berbahasa Indonesia', () => {
		const mapped = mapCreateProjectErrors(new NetworkError());
		expect(mapped.general).toBe('Sakala API tidak dapat dijangkau.');
	});

	it('memetakan error 422 konfigurasi build ke field masing-masing', () => {
		const mapped = mapCreateProjectErrors(
			new ApiError('Data tidak valid', 422, {
				configured_port: ['Port di luar rentang.'],
				build_command: ['Build command ditolak.'],
				start_command: ['Start command ditolak.'],
				root_directory: ['Root directory ditolak.']
			})
		);

		expect(mapped).toEqual({
			configured_port: 'Port di luar rentang.',
			build_command: 'Build command ditolak.',
			start_command: 'Start command ditolak.',
			root_directory: 'Root directory ditolak.'
		});
	});

	it('menampilkan kuota dari API sebagai pesan general', () => {
		const mapped = mapCreateProjectErrors(
			new ApiError('Kuota proyek habis.', 422, {}, undefined, { code: 'PROJECT_LIMIT_EXCEEDED' })
		);
		expect(mapped.general).toBe('Kuota proyek habis.');
	});

	it('mengganti 409 instalasi yang berbahasa Inggris dengan langkah yang jelas', () => {
		const mapped = mapCreateProjectErrors(
			new ApiError('GitHub installation is no longer active.', 409)
		);
		expect(mapped.general).toContain('menghubungkannya ulang');
	});
});
