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
	public_url: 'https://sakala-console.run.sakala.dev',
	latest_deployment: null,
	runtime_status: 'running',
	suspension: null,
	stack: null,
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

describe('ProjectCard — link', () => {
	test('nama proyek adalah tautan ke halaman proyek, dan membentang menutupi kartu', async () => {
		await render(ProjectCard, baseProject);

		const link = page.getByRole('link', { name: baseProject.name });
		await expect.element(link).toHaveAttribute('href', `/projects/${baseProject.id}`);
		await expect.element(link).toHaveClass(/after:inset-0/);
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
		await render(ProjectCard, {
			...baseProject,
			runtime_status: 'stopped',
			repository_full_name: longRepo
		});

		await expect.element(page.getByTitle(longRepo)).toBeInTheDocument();
	});
});

describe('ProjectCard — isi', () => {
	test('tidak punya kotak thumbnail, bahkan kalau API mengirim thumbnail_url', async () => {
		await render(ProjectCard, { ...baseProject, thumbnail_url: 'https://example.test/a.png' });

		await expect.element(page.getByRole('img')).not.toBeInTheDocument();
		await expect.element(page.getByTestId('thumbnail-placeholder')).not.toBeInTheDocument();
	});

	test('menampilkan chip framework hanya kalau inspeksi menyebutkannya, dengan nama yang rapi', async () => {
		const stack = { builder: 'railpack', provider: 'node', package_manager: null } as const;
		const screen = await render(ProjectCard, {
			...baseProject,
			stack: { ...stack, framework: 'next' }
		});
		await expect.element(page.getByTestId('framework-chip')).toHaveTextContent('Next.js');
		screen.unmount();

		await render(ProjectCard, { ...baseProject, stack: { ...stack, framework: null } });
		await expect.element(page.getByTestId('framework-chip')).not.toBeInTheDocument();
	});

	test.each<[RuntimeStatus, string]>([
		['deploying', 'Men-deploy'],
		['failed', 'Gagal'],
		['stopped', 'Berhenti'],
		['crashed', 'Crash'],
		['not_deployed', 'Belum deploy'],
		['running', 'Live']
	])('badge status %s berbunyi %s', async (runtime_status, label) => {
		await render(ProjectCard, { ...baseProject, runtime_status });

		await expect.element(page.getByTestId('runtime-status-badge')).toHaveTextContent(label);
	});
});

describe('ProjectCard — nullable fields', () => {
	test('repository_full_name null tidak crash dan tidak menampilkan teks "null"', async () => {
		await render(ProjectCard, { ...baseProject, repository_full_name: null });

		await expect.element(page.getByText(baseProject.name, { exact: true })).toBeVisible();
		await expect.element(page.getByText('null', { exact: true })).not.toBeInTheDocument();
	});
});

describe('ProjectCard — last deployment', () => {
	test('menampilkan waktu relatif dari last deployment, dengan tanggal lengkap di title', async () => {
		const lastDeployed = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
		await render(ProjectCard, {
			...baseProject,
			created_at: '2026-01-01T00:00:00Z',
			last_deployed_at: lastDeployed
		});

		const time = page.getByText('Deploy 3 jam yang lalu', { exact: true });
		await expect.element(time).toBeVisible();
		await expect.element(time).toHaveAttribute('title', formatDate(lastDeployed));
	});

	test('menampilkan "Belum pernah deploy" ketika last_deployed_at null', async () => {
		await render(ProjectCard, {
			...baseProject,
			last_deployed_at: null
		});

		await expect.element(page.getByText('Belum pernah deploy', { exact: true })).toBeVisible();
	});
});

describe('ProjectCard, what the list now knows', () => {
	const latest = {
		id: 'dep_9',
		sequence: 9,
		status: 'succeeded',
		branch: 'develop',
		commit_sha: 'a3f2c9d81be0',
		commit_message: 'feat: tambah halaman menu',
		created_at: '2026-09-10T10:00:00Z',
		finished_at: '2026-09-10T10:02:00Z'
	};

	test('links a live project to its address, above the link to the project', async () => {
		await render(ProjectCard, {
			...baseProject,
			public_url: 'https://toko.run.sakala.dev',
			latest_deployment: latest
		});

		const url = page.getByTestId('project-card-url');
		await expect.element(url).toHaveAttribute('href', 'https://toko.run.sakala.dev');
		await expect.element(url).toHaveTextContent('toko.run.sakala.dev');
		expect(url.element().className).toContain('z-10');
	});

	test('does not offer a site that is not up', async () => {
		await render(ProjectCard, {
			...baseProject,
			runtime_status: 'failed',
			public_url: 'https://toko.run.sakala.dev',
			latest_deployment: latest
		});

		await expect.element(page.getByTestId('project-card-url')).not.toBeInTheDocument();
		await expect.element(page.getByText('gmedia/sakala-console')).toBeVisible();
	});

	test('shows the last commit and its branch', async () => {
		await render(ProjectCard, { ...baseProject, latest_deployment: latest });

		await expect
			.element(page.getByTestId('project-card-commit'))
			.toHaveTextContent('feat: tambah halaman menu');
		await expect.element(page.getByText('a3f2c9d')).toBeVisible();
		await expect.element(page.getByText('develop')).toBeVisible();
	});

	test('holds up with no deployment at all, and with an empty commit', async () => {
		const { unmount } = await render(ProjectCard, {
			...baseProject,
			last_deployed_at: null,
			latest_deployment: null
		});
		await expect.element(page.getByText('Belum pernah deploy')).toBeVisible();
		await expect.element(page.getByTestId('project-card-commit')).not.toBeInTheDocument();
		unmount();

		await render(ProjectCard, {
			...baseProject,
			latest_deployment: { ...latest, commit_message: null, commit_sha: null }
		});
		await expect.element(page.getByTestId('project-card-commit')).not.toBeInTheDocument();
	});
});
