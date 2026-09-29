import { page } from 'vitest/browser';
import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ProjectCard from './ProjectCard.svelte';
import type { Project, RuntimeStatus } from '$lib/api/resources/projects';
import { formatDate } from '$lib/utils/date';

const baseProject: Project = {
	id: 'proj_1',
	name: 'Sakala Console',
	repository_full_name: 'gmedia/sakala-console',
	repository_source: 'github_installation',
	github_installation_id: '123',
	github_repository_id: 456,
	branch: 'main',
	thumbnail_url: null,
	runtime_status: 'running',
	last_deployed_at: '2026-09-10T10:00:00Z',
	created_at: '2026-01-01T00:00:00Z'
};

describe('ProjectCard — status badge', () => {
	test('menampilkan runtime status', async () => {
		await render(ProjectCard, {
			...baseProject,
			runtime_status: 'running'
		});

		const badge = page.getByTestId('runtime-status-badge');

		await expect.element(badge).toBeVisible();
		await expect.element(badge).toHaveTextContent('Live');
	});

	test('tetap menampilkan fallback untuk runtime status yang tidak dikenal', async () => {
		await render(ProjectCard, {
			...baseProject,
			runtime_status: 'maintenance'
		});

		const badge = page.getByTestId('runtime-status-badge');

		await expect.element(badge).toBeVisible();
		await expect.element(badge).toHaveTextContent('Lainnya');
	});
});

describe('ProjectCard — action link', () => {
	test('anchor "Lihat detail" mengarah ke URL project yang benar', async () => {
		await render(ProjectCard, baseProject);

		const link = page.getByRole('link', { name: /lihat detail/i });
		await expect.element(link).toHaveAttribute('href', `/projects/${baseProject.id}`);
	});
});

describe('ProjectCard — long content', () => {
	test('nama project yang sangat panjang tetap ada full text via title attribute', async () => {
		const longName = 'Proyek dengan nama super panjang '.repeat(5).trim();
		await render(ProjectCard, { ...baseProject, name: longName });

		const nameEl = page.getByTitle(longName);
		await expect.element(nameEl).toBeInTheDocument();
	});

	test('repository name yang panjang tetap ada full text via title attribute', async () => {
		const longRepo = 'gmedia/sebuah-nama-repository-yang-cukup-panjang-untuk-truncate';
		await render(ProjectCard, { ...baseProject, repository_full_name: longRepo });

		await expect.element(page.getByTitle(longRepo)).toBeInTheDocument();
	});
});

describe('ProjectCard — thumbnail placeholder', () => {
	test('menampilkan gambar saat thumbnail_url ada', async () => {
		await render(ProjectCard, { ...baseProject, thumbnail_url: 'https://example.com/thumb.png' });

		await expect.element(page.getByRole('img', { name: baseProject.name })).toBeVisible();
	});

	test.each<[RuntimeStatus, string]>([
		['deploying', 'Menunggu build selesai...'],
		['failed', 'Deployment gagal'],
		['stopped', 'Project sedang berhenti'],
		['crashed', 'Project mengalami crash'],
		['not_deployed', 'Belum Deploy'],
		['running', 'Belum memiliki thumbnail']
	])(
		'placeholder benar saat thumbnail_url null dan status %s',
		async (runtime_status, expectedText) => {
			await render(ProjectCard, {
				...baseProject,
				thumbnail_url: null,
				runtime_status
			});

			await expect
				.element(page.getByTestId('thumbnail-placeholder'))
				.toHaveTextContent(expectedText);
		}
	);
});

describe('ProjectCard — nullable fields', () => {
	test('repository_full_name null tidak crash dan tidak menampilkan teks "null"', async () => {
		await render(ProjectCard, { ...baseProject, repository_full_name: null });

		await expect.element(page.getByText(baseProject.name, { exact: true })).toBeVisible();
		await expect.element(page.getByText('null', { exact: true })).not.toBeInTheDocument();
	});
});

describe('ProjectCard — last deployment', () => {
	test('menampilkan tanggal last deployment, bukan tanggal project dibuat', async () => {
		await render(ProjectCard, {
			...baseProject,
			created_at: '2026-01-01T00:00:00Z',
			last_deployed_at: '2026-09-10T10:00:00Z'
		});

		await expect
			.element(page.getByText(formatDate('2026-09-10T10:00:00Z'), { exact: true }))
			.toBeVisible();

		await expect
			.element(page.getByText(formatDate('2026-01-01T00:00:00Z'), { exact: true }))
			.not.toBeInTheDocument();
	});

	test('menampilkan "Belum pernah deploy" ketika last_deployed_at null', async () => {
		await render(ProjectCard, {
			...baseProject,
			last_deployed_at: null
		});

		await expect.element(page.getByText('Belum pernah deploy', { exact: true })).toBeVisible();
	});
});
