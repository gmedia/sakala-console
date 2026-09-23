import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getListProjects, parseListProjectsResponse, type Project } from './projects';
import { apiRequest } from '../client';

vi.mock('../client', () => ({
	apiRequest: vi.fn()
}));

function buildProject(overrides: Partial<Project> = {}): Project {
	return {
		id: 'proj_1',
		name: 'sakala-console',
		repository_full_name: 'gmedia/sakala-console',
		repository_source: 'github_installation',
		github_installation_id: '123',
		github_repository_id: 456,
		branch: 'main',
		thumbnail_url: 'https://example.com/thumb.png',
		runtime_status: 'running',
		last_deployed_at: '2026-09-10T10:00:00Z',
		created_at: '2026-01-01T00:00:00Z',
		...overrides
	};
}

function buildListResponse(projects: Project[] = [buildProject()]) {
	return {
		data: projects,
		links: {
			first: 'https://api/projects?page=1',
			last: 'https://api/projects?page=1',
			prev: null,
			next: null
		},
		meta: {
			current_page: 1,
			from: 1,
			last_page: 1,
			links: [{ url: null, label: '1', active: true }],
			path: 'https://api/projects',
			per_page: 15,
			to: projects.length,
			total: projects.length
		}
	};
}

describe('parseListProjectsResponse', () => {
	it('mem-parse response yang valid tanpa error dan mengembalikan bentuk yang sama', () => {
		const raw = buildListResponse();

		const result = parseListProjectsResponse(raw);

		expect(result).toEqual(raw);
	});

	it('menerima runtime_status yang belum dikenal frontend', () => {
		const raw = buildListResponse([
			buildProject({
				runtime_status: 'maintenance'
			})
		]);

		const result = parseListProjectsResponse(raw);

		expect(result.data[0].runtime_status).toBe('maintenance');
	});

	it('menerima repository_full_name bernilai null', () => {
		const raw = buildListResponse([
			buildProject({
				repository_full_name: null
			})
		]);

		const result = parseListProjectsResponse(raw);

		expect(result.data[0].repository_full_name).toBeNull();
	});

	it('melempar error saat field wajib pada project hilang', () => {
		const raw = buildListResponse();
		// @ts-expect-error sengaja menghapus field wajib untuk menguji validasi
		delete raw.data[0].branch;

		expect(() => parseListProjectsResponse(raw)).toThrow();
	});

	it('melempar error saat repository_source di luar enum yang diizinkan', () => {
		const raw = buildListResponse();
		// @ts-expect-error sengaja memasukkan nilai enum yang tidak valid
		raw.data[0].repository_source = 'invalid_source';

		expect(() => parseListProjectsResponse(raw)).toThrow();
	});

	it('melempar error saat meta.total bukan number', () => {
		const raw = buildListResponse();
		// @ts-expect-error sengaja memasukkan tipe yang salah
		raw.meta.total = '10';

		expect(() => parseListProjectsResponse(raw)).toThrow();
	});
});

describe('getListProjects', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('memanggil apiRequest dengan endpoint dan params yang benar', async () => {
		const raw = buildListResponse();
		vi.mocked(apiRequest).mockResolvedValueOnce(raw);

		const params = { page: 1, per_page: 15 };
		await getListProjects(params);

		expect(apiRequest).toHaveBeenCalledTimes(1);
		expect(apiRequest).toHaveBeenCalledWith('/api/v1/app/projects', { params });
	});

	it('mengembalikan hasil parse yang valid ketika apiRequest sukses', async () => {
		const raw = buildListResponse([buildProject({ id: 'proj_2', name: 'other-project' })]);
		vi.mocked(apiRequest).mockResolvedValueOnce(raw);

		const result = await getListProjects({});

		expect(result.data).toHaveLength(1);
		expect(result.data[0].name).toBe('other-project');
	});

	it('menerima runtime_status baru dari API tanpa gagal parsing', async () => {
		const raw = buildListResponse([
			buildProject({
				runtime_status: 'maintenance'
			})
		]);

		vi.mocked(apiRequest).mockResolvedValueOnce(raw);

		const result = await getListProjects({});

		expect(result.data[0].runtime_status).toBe('maintenance');
	});

	it('melempar error jika response dari apiRequest tidak sesuai schema', async () => {
		const raw = buildListResponse();
		// @ts-expect-error sengaja merusak bentuk response dari server
		raw.data = 'not-an-array';
		vi.mocked(apiRequest).mockResolvedValueOnce(raw);

		await expect(getListProjects({})).rejects.toThrow();
	});

	it('meneruskan error dari apiRequest apa adanya (mis. network/HTTP error)', async () => {
		const networkError = new Error('Network Error');
		vi.mocked(apiRequest).mockRejectedValueOnce(networkError);

		await expect(getListProjects({})).rejects.toThrow('Network Error');
	});
});

describe('createProject & parseCreateProjectResponse', () => {
	const validCreateResponse = {
		data: {
			id: 'proj_new_123',
			name: 'my-awesome-app',
			repository_full_name: 'user/my-awesome-app',
			repository_source: 'github_installation' as const,
			github_installation_id: 'inst_abc',
			github_repository_id: 12345,
			branch: 'main',
			runtime_status: 'not_deployed',
			preview_status: 'succeeded',
			created_at: '2026-09-22T10:00:00Z'
		}
	};

	it('berhasil mem-parse response create project yang valid', async () => {
		const { parseCreateProjectResponse } = await import('./projects');
		const parsed = parseCreateProjectResponse(validCreateResponse);

		expect(parsed.id).toBe('proj_new_123');
		expect(parsed.name).toBe('my-awesome-app');
		expect(parsed.repository_source).toBe('github_installation');
		expect(parsed.github_repository_id).toBe(12345);
	});

	it('berhasil mem-parse response untuk public_url dengan github fields null', async () => {
		const { parseCreateProjectResponse } = await import('./projects');
		const publicResponse = {
			data: {
				id: 'proj_public_456',
				name: 'public-demo',
				repository_full_name: 'owner/public-demo',
				repository_source: 'public_url' as const,
				github_installation_id: null,
				github_repository_id: null,
				branch: 'develop',
				runtime_status: 'not_deployed',
				created_at: '2026-09-22T10:00:00Z'
			}
		};

		const parsed = parseCreateProjectResponse(publicResponse);
		expect(parsed.id).toBe('proj_public_456');
		expect(parsed.repository_source).toBe('public_url');
		expect(parsed.github_installation_id).toBeNull();
	});

	it('memanggil apiRequest dengan method POST, URL /api/v1/app/projects, dan payload yang tepat', async () => {
		const { createProject } = await import('./projects');
		vi.mocked(apiRequest).mockResolvedValueOnce(validCreateResponse);

		const payload = {
			name: 'my-awesome-app',
			branch: 'main',
			repository: {
				type: 'github_installation' as const,
				installation_id: 'inst_abc',
				repository_id: 12345
			}
		};

		const result = await createProject(payload);

		expect(apiRequest).toHaveBeenCalledWith('/api/v1/app/projects', {
			method: 'POST',
			json: payload
		});
		expect(result.id).toBe('proj_new_123');
	});

	it('melempar error jika response tidak valid', async () => {
		const { createProject } = await import('./projects');
		vi.mocked(apiRequest).mockResolvedValueOnce({ data: { invalid: true } });

		await expect(
			createProject({
				name: 'fail-app',
				branch: 'main',
				repository: {
					type: 'public_url',
					url: 'https://github.com/fail/app'
				}
			})
		).rejects.toThrow();
	});
});
