import { page, userEvent } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { apiRequest } from '$lib/api/client';
import { QUOTA_COPY } from '$lib/features/databases/presentation';
import { FILE_STORAGE_GUIDE_URL } from '$lib/config/project';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import { FILE_STORAGE_COPY } from '../../file-storage';
import FirstDeployStepTestHost from './FirstDeployStepTestHost.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$lib/api/client', () => ({ apiRequest: vi.fn() }));

const WORKSPACE = { id: 'w-1', name: 'Rani', slug: 'rani', type: 'personal' };

const hint = (overrides: Record<string, unknown> = {}) => ({
	likely: true,
	engine: 'postgresql',
	signals: [
		{ kind: 'env_variable', file: '.env.example', name: 'DATABASE_URL' },
		{ kind: 'package_dependency', file: 'package.json', name: '@prisma/client' }
	],
	suggested_release_command: 'npx prisma migrate deploy',
	...overrides
});

const baseProject = {
	id: 'p-1',
	name: 'toko-kopi',
	repository_full_name: 'rani/toko-kopi',
	repository_url: 'https://github.com/rani/toko-kopi',
	branch: 'main',
	default_domain: 'toko-kopi.apps.example.test',
	public_url: 'https://toko-kopi.apps.example.test',
	configured_port: null,
	detected_port: null,
	effective_port: 3000,
	release_command: null,
	preview_status: 'succeeded',
	inspection_error_code: null,
	latest_deployment: null,
	databases: [] as unknown[],
	workspace: WORKSPACE,
	stack: { builder: 'railpack', provider: 'node', framework: null, package_manager: 'pnpm' },
	inspection: {
		repository_url: null,
		commit_sha: null,
		dockerfile_found: false,
		env_example_found: true,
		compose_found: false,
		manifests: ['package.json'],
		package_manager: 'pnpm',
		inspected_at: null,
		env_example: {
			file: '.env.example',
			entries: [
				{ key: 'APP_NAME', example_value: 'Toko Kopi' },
				{ key: 'NODE_ENV', example_value: 'development' },
				{ key: 'JWT_SECRET', example_value: null },
				{ key: 'STRIPE_SECRET', example_value: 'sk_live_abcdefghijklmnop' },
				{ key: 'SMTP_PASSWORD', example_value: 'ganti-saya' },
				{ key: 'DATABASE_URL', example_value: null },
				{ key: 'PORT', example_value: '3000' }
			],
			truncated: false
		},
		database_hint: hint()
	}
};

const limits = (overrides: { available?: boolean; used?: number; max?: number } = {}) => ({
	quotas: {
		max_projects_per_user: 3,
		max_active_deployments_per_user: 2,
		max_active_deployments_per_project: 1,
		current_projects_count: 1,
		current_active_deployments_count: 0,
		max_databases: overrides.max ?? 2,
		current_databases_count: overrides.used ?? 0,
		max_database_storage_mb: 512,
		current_database_storage_bytes: 0
	},
	databases: { available: overrides.available ?? true }
});

const ready = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
	id,
	name,
	engine: 'postgresql',
	status: 'ready',
	region: null,
	size_bytes: null,
	size_checked_at: null,
	projects: [],
	connection: null,
	last_failure: null,
	password_rotation: null,
	created_at: null,
	updated_at: null,
	...extra
});

let project: Record<string, unknown> = baseProject;
let databases: unknown[] = [];
const posted: { path: string; json: unknown }[] = [];

