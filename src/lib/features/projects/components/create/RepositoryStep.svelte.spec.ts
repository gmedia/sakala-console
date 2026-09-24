import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
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

		const emptyTitle = page.getByText('Tidak menemukan repository');
		await expect.element(emptyTitle).toBeVisible();

		// Pastikan mock data tidak muncul
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

		const errorTitle = page.getByText('Gagal Memuat Repository');
		await expect.element(errorTitle).toBeVisible();

		const errorDesc = page.getByText(/Gagal memuat daftar repository GitHub/i);
		await expect.element(errorDesc).toBeVisible();

		const retryBtn = page.getByRole('button', { name: /coba lagi/i });
		await expect.element(retryBtn).toBeVisible();
		await retryBtn.click();
		expect(onRetry).toHaveBeenCalledOnce();

		// Pastikan mock data tidak muncul saat error
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

		const errorTitle = page.getByText('Gagal Memuat Repository');
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
		const onValidateGitUrl = vi.fn().mockRejectedValue({
			isValidationError: true,
			errors: {
				repository_url: ['Repository GitHub tidak ditemukan atau bersifat private.']
			}
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

		// Simulasikan blur sebelum user mengklik tombol Lanjut
		input.element().dispatchEvent(new Event('blur'));

		// Pastikan saat blur belum menerapkan fallback default branch
		expect(wizardInstance?.selectedBranch).toBe('');

		const nextBtn = page.getByRole('button', { name: /lanjut/i });
		await nextBtn.click();

		expect(onValidateGitUrl).toHaveBeenCalledWith('https://github.com/org/production-repo');
		expect(onNext).toHaveBeenCalledOnce();

		// Metadata authoritative dari backend harus diterapkan, bukan fallback main
		expect(wizardInstance?.selectedBranch).toBe('production');
		expect(wizardInstance?.projectName).toBe('production-repo');
		expect(wizardInstance?.selectedRepository?.default_branch).toBe('production');
		expect(wizardInstance?.selectedRepository?.clone_url).toBe(
			'https://github.com/org/production-repo.git'
		);
		expect(wizardInstance?.selectedRepository?.id).toBe('888');
	});
});
