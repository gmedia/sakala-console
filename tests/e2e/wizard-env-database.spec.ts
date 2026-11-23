import { expect, test, type Page } from '@playwright/test';
import {
	createdProject,
	DEPLOYMENT_ID,
	mockWizardApi,
	PROJECT_ID,
	repository,
	type WizardApi
} from './fixtures/create-project';
import { baseProject, mockProjectApi } from './fixtures/project-detail';
import {
	attachedDatabase,
	databaseLimits,
	laravelInspection,
	mockWorkspaceDatabases
} from './fixtures/wizard-env-database';

const DEPLOYMENT_URL = new RegExp(`/projects/${PROJECT_ID}/deployments/${DEPLOYMENT_ID}$`);
const EXAMPLES_REPOSITORY = 'https://github.com/gmedia/sakala-examples';

/** The Laravel example as the API returns it once created and inspected. */
const laravelProject = {
	...createdProject,
	name: 'contoh-laravel',
	slug: 'contoh-laravel',
	repository_url: EXAMPLES_REPOSITORY,
	repository_full_name: 'gmedia/sakala-examples',
	repository_source: 'public_url',
	default_domain: 'contoh-laravel.apps.example.test',
	public_url: 'https://contoh-laravel.apps.example.test',
	root_directory: 'laravel',
	release_command: 'php artisan migrate --force',
	...laravelInspection()
};

const exampleRepository = () => ({
	body: {
		data: {
			...repository(9, 'gmedia'),
			name: 'sakala-examples',
			full_name: 'gmedia/sakala-examples',
			clone_url: `${EXAMPLES_REPOSITORY}.git`,
			default_branch: 'main'
		}
	}
});

/** The wizard with saved variables listed back by the API, as it does after each POST. */
async function mockLaravelWizard(page: Page, api: WizardApi = {}) {
	const saved: Record<string, unknown>[] = [];
	const calls = await mockWizardApi(page, {
		installations: () => ({ body: { data: [] } }),
		validate: exampleRepository,
		pilotLimits: () => databaseLimits(),
		envList: () =>
			saved.map((env, index) => ({
				id: index + 1,
				key: env.key,
				is_secret: env.is_secret,
				created_at: '2026-11-19T10:00:00Z'
			})),
		addEnv: (body) => {
			saved.push(body);
			return { status: 201, body: { data: { id: saved.length, ...body } } };
		},
		project: () => laravelProject,
		...api
	});
	return calls;
}

async function createLaravelExample(page: Page) {
	await page.goto('/projects/new?example=laravel');
	await expect(page.getByRole('heading', { name: 'Persiapan deployment' })).toBeVisible();
	await page.getByRole('button', { name: 'Buat dan deploy' }).click();
}

