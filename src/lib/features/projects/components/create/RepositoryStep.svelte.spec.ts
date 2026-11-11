import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { ApiError } from '$lib/api/errors';
import RepositoryStepTestHost from './RepositoryStepTestHost.svelte';
import type { Repository } from '../../type';
import type { ProjectWizardState } from '../../create/createProjectState.svelte';

const mockRepo1: Repository = {
	id: '101',
	name: 'real-api-repo',
	full_name: 'org/real-api-repo',
	clone_url: 'https://github.com/org/real-api-repo.git',
	default_branch: 'main',
	pushed_at: '2026-09-20T00:00:00Z',
	private: false
};

describe('RepositoryStep — Empty & Error states regression coverage', () => {
	it('menampilkan empty state dan tidak menampilkan repository mock saat daftar repository kosong', async () => {
		await render(RepositoryStepTestHost, {
			repositories: [],
			githubConnected: true
		});

		const emptyTitle = page.getByText('Belum ada repository yang bisa dipilih');
		await expect.element(emptyTitle).toBeVisible();

		const mockTitle1 = page.getByText('sakala-dashboard');
		const mockTitle2 = page.getByText('react-ecommerce');
		await expect.element(mockTitle1).not.toBeInTheDocument();
		await expect.element(mockTitle2).not.toBeInTheDocument();
	});

	it('menampilkan error state dan tombol coba lagi saat errorMessage terisi', async () => {
		const onRetry = vi.fn();
		await render(RepositoryStepTestHost, {
			repositories: [],
			githubConnected: true,
			errorMessage: 'Gagal memuat daftar repository GitHub. Silakan coba beberapa saat lagi.',
			onRetry
		});

		const errorTitle = page.getByText('Gagal memuat repository');
		await expect.element(errorTitle).toBeVisible();

		const errorDesc = page.getByText(/Gagal memuat daftar repository GitHub/i);
		await expect.element(errorDesc).toBeVisible();

		const retryBtn = page.getByRole('button', { name: /coba lagi/i });
		await expect.element(retryBtn).toBeVisible();
		await retryBtn.click();
		expect(onRetry).toHaveBeenCalledOnce();

		const mockTitle1 = page.getByText('sakala-dashboard');
		await expect.element(mockTitle1).not.toBeInTheDocument();
	});

	it('menampilkan error state dan bukan disconnected state saat githubConnected bernilai false tetapi errorMessage terisi', async () => {
		const onRetry = vi.fn();
		await render(RepositoryStepTestHost, {
			repositories: [],
			githubConnected: false,
			errorMessage: 'Gagal memuat instalasi GitHub. Silakan coba beberapa saat lagi.',
			onRetry
		});

		const errorTitle = page.getByText('Gagal memuat repository');
		await expect.element(errorTitle).toBeVisible();

		const errorDesc = page.getByText(/Gagal memuat instalasi GitHub/i);
		await expect.element(errorDesc).toBeVisible();

		const retryBtn = page.getByRole('button', { name: /coba lagi/i });
		await expect.element(retryBtn).toBeVisible();
		await retryBtn.click();
		expect(onRetry).toHaveBeenCalledOnce();

		// Pastikan state disconnected tidak menutupi error
		const disconnectedTitle = page.getByText('Belum ada akun GitHub yang terhubung');
		await expect.element(disconnectedTitle).not.toBeInTheDocument();
	});

	it('tidak menampilkan disconnected state saat loading masih true', async () => {
		await render(RepositoryStepTestHost, {
			repositories: [],
			githubConnected: false,
			loading: true
		});

		const disconnectedTitle = page.getByText('Belum ada akun GitHub yang terhubung');
		await expect.element(disconnectedTitle).not.toBeInTheDocument();
	});

	it('menampilkan disconnected state saat tidak loading, tidak error, dan githubConnected bernilai false', async () => {
		await render(RepositoryStepTestHost, {
			repositories: [],
			githubConnected: false,
			loading: false,
			errorMessage: null
		});

		const disconnectedTitle = page.getByText('Belum ada akun GitHub yang terhubung');
		await expect.element(disconnectedTitle).toBeVisible();
	});

	it('menampilkan list repository asli yang diterima dari API', async () => {
		await render(RepositoryStepTestHost, {
			repositories: [mockRepo1],
			githubConnected: true
		});

		const repoName = page.getByText('real-api-repo');
		await expect.element(repoName).toBeVisible();
	});

	it('pada tab Public Git URL, tombol Lanjut disabled saat input kosong atau URL tidak valid', async () => {
		await render(RepositoryStepTestHost, {
			repositories: [],
			githubConnected: true
		});

		const publicTab = page.getByRole('button', { name: 'Public Git URL' });
		await publicTab.click();

		const nextBtn = page.getByRole('button', { name: /lanjut/i });
		await expect.element(nextBtn).toBeDisabled();

		const input = page.getByPlaceholder(/github\.com/i);
		await input.fill('http://app.sakala.test:5173/projects/123');
		input.element().dispatchEvent(new Event('blur'));

		await expect.element(nextBtn).toBeDisabled();
		const errorText = page.getByText(/URL harus berupa repository GitHub publik/i);
		await expect.element(errorText).toBeVisible();

		await input.fill('https://github.com/my-org/my-project');
		await expect.element(nextBtn).toBeEnabled();
	});

	it('pada tab Public Git URL, menampilkan error API jika validasi backend gagal dan tidak memanggil onNext', async () => {
		const onNext = vi.fn();
		const onValidateGitUrl = vi.fn().mockRejectedValue(
			new ApiError('Data tidak valid', 422, {
				repository_url: ['Repository GitHub tidak ditemukan atau bersifat private.']
			})
		);

		await render(RepositoryStepTestHost, {
			repositories: [],
			githubConnected: true,
			onNext,
			onValidateGitUrl
		});

		const publicTab = page.getByRole('button', { name: 'Public Git URL' });
		await publicTab.click();

		const input = page.getByPlaceholder(/github\.com/i);
		await input.fill('https://github.com/my-org/private-repo');

		const nextBtn = page.getByRole('button', { name: /lanjut/i });
		await expect.element(nextBtn).toBeEnabled();
		await nextBtn.click();

		expect(onValidateGitUrl).toHaveBeenCalledWith('https://github.com/my-org/private-repo');
		const errorMsg = page.getByText('Repository GitHub tidak ditemukan atau bersifat private.');
		await expect.element(errorMsg).toBeVisible();
		expect(onNext).not.toHaveBeenCalled();
	});

	it('pada tab Public Git URL, berhasil validasi memanggil onNext', async () => {
		const onNext = vi.fn();
		const onValidateGitUrl = vi.fn().mockResolvedValue({
			id: '999',
			name: 'valid-repo',
			full_name: 'org/valid-repo',
			clone_url: 'https://github.com/org/valid-repo.git',
			default_branch: 'main',
			pushed_at: '2026-03-01T00:00:00Z',
			private: false
		});

		await render(RepositoryStepTestHost, {
			repositories: [],
			githubConnected: true,
			onNext,
			onValidateGitUrl
		});

		const publicTab = page.getByRole('button', { name: 'Public Git URL' });
		await publicTab.click();

		const input = page.getByPlaceholder(/github\.com/i);
		await input.fill('https://github.com/org/valid-repo');

		const nextBtn = page.getByRole('button', { name: /lanjut/i });
		await nextBtn.click();

		expect(onValidateGitUrl).toHaveBeenCalledWith('https://github.com/org/valid-repo');
		expect(onNext).toHaveBeenCalledOnce();
	});

	it('pada tab Public Git URL, menerapkan default_branch selain main dari backend meskipun input sempat blur sebelum validasi', async () => {
		const onNext = vi.fn();
		let wizardInstance: ProjectWizardState | undefined;
		const onValidateGitUrl = vi.fn().mockResolvedValue({
			id: '888',
			name: 'production-repo',
			full_name: 'org/production-repo',
			clone_url: 'https://github.com/org/production-repo.git',
			default_branch: 'production',
			pushed_at: '2026-03-01T00:00:00Z',
			private: false
		});

		await render(RepositoryStepTestHost, {
			repositories: [],
			githubConnected: true,
			onNext,
			onValidateGitUrl,
			onReady: (w) => {
				wizardInstance = w;
			}
		});

		const publicTab = page.getByRole('button', { name: 'Public Git URL' });
		await publicTab.click();

		const input = page.getByPlaceholder(/github\.com/i);
		await input.fill('https://github.com/org/production-repo');

		input.element().dispatchEvent(new Event('blur'));

		expect(wizardInstance?.selectedBranch).toBe('');

		const nextBtn = page.getByRole('button', { name: /lanjut/i });
		await nextBtn.click();

		expect(onValidateGitUrl).toHaveBeenCalledWith('https://github.com/org/production-repo');
		expect(onNext).toHaveBeenCalledOnce();

		expect(wizardInstance?.selectedBranch).toBe('production');
		expect(wizardInstance?.projectName).toBe('production-repo');
		expect(wizardInstance?.selectedRepository?.default_branch).toBe('production');
		expect(wizardInstance?.selectedRepository?.clone_url).toBe(
			'https://github.com/org/production-repo.git'
		);
		expect(wizardInstance?.selectedRepository?.id).toBe('888');
	});

	it('pada tab Public Git URL, mengunci input saat validasi dan mengabaikan response jika URL berubah saat request pending', async () => {
		const onNext = vi.fn();
		let wizardInstance: ProjectWizardState | undefined;
		let resolveValidation: (value: unknown) => void;
		const validationPromise = new Promise((resolve) => {
			resolveValidation = resolve;
		});
		const onValidateGitUrl = vi.fn().mockImplementation(() => validationPromise);

		await render(RepositoryStepTestHost, {
			repositories: [],
			githubConnected: true,
			onNext,
			onValidateGitUrl,
			onReady: (w) => {
				wizardInstance = w;
			}
		});

		const publicTab = page.getByRole('button', { name: 'Public Git URL' });
		await publicTab.click();

		const input = page.getByPlaceholder(/github\.com/i);
		await input.fill('https://github.com/org/repo-a');

		const nextBtn = page.getByRole('button', { name: /lanjut/i });
		await nextBtn.click();

		expect(onValidateGitUrl).toHaveBeenCalledWith('https://github.com/org/repo-a');

		await expect.element(input).toBeDisabled();

		if (wizardInstance) {
			wizardInstance.gitUrl = 'https://github.com/org/repo-b';
		}

		resolveValidation!({
			id: '111',
			name: 'repo-a',
			full_name: 'org/repo-a',
			clone_url: 'https://github.com/org/repo-a.git',
			default_branch: 'main',
			pushed_at: '2026-03-01T00:00:00Z',
			private: false
		});

		await new Promise((r) => setTimeout(r, 50));

		expect(onNext).not.toHaveBeenCalled();
		expect(wizardInstance?.selectedRepository?.id).not.toBe('111');
	});
});

