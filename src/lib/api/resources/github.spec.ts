import { describe, it, expect, vi } from 'vitest';
import {
	getGithubInstallations,
	parseGithubInstallationsResponse,
	getInstallationRepositories,
	parseGithubRepositoriesResponse,
	parseGithubRepositoryResponse,
	validateGithubRepository
} from './github';
import { apiRequest } from '../client';

vi.mock('../client', () => ({
	apiRequest: vi.fn()
}));

describe('github resource', () => {
	it('berhasil mem-parse list github installations', () => {
		const raw = {
			data: [
				{
					id: 'inst-123-uuid',
					account_login: 'octocat',
					account_type: 'User',
					repository_selection: 'all',
					status: 'active',
					created_at: '2026-01-01T00:00:00Z',
					updated_at: '2026-01-01T00:00:00Z'
				}
			]
		};

		const result = parseGithubInstallationsResponse(raw);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('inst-123-uuid');
		expect(result[0].account_login).toBe('octocat');
	});

	it('berhasil memanggil endpoint getGithubInstallations', async () => {
		vi.mocked(apiRequest).mockResolvedValueOnce({
			data: [
				{
					id: 'inst-abc',
					account_login: 'my-org',
					account_type: 'Organization',
					repository_selection: 'selected',
					status: 'active',
					created_at: '2026-01-01T00:00:00Z',
					updated_at: '2026-01-01T00:00:00Z'
				}
			]
		});

		const result = await getGithubInstallations();
		expect(apiRequest).toHaveBeenCalledWith('/api/v1/app/github/installations');
		expect(result[0].id).toBe('inst-abc');
	});

	it('berhasil mem-parse list repositories dari instalasi', () => {
		const raw = {
			data: [
				{
					id: 987654,
					name: 'awesome-repo',
					full_name: 'octocat/awesome-repo',
					clone_url: 'https://github.com/octocat/awesome-repo.git',
					default_branch: 'main',
					pushed_at: '2026-02-01T00:00:00Z',
					private: false
				}
			]
		};

		const result = parseGithubRepositoriesResponse(raw);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('987654');
		expect(result[0].full_name).toBe('octocat/awesome-repo');
	});

	it('berhasil memanggil endpoint getInstallationRepositories dengan query params', async () => {
		vi.mocked(apiRequest).mockResolvedValueOnce({
			data: []
		});

		await getInstallationRepositories('inst-uuid-1', { page: 2, per_page: 10 });
		expect(apiRequest).toHaveBeenCalledWith(
			'/api/v1/app/github/installations/inst-uuid-1/repositories',
			{ params: { page: 2, per_page: 10 } }
		);
	});

	it('berhasil mem-parse single repository dari validate endpoint', () => {
		const raw = {
			data: {
				id: '12345',
				name: 'my-public-repo',
				full_name: 'octocat/my-public-repo',
				clone_url: 'https://github.com/octocat/my-public-repo.git',
				default_branch: 'develop',
				pushed_at: '2026-03-01T00:00:00Z',
				private: false
			}
		};

		const result = parseGithubRepositoryResponse(raw);
		expect(result.id).toBe('12345');
		expect(result.name).toBe('my-public-repo');
		expect(result.default_branch).toBe('develop');
	});

	it('berhasil memanggil validateGithubRepository dengan option json', async () => {
		vi.mocked(apiRequest).mockResolvedValueOnce({
			data: {
				id: '999',
				name: 'demo',
				full_name: 'owner/demo',
				clone_url: 'https://github.com/owner/demo.git',
				default_branch: 'main',
				pushed_at: '2026-03-01T00:00:00Z',
				private: false
			}
		});

		const result = await validateGithubRepository('https://github.com/owner/demo');
		expect(apiRequest).toHaveBeenCalledWith('/api/v1/app/github/repositories/validate', {
			method: 'POST',
			json: { repository_url: 'https://github.com/owner/demo' }
		});
		expect(result.id).toBe('999');
		expect(result.full_name).toBe('owner/demo');
	});
});
