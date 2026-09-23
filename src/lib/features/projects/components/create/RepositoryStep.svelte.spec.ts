import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import RepositoryStepTestHost from './RepositoryStepTestHost.svelte';
import type { Repository } from '../../type';

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
});