test.describe('the first deploy offers a database and the variables of .env.example', () => {
	test('Laravel example: a new database for the project, then the deploy the API starts', async ({
		page
	}) => {
		let created = false;
		let readsAfterCreate = 0;
		const calls = await mockLaravelWizard(page, {
			project: () => {
				if (!created) return laravelProject;
				readsAfterCreate += 1;
				const database =
					readsAfterCreate < 3
						? attachedDatabase('provisioning', { status: 'waiting', deployment_id: null })
						: attachedDatabase('ready', { status: 'started', deployment_id: DEPLOYMENT_ID });
				return { ...laravelProject, databases: [database] };
			}
		});
		const databases = await mockWorkspaceDatabases(page, {
			projectId: PROJECT_ID,
			create: () => {
				created = true;
				return undefined;
			}
		});

		await createLaravelExample(page);

		const card = page.getByTestId('database-choice');
		await expect(
			card.getByRole('heading', { name: 'Aplikasi ini sepertinya butuh database' })
		).toBeVisible();
		await expect(card.getByTestId('database-signals')).toHaveText(
			'Sakala menemukan DB_CONNECTION di .env.example dan migration Laravel di database/migrations.'
		);
		await expect(card.getByLabel(/Buat database baru untuk proyek ini/)).toBeChecked();
		await expect(card.getByTestId('database-engine-note')).toContainText(
			'hilang saat proyek tidur, di-restart, atau di-deploy ulang'
		);
		// Uploads on the app's own disk are gone after a sleep too: one calm note, with the guide.
		const fileNote = page.getByTestId('file-storage-note');
		await expect(fileNote).toContainText('object storage yang kompatibel dengan S3');
		await expect(fileNote.getByRole('link', { name: /Panduan penyimpanan file/ })).toHaveAttribute(
			'href',
			'https://sakala.dev/docs/penyimpanan-file#laravel'
		);
		await expect(card).toContainText(
			'Release command proyek ini tetap: php artisan migrate --force'
		);
		// The step's lead says what Sakala did and what is left.
		await expect(
			page.getByText(/Tinggal pilihan database dan 2 variabel yang perlu kamu isi/)
		).toBeVisible();

		// The starter's APP_KEY was saved on step 2, so it is not suggested again.
		await expect(page.getByText('Sudah ada di proyek, tidak diubah: APP_KEY.')).toBeVisible();
		await expect(
			page.getByText(/Contoh: key-from-mailgun\. Kosongkan kalau belum perlu\./)
		).toBeVisible();
		await page.getByRole('textbox', { name: 'Nilai MAILGUN_SECRET' }).fill('mg-live-123');
		expect(calls.addEnv).toHaveLength(1);

		await page.getByRole('button', { name: 'Deploy sekarang' }).click();

		await expect(page.getByTestId('database-wait')).toContainText('Database sedang dibuat');
		await expect(page).toHaveURL(DEPLOYMENT_URL, { timeout: 15_000 });

		expect(databases.create).toEqual([{ project_id: PROJECT_ID, deploy_when_ready: true }]);
		// The API starts the deployment once the database is ready; the Console never does here.
		expect(calls.deploy).toHaveLength(0);
		const stepThree = calls.addEnv.slice(1);
		expect(stepThree.map((env) => env.key)).toEqual([
			'APP_NAME',
			'APP_ENV',
			'APP_DEBUG',
			'APP_URL',
			'LOG_LEVEL',
			'SESSION_DRIVER',
			'MAIL_MAILER',
			'MAIL_HOST',
			'MAILGUN_SECRET'
		]);
		expect(stepThree).toContainEqual({ key: 'APP_ENV', value: 'production', is_secret: false });
		expect(stepThree).toContainEqual({ key: 'APP_DEBUG', value: 'false', is_secret: false });
		expect(stepThree).toContainEqual({ key: 'LOG_LEVEL', value: 'info', is_secret: false });
		expect(stepThree).toContainEqual({
			key: 'APP_URL',
			value: 'https://contoh-laravel.apps.example.test',
			is_secret: false
		});
		expect(stepThree).toContainEqual({
			key: 'MAILGUN_SECRET',
			value: 'mg-live-123',
			is_secret: true
		});
	});

	test('without managed databases: says why, defaults to none, and deploys at once', async ({
		page
	}) => {
		const calls = await mockLaravelWizard(page, {
			pilotLimits: () => databaseLimits({ available: false })
		});
		const databases = await mockWorkspaceDatabases(page, { projectId: PROJECT_ID });

		await createLaravelExample(page);

		const card = page.getByTestId('database-choice');
		await expect(card.getByLabel(/Buat database baru untuk proyek ini/)).toBeDisabled();
		await expect(card).toContainText(
			'Database terkelola belum tersedia di server ini, jadi database baru belum bisa dibuat dari sini.'
		);
		await expect(card.getByLabel(/Tanpa database/)).toBeChecked();

		await page.getByRole('button', { name: 'Deploy sekarang' }).click();
		await expect(page).toHaveURL(DEPLOYMENT_URL);

		expect(databases.create).toEqual([]);
		expect(calls.deploy).toHaveLength(1);
		// Without a Sakala database, the DB rows are the app's own and the example's go along.
		expect(calls.addEnv.map((env) => env.key)).toContain('DB_CONNECTION');
	});

	test('a reload while the database is made shows the wait, not the suggestions again', async ({
		page
	}) => {
		let reads = 0;
		await mockLaravelWizard(page, {
			project: () => {
				reads += 1;
				const database =
					reads < 3
						? attachedDatabase('provisioning', { status: 'waiting', deployment_id: null })
						: attachedDatabase('ready', { status: 'started', deployment_id: DEPLOYMENT_ID });
				return { ...laravelProject, databases: [database] };
			}
		});
		await mockWorkspaceDatabases(page, { projectId: PROJECT_ID });

		await page.goto(`/projects/new?project=${PROJECT_ID}&deploy=1`);

		await expect(page.getByTestId('database-wait')).toBeVisible();
		await expect(page.getByTestId('prepare-first-deploy')).toHaveCount(0);
		await expect(page).toHaveURL(DEPLOYMENT_URL, { timeout: 15_000 });
	});
});

test.describe('the Variabel tab fills from .env.example', () => {
	test('Isi dari .env.example: inputs for credentials, Lewati for existing keys', async ({
		page
	}) => {
		const added: Record<string, unknown>[] = [];
		await mockProjectApi(page, {
			project: () => ({ ...baseProject, ...laravelInspection(), databases: [] }),
			envList: () => [
				{
					id: 7,
					key: 'APP_NAME',
					is_secret: false,
					value: 'Toko',
					created_at: '2026-01-01T00:00:00Z'
				}
			],
			addEnv: (body) => {
				added.push(body);
				return { status: 201, body: { data: { id: 8 + added.length, ...body } } };
			}
		});
		await page.goto(`/projects/${PROJECT_ID}/environments`);

		await page.getByRole('button', { name: 'Isi dari .env.example' }).click();
		const panel = page.getByTestId('env-import');
		await expect(panel.getByRole('heading', { name: 'Isi dari .env.example' })).toBeVisible();
		await expect(panel.getByText('Untuk 1 variabel yang sudah ada (APP_NAME)')).toBeVisible();
		await expect(panel.getByLabel('Lewati, pertahankan nilai yang sekarang')).toBeChecked();

		await panel.getByRole('textbox', { name: 'Nilai MAIL_PASSWORD' }).fill('smtp-pass');
		await panel.getByRole('button', { name: /^Simpan \d+ variabel$/ }).click();

		await expect(page.getByText(/variabel disimpan/)).toBeVisible();
		const keys = added.map((env) => env.key);
		expect(keys).not.toContain('APP_NAME');
		expect(keys).not.toContain('PORT');
		expect(keys).toContain('APP_KEY');
		expect(added).toContainEqual({ key: 'MAIL_PASSWORD', value: 'smtp-pass', is_secret: true });
		const appKey = added.find((env) => env.key === 'APP_KEY');
		expect(appKey).toMatchObject({ is_secret: true });
		expect(String(appKey?.value)).toMatch(/^base64:[A-Za-z0-9+/]{43}=$/);
	});

	test('a link from the overview opens the suggestions directly', async ({ page }) => {
		await mockProjectApi(page, {
			project: () => ({ ...baseProject, ...laravelInspection(), databases: [] }),
			envList: () => []
		});
		await page.goto(`/projects/${PROJECT_ID}/environments#isi-dari-env-example`);

		await expect(
			page.getByTestId('env-import').getByRole('heading', { name: 'Isi dari .env.example' })
		).toBeVisible();
	});
});
