import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createQuery } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api/query-keys';
import {
	createGithubInstallationsQuery,
	createInstallationRepositoriesQuery,
	createRepositoryBranchesQuery
} from './githubQueries';
import {
	getGithubInstallations,
	getInstallationRepositories,
	getInstallationRepositoryBranches,
	getPublicRepositoryBranches
} from '$lib/api/resources/github';

vi.mock('@tanstack/svelte-query', () => ({
	createQuery: vi.fn()
}));

vi.mock('$lib/api/resources/github', () => ({
	getGithubInstallations: vi.fn(),
	getInstallationRepositories: vi.fn(),
	getInstallationRepositoryBranches: vi.fn(),
	getPublicRepositoryBranches: vi.fn()
}));

describe('createGithubInstallationsQuery', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('menggunakan queryKey github installations yang benar', () => {
		createGithubInstallationsQuery();
		const config = vi.mocked(createQuery).mock.calls[0][0]();

		expect(config.queryKey).toEqual(queryKeys.github.installations());
	});

	it('memanggil getGithubInstallations saat queryFn dieksekusi', async () => {
		createGithubInstallationsQuery();
		const config = vi.mocked(createQuery).mock.calls[0][0]();

		await (config.queryFn as () => Promise<unknown>)();
		expect(getGithubInstallations).toHaveBeenCalled();
	});
});

describe('createInstallationRepositoriesQuery', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('disabled saat installationId null', () => {
		createInstallationRepositoriesQuery(() => null);
		const config = vi.mocked(createQuery).mock.calls[0][0]();

		expect(config.enabled).toBe(false);
	});

	it('enabled dan menggunakan queryKey yang benar saat installationId tersedia', () => {
		createInstallationRepositoriesQuery(() => 'inst-123');
		const config = vi.mocked(createQuery).mock.calls[0][0]();

		expect(config.enabled).toBe(true);
		expect(config.queryKey).toEqual(queryKeys.github.repositories('inst-123'));
	});

	it('memanggil getInstallationRepositories saat queryFn dieksekusi', async () => {
		createInstallationRepositoriesQuery(() => 'inst-123');
		const config = vi.mocked(createQuery).mock.calls[0][0]();

		await (config.queryFn as () => Promise<unknown>)();
		expect(getInstallationRepositories).toHaveBeenCalledWith('inst-123', undefined);
	});
});

describe('createInstallationRepositoriesQuery with server-side paging', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('gives each page and search its own cache entry, and asks the API for it', async () => {
		const params = { page: 2, per_page: 5, search: 'web' };
		createInstallationRepositoriesQuery(
			() => 'inst-123',
			() => params
		);
		const config = vi.mocked(createQuery).mock.calls[0][0]();

		expect(config.queryKey).toEqual(queryKeys.github.repositories('inst-123', params));

		await (config.queryFn as () => Promise<unknown>)();
		expect(getInstallationRepositories).toHaveBeenCalledWith('inst-123', params);
	});
});

describe('createRepositoryBranchesQuery', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('is disabled until a repository is known', () => {
		createRepositoryBranchesQuery(() => null);
		expect(vi.mocked(createQuery).mock.calls[0][0]().enabled).toBe(false);
	});

	it('asks the installation endpoint for a connected repository', async () => {
		createRepositoryBranchesQuery(() => ({
			kind: 'installation',
			installationId: 'inst-1',
			repositoryId: '42'
		}));
		const config = vi.mocked(createQuery).mock.calls[0][0]();

		await (config.queryFn as () => Promise<unknown>)();
		expect(getInstallationRepositoryBranches).toHaveBeenCalledWith('inst-1', '42');
		expect(getPublicRepositoryBranches).not.toHaveBeenCalled();
	});

	it('asks the public endpoint for a repository added by URL', async () => {
		createRepositoryBranchesQuery(() => ({
			kind: 'public',
			repositoryUrl: 'https://github.com/a/b'
		}));
		const config = vi.mocked(createQuery).mock.calls[0][0]();

		await (config.queryFn as () => Promise<unknown>)();
		expect(getPublicRepositoryBranches).toHaveBeenCalledWith('https://github.com/a/b');
		expect(getInstallationRepositoryBranches).not.toHaveBeenCalled();
	});
});