function renderStep(props: Record<string, unknown> = {}) {
	return render(QueryTestHost, {
		props: {
			component: FirstDeployStepTestHost,
			props: { projectId: 'p-1', autoDeploy: true, pilotLimits: limits(), ...props }
		}
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	project = baseProject;
	databases = [];
	posted.length = 0;
	vi.mocked(apiRequest).mockImplementation(async (path, options) => {
		const url = String(path);
		if (options?.method === 'POST') {
			posted.push({ path: url, json: options.json });
			if (url.endsWith('/deployments')) return { data: { id: 'd-1' } };
			return { data: { id: 'x', ...(options.json as object) } };
		}
		if (url.endsWith('/environment-variables')) return { data: [] };
		if (url.endsWith('/databases')) return { data: databases };
		return { data: project };
	});
});

describe('Persiapan, the database card', () => {
	it('preselects a new database, says why in plain words, and does not deploy by itself', async () => {
		await renderStep();

		await expect
			.element(page.getByRole('heading', { name: 'Aplikasi ini sepertinya butuh database' }))
			.toBeVisible();
		await expect
			.element(
				page.getByText(
					'Sakala menemukan DATABASE_URL di .env.example dan paket @prisma/client di package.json.'
				)
			)
			.toBeVisible();
		await expect.element(page.getByLabelText(/Buat database baru untuk proyek ini/)).toBeChecked();
		await expect
			.element(page.getByLabelText('Release command'))
			.toHaveValue('npx prisma migrate deploy');
		expect(posted).toEqual([]);
	});

	it('disables a new database when the installation has none, and defaults to none', async () => {
		await renderStep({ pilotLimits: limits({ available: false }) });

		await expect.element(page.getByLabelText(/Buat database baru untuk proyek ini/)).toBeDisabled();
		await expect
			.element(page.getByText(/Database terkelola belum tersedia di server ini, jadi/))
			.toBeVisible();
		await expect.element(page.getByLabelText(/Tanpa database/)).toBeChecked();
	});

	it('disables a new database when the quota is full, with the numbers', async () => {
		await renderStep({ pilotLimits: limits({ used: 2, max: 2 }) });

		await expect.element(page.getByLabelText(/Buat database baru untuk proyek ini/)).toBeDisabled();
		await expect.element(page.getByText(QUOTA_COPY.countFull(2))).toBeVisible();
		await expect.element(page.getByLabelText(/Tanpa database/)).toBeChecked();
	});

	it('is honest that a MySQL Laravel app gets PostgreSQL', async () => {
		project = {
			...baseProject,
			stack: { ...baseProject.stack, framework: 'laravel' },
			inspection: { ...baseProject.inspection, database_hint: hint({ engine: 'mysql' }) }
		};
		await renderStep();

		const note = page.getByTestId('database-engine-note');
		await expect.element(note).toHaveTextContent(/PostgreSQL, bukan MySQL.*DB_CONNECTION=pgsql/);
		await expect.element(note.getByRole('link')).not.toBeInTheDocument();
	});

	it('warns that SQLite data is lost on sleep and deploy, even with no database chosen', async () => {
		project = {
			...baseProject,
			inspection: { ...baseProject.inspection, database_hint: hint({ engine: 'sqlite' }) }
		};
		await renderStep({ pilotLimits: limits({ available: false }) });

		const note = page.getByTestId('database-engine-note');
		await expect
			.element(note)
			.toHaveTextContent(/hilang saat proyek tidur, di-restart, atau di-deploy ulang/);
		await expect
			.element(note.getByRole('link', { name: /Panduan penyimpanan file/ }))
			.toHaveAttribute('href', `${FILE_STORAGE_GUIDE_URL}#berkas-sqlite`);
	});

	it('does not suggest a Sakala database to a workspace without quota or one to use', async () => {
		project = {
			...baseProject,
			inspection: { ...baseProject.inspection, database_hint: hint({ engine: 'sqlite' }) }
		};
		await renderStep({ pilotLimits: limits({ used: 0, max: 0 }) });

		const note = page.getByTestId('database-engine-note');
		await expect.element(note).toHaveTextContent(/hilang saat proyek tidur/);
		await expect.element(note).toHaveTextContent(/database di luar container/);
		await expect.element(note).not.toHaveTextContent(/Database dari Sakala/);
	});

	it('still points at a Sakala database when the workspace has one this project can use', async () => {
		project = {
			...baseProject,
			inspection: { ...baseProject.inspection, database_hint: hint({ engine: 'sqlite' }) }
		};
		databases = [ready('db-c', 'cadangan')];
		await renderStep({ pilotLimits: limits({ used: 1, max: 1 }) });

		await expect
			.element(page.getByTestId('database-engine-note'))
			.toHaveTextContent(/Database dari Sakala menyimpan datanya tetap ada/);
	});

	it('lists every workspace database, disabling the ones it cannot use with the reason', async () => {
		databases = [
			ready('db-a', 'toko-teh-db', {
				projects: [{ id: 'p-2', name: 'toko-teh', slug: 'toko-teh' }]
			}),
			ready('db-b', 'baru', { status: 'provisioning' }),
			ready('db-c', 'cadangan')
		];
		await renderStep();

		await page.getByLabelText(/Pakai database yang sudah ada/).click();
		const select = page.getByLabelText('Database', { exact: true });
		await expect.element(select).toHaveValue('db-c');
		await expect
			.element(page.getByRole('option', { name: 'toko-teh-db (Dipakai toko-teh)' }))
			.toBeDisabled();
		await expect.element(page.getByRole('option', { name: 'baru (Masih dibuat)' })).toBeDisabled();
		await expect.element(page.getByRole('option', { name: 'cadangan' })).toBeEnabled();
	});

	it('keeps the question closed when a database is not likely, with none chosen', async () => {
		project = {
			...baseProject,
			inspection: { ...baseProject.inspection, database_hint: hint({ likely: false, signals: [] }) }
		};
		await renderStep();

		const question = page.getByRole('button', { name: 'Aplikasi ini butuh database?' });
		await expect.element(question).toHaveAttribute('aria-expanded', 'false');
		await question.click();
		await expect.element(page.getByLabelText(/Tanpa database/)).toBeChecked();
	});
});

describe('Persiapan, the variables', () => {
	it('opens only what needs the user, and never shows a secret-looking example', async () => {
		await renderStep();

		await expect
			.element(page.getByRole('textbox', { name: 'Nilai STRIPE_SECRET' }))
			.toHaveValue('');
		await expect
			.element(page.getByText('Contoh: ganti-saya. Kosongkan kalau belum perlu.'))
			.toBeVisible();
		expect(document.body.textContent).not.toContain('sk_live');
		for (const group of [
			/Dibuatkan Sakala \(1\)/,
			/Dari \.env\.example \(2\)/,
			/Diisi Sakala \(2\)/
		]) {
			await expect
				.element(page.getByRole('button', { name: group }))
				.toHaveAttribute('aria-expanded', 'false');
		}
	});

	it('saves the kept rows, skips an excluded or empty one, then deploys without a database', async () => {
		await renderStep({ pilotLimits: limits({ available: false }) });

		await page.getByRole('button', { name: /Dari \.env\.example/ }).click();
		await page.getByLabelText('Pakai APP_NAME').click();
		await page.getByRole('button', { name: 'Deploy sekarang' }).click();

		await vi.waitFor(() =>
			expect(posted.at(-1)?.path).toBe('/api/v1/app/projects/p-1/deployments')
		);
		const keys = posted
			.filter((call) => call.path.endsWith('/environment-variables'))
			.map((call) => (call.json as { key: string }).key);
		expect(keys).toEqual(['NODE_ENV', 'JWT_SECRET']);
		expect(posted.some((call) => call.path.endsWith('/databases'))).toBe(false);
	});

	it('creates the database for the project after the release command and variables', async () => {
		await renderStep();

		await page.getByRole('button', { name: 'Deploy sekarang' }).click();

		await vi.waitFor(() =>
			expect(posted.some((call) => call.path.endsWith('/databases'))).toBe(true)
		);
		expect(posted.map((call) => call.path.split('/').at(-1))).toEqual([
			'environment-variables',
			'environment-variables',
			'environment-variables',
			'databases'
		]);
		expect(posted.at(-1)?.json).toEqual({ project_id: 'p-1', deploy_when_ready: true });
		expect(vi.mocked(apiRequest)).toHaveBeenCalledWith(
			'/api/v1/app/projects/p-1',
			expect.objectContaining({
				method: 'PUT',
				json: { release_command: 'npx prisma migrate deploy' }
			})
		);
		expect(posted.some((call) => call.path.endsWith('/deployments'))).toBe(false);
	});
});

describe('Persiapan, files the app keeps itself', () => {
	const withEntries = (...keys: string[]) => ({
		...baseProject.inspection,
		env_example: {
			...baseProject.inspection.env_example,
			entries: [
				...baseProject.inspection.env_example.entries,
				...keys.map((key) => ({ key, example_value: null }))
			]
		}
	});

	it('tells a Laravel app where uploads go, linking the Laravel section, as a calm note', async () => {
		project = { ...baseProject, stack: { ...baseProject.stack, framework: 'laravel' } };
		await renderStep();

		const note = page.getByTestId('file-storage-note');
		await expect.element(note).toHaveTextContent(FILE_STORAGE_COPY.note);
		await expect.element(note).not.toHaveAttribute('role');
		const link = note.getByRole('link', { name: /Panduan penyimpanan file/ });
		await expect.element(link).toHaveAttribute('href', `${FILE_STORAGE_GUIDE_URL}#laravel`);
		await expect.element(link).toHaveAttribute('target', '_blank');
		expect(posted).toEqual([]);
	});

	it('links the Node section for a Node app with an upload folder in .env.example', async () => {
		project = { ...baseProject, inspection: withEntries('UPLOAD_DIR') };
		await renderStep();

		await expect
			.element(page.getByTestId('file-storage-note').getByRole('link'))
			.toHaveAttribute('href', `${FILE_STORAGE_GUIDE_URL}#node`);
	});

	it('says nothing when nothing suggests the app keeps files', async () => {
		await renderStep();

		await expect.element(page.getByTestId('prepare-first-deploy')).toBeVisible();
		await expect.element(page.getByTestId('file-storage-note')).not.toBeInTheDocument();
	});
});

describe('Persiapan while saving', () => {
	it('names the project, not the repository, in the lead', async () => {
		await renderStep();

		await expect
			.element(page.getByText(/^Sakala sudah membaca toko-kopi dan menyiapkan \d+ variabel\./))
			.toBeVisible();
		expect(document.body.textContent).not.toContain('membaca rani/toko-kopi');
	});

	it('keeps the count and the rows while each saved variable refreshes the list', async () => {
		// Each POST waits for the test, and the list answers what was saved so far, as the API does.
		const saved: string[] = [];
		const releases: (() => void)[] = [];
		vi.mocked(apiRequest).mockImplementation(async (path, options) => {
			const url = String(path);
			if (options?.method === 'POST' && url.endsWith('/environment-variables')) {
				const { key } = options.json as { key: string };
				await new Promise<void>((resume) => releases.push(resume));
				saved.push(key);
				return { data: { id: key, key } };
			}
			if (options?.method === 'POST') return { data: { id: 'x' } };
			if (url.endsWith('/environment-variables')) {
				return { data: saved.map((key) => ({ id: key, key, is_secret: false })) };
			}
			if (url.endsWith('/databases')) return { data: databases };
			return { data: project };
		});
		await renderStep({ pilotLimits: limits({ available: false }) });

		const lead = page.getByText(/^Sakala sudah membaca toko-kopi dan menyiapkan \d+ variabel\./);
		await expect.element(lead).toBeVisible();
		const before = lead.element().textContent;
		await page.getByRole('button', { name: 'Deploy sekarang' }).click();

		for (let count = 1; count <= 3; count++) {
			await vi.waitFor(() => expect(releases).toHaveLength(count));
			releases[count - 1]();
			await vi.waitFor(() => expect(saved).toHaveLength(count));
			// Give the refreshed list time to arrive before checking that nothing moved.
			await new Promise((done) => setTimeout(done, 50));
			await expect.element(lead).toHaveTextContent(before ?? '');
			expect(document.body.textContent).not.toContain('Sudah ada di proyek');
		}
	});
});

describe('Persiapan by keyboard', () => {
	it('moves the database choice with arrow keys and opens a group with Enter', async () => {
		databases = [ready('db-c', 'cadangan')];
		await renderStep();

		const create = page.getByLabelText(/Buat database baru untuk proyek ini/);
		await expect.element(create).toBeChecked();
		(create.element() as HTMLInputElement).focus();
		await userEvent.keyboard('{ArrowDown}');
		await expect.element(page.getByLabelText(/Pakai database yang sudah ada/)).toBeChecked();

		const group = page.getByRole('button', { name: /Diisi Sakala/ });
		(group.element() as HTMLButtonElement).focus();
		await userEvent.keyboard('{Enter}');
		await expect.element(group).toHaveAttribute('aria-expanded', 'true');
		await userEvent.keyboard(' ');
		await expect.element(group).toHaveAttribute('aria-expanded', 'false');
	});
});

describe('after a reload while the database is made', () => {
	it('shows the wait, not the suggestions again', async () => {
		project = {
			...baseProject,
			databases: [
				{
					id: 'db-1',
					name: 'toko-kopi',
					status: 'provisioning',
					region: null,
					variables: [],
					overridden_variables: [],
					deploy_when_ready: {
						status: 'waiting',
						requested_at: '2026-11-19T10:00:00Z',
						deployment_id: null,
						skipped_reason: null
					}
				}
			]
		};
		await renderStep();

		await expect.element(page.getByTestId('database-wait')).toBeVisible();
		await expect.element(page.getByTestId('prepare-first-deploy')).not.toBeInTheDocument();
		expect(posted).toEqual([]);
	});
});
