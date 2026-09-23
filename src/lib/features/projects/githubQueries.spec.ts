import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createQuery } from '@tanstack/svelte-query';
import { queryKeys } from '$lib/api/query-keys';
import {
	createGithubInstallationsQuery,
	createInstallationRepositoriesQuery
} from './githubQueries';
import { getGithubInstallations, getInstallationRepositories } from '$lib/api/resources/github';

vi.mock('@tanstack/svelte-query', () => ({
	createQuery: vi.fn()
}));

vi.mock('$lib/api/resources/github', () => ({
	getGithubInstallations: vi.fn(),
	getInstallationRepositories: vi.fn()
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