const installation = (id: string, login: string, status = 'active') => ({
	id,
	account_login: login,
	account_type: 'User',
	repository_selection: 'all',
	status,
	created_at: '2026-01-01T00:00:00Z',
	updated_at: '2026-01-01T00:00:00Z'
});

describe('RepositoryStep: repository list from the API', () => {
	it('shows the true count from the API, not the size of the page', async () => {
		await render(RepositoryStepTestHost, {
			repositories: [mockRepo1],
			total: 12,
			currentPage: 1,
			lastPage: 3
		});

		await expect.element(page.getByRole('status')).toHaveTextContent(/Menampilkan\s*1\s*dari\s*12/);
	});

	it('asks for the next page instead of slicing what it has', async () => {
		const onPageChange = vi.fn();
		await render(RepositoryStepTestHost, {
			repositories: [mockRepo1],
			total: 12,
			currentPage: 1,
			lastPage: 3,
			onPageChange
		});

		await page.getByRole('button', { name: 'Halaman 2' }).click();

		expect(onPageChange).toHaveBeenCalledWith(2);
	});

	it('sends the search to the API, and does not filter the page itself', async () => {
		const onSearch = vi.fn();
		await render(RepositoryStepTestHost, { repositories: [mockRepo1], onSearch });

		await page.getByPlaceholder('Cari repository...').fill('tidak-cocok');

		await vi.waitFor(() => expect(onSearch).toHaveBeenCalledWith('tidak-cocok'));
		await expect.element(page.getByText('org/real-api-repo')).toBeVisible();
	});

	it('tells zero repositories apart from no search hits', async () => {
		const configureUrl = 'http://api.test/auth/github/installations/i1/configure';
		const screen = await render(RepositoryStepTestHost, {
			repositories: [],
			total: 0,
			installationId: 'i1',
			installations: [installation('i1', 'rani')],
			configureUrl
		});

		await expect.element(page.getByText('Belum ada repository yang bisa dipilih')).toBeVisible();
		await expect.element(page.getByText(/repository mana pun di rani/)).toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'Atur akses repository' }))
			.toHaveAttribute('href', configureUrl);

		await page.getByPlaceholder('Cari repository...').fill('kopi');

		await expect.element(page.getByText('Tidak ada repository yang cocok')).toBeVisible();
		await expect
			.element(page.getByText('Belum ada repository yang bisa dipilih'))
			.not.toBeInTheDocument();

		await page.getByRole('button', { name: 'Hapus pencarian' }).click();

		await expect.element(page.getByText('Belum ada repository yang bisa dipilih')).toBeVisible();
		await screen.unmount();
	});

	it('offers a switcher only when there is more than one installation', async () => {
		const onInstallationChange = vi.fn();
		const screen = await render(RepositoryStepTestHost, {
			repositories: [mockRepo1],
			installationId: 'i1',
			installations: [installation('i1', 'rani')],
			onInstallationChange
		});
		await expect.element(page.getByLabelText('Akun GitHub')).not.toBeInTheDocument();
		await screen.unmount();

		await render(RepositoryStepTestHost, {
			repositories: [mockRepo1],
			installationId: 'i1',
			installations: [installation('i1', 'rani'), installation('i2', 'kopi-org', 'suspended')],
			onInstallationChange
		});

		const switcher = page.getByLabelText('Akun GitHub');
		await expect.element(switcher).toHaveValue('i1');
		await expect
			.element(page.getByRole('option', { name: 'kopi-org (tidak aktif)' }))
			.toBeInTheDocument();
		await switcher.selectOptions('i2');

		expect(onInstallationChange).toHaveBeenCalledWith('i2');
	});

	it('offers a real reconnect link when the installation is inactive', async () => {
		const reconnectUrl = 'http://api.test/auth/github/installations/i1/configure';
		await render(RepositoryStepTestHost, {
			repositories: [],
			errorMessage: 'Instalasi GitHub rani sudah tidak aktif.',
			reconnectUrl,
			installationId: 'i1',
			installations: [installation('i1', 'rani', 'suspended'), installation('i2', 'kopi-org')]
		});

		const link = page.getByRole('link', { name: 'Hubungkan ulang GitHub' });
		await expect.element(link).toHaveAttribute('href', reconnectUrl);
		// Same tab, because GitHub sends the user back to this wizard.
		await expect.element(link).not.toHaveAttribute('target');
		// The other account stays reachable.
		await expect.element(page.getByLabelText('Akun GitHub')).toBeVisible();
	});

	it('"Gunakan Public Git URL" is a real control that switches the source', async () => {
		await render(RepositoryStepTestHost, { repositories: [], githubConnected: false });

		await page.getByRole('button', { name: 'Gunakan Public Git URL' }).click();

		await expect.element(page.getByLabelText('URL repository publik')).toBeVisible();
	});

	it('does not move on when the pilot quota is used up', async () => {
		await render(RepositoryStepTestHost, { repositories: [mockRepo1], blocked: true });

		await page.getByRole('radio').click();

		await expect.element(page.getByRole('button', { name: /lanjut/i })).toBeDisabled();
	});
});
