import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import {
	getDatabaseCredentials,
	parseCredentials,
	parseDatabase,
	parseDatabaseList,
	rotateDatabasePassword,
	type Database
} from '$lib/api/resources/databases';
import { getProject, triggerRedeploy } from '$lib/features/projects/api';
import type { Deployment, Project } from '$lib/features/projects/type';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import { errorFromDatabaseFixture, getDatabaseFixture } from '$lib/testing/database-fixtures';
import { databaseAccess } from '../access';
import DatabaseConnectionCard from './DatabaseConnectionCard.svelte';

vi.mock('$lib/config/public', () => ({
	publicConfig: { apiUrl: 'http://api.test', appUrl: 'http://app.test' }
}));
vi.mock('$lib/api/resources/databases', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/resources/databases')>()),
	getDatabaseCredentials: vi.fn(),
	rotateDatabasePassword: vi.fn()
}));
vi.mock('$lib/features/projects/api', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/features/projects/api')>()),
	getProject: vi.fn(),
	triggerRedeploy: vi.fn()
}));

const ready = parseDatabaseList(getDatabaseFixture('databases').body).find(
	(database) => database.projects.length > 0
)!;
const provisioning = parseDatabase(getDatabaseFixture('database-create').body);
const credentials = parseCredentials(getDatabaseFixture('credentials').body);
const pending = parseDatabase(getDatabaseFixture('rotate-password-redeploy').body);
const completed = parseDatabase(getDatabaseFixture('database-show-rotation-completed').body);
const failedRotation = parseDatabase(getDatabaseFixture('database-show-rotation-failed').body);
const web = completed.projects.find((project) => project.name === 'toko-kopi-web')!;
const admin = completed.projects.find((project) => project.name === 'toko-kopi-admin')!;
const queuedDeploymentId = completed.password_rotation!.redeploys!.find(
	(item) => item.project_id === web.id
)!.deployment_id!;

function renderCard(role: 'owner' | 'member' | 'viewer', database: Database = ready) {
	render(QueryTestHost, {
		props: {
			component: DatabaseConnectionCard,
			props: { database, workspaceId: 'ws-1', access: databaseAccess(role, false) }
		}
	});
}

/** The project as its page reads it: serving an older deployment that still has the old password. */
function servingProject(id: string): Project {
	return {
		id,
		branch: 'main',
		active_deployment_id: 'dep-old',
		redeploy_required: true
	} as unknown as Project;
}

const card = () => page.getByTestId('database-connection');

beforeEach(() => {
	vi.mocked(getDatabaseCredentials).mockReset();
	vi.mocked(rotateDatabasePassword).mockReset();
	vi.mocked(getProject).mockReset();
	vi.mocked(triggerRedeploy).mockReset();
});

describe('DatabaseConnectionCard', () => {
	it('reads the audited credentials only when an owner presses Tampilkan', async () => {
		vi.mocked(getDatabaseCredentials).mockResolvedValue(credentials);
		renderCard('owner');
		await expect.element(card().getByText(/Sakala mencatatnya di log audit/)).toBeVisible();
		expect(getDatabaseCredentials).not.toHaveBeenCalled();
		await expect.element(card()).not.toHaveTextContent(credentials.password);

		await page.getByTestId('reveal-credentials').click();
		expect(getDatabaseCredentials).toHaveBeenCalledWith('ws-1', ready.id);
		await expect.element(card()).toHaveTextContent(credentials.password);
		await expect.element(card()).toHaveTextContent(credentials.url!);

		await card().getByRole('button', { name: 'Sembunyikan' }).click();
		await expect.element(card()).not.toHaveTextContent(credentials.password);
	});

	it('shows host, port, database, and user to an owner before anything is revealed', async () => {
		renderCard('owner');
		const connection = ready.connection!;
		await expect.element(card()).toHaveTextContent(connection.host);
		await expect.element(card()).toHaveTextContent(connection.username);
		await expect
			.poll(() => card().getByRole('img', { name: 'Disembunyikan' }).elements().length)
			.toBe(2);
		expect(getDatabaseCredentials).not.toHaveBeenCalled();
	});

	it('says the address is missing while the node has not reported it', async () => {
		renderCard('owner', { ...ready, connection: null });
		await expect
			.element(page.getByTestId('connection-pending'))
			.toHaveTextContent(/belum melaporkan alamatnya/);
		await expect.element(card().getByText('Belum dilaporkan').first()).toBeVisible();
	});

	it('shows a member the connection without the password, and why, without asking the API', async () => {
		renderCard('member');
		await expect.element(card()).toHaveTextContent(ready.connection!.host);
		await expect.element(card()).toHaveTextContent(ready.connection!.database);
		await expect
			.element(page.getByTestId('credentials-owner-only'))
			.toHaveTextContent(/Password dan DATABASE_URL hanya bisa dilihat pemilik workspace/);
		await expect.element(card().getByText('Password', { exact: true })).not.toBeInTheDocument();
		await expect.element(page.getByTestId('reveal-credentials')).not.toBeInTheDocument();
		expect(getDatabaseCredentials).not.toHaveBeenCalled();
	});

	it('explains a refused read', async () => {
		vi.mocked(getDatabaseCredentials).mockRejectedValue(
			errorFromDatabaseFixture('credentials-member')
		);
		renderCard('owner');
		await page.getByTestId('reveal-credentials').click();
		await expect
			.element(card().getByRole('alert'))
			.toHaveTextContent('Password dan DATABASE_URL hanya bisa dilihat pemilik workspace.');
	});

	it('waits for the database to be ready before credentials exist', async () => {
		renderCard('owner', provisioning);
		await expect.element(page.getByTestId('credentials-not-ready')).toBeVisible();
		await expect.element(page.getByTestId('rotate-password')).toBeDisabled();
	});

	it('explains that the old password stops at once, and redeploys the attached projects by default', async () => {
		vi.mocked(rotateDatabasePassword).mockResolvedValue(pending);
		renderCard('member');
		await page.getByTestId('rotate-password').click();

		const dialog = page.getByRole('dialog', { name: 'Ganti password database?' });
		await expect.element(dialog).toHaveTextContent(/Password lama langsung tidak berlaku/);
		await expect.element(dialog).toHaveTextContent(/tidak bisa membuka koneksi baru/);
		await expect.element(dialog).toHaveTextContent(new RegExp(ready.projects[0].name));
		const checkbox = dialog.getByRole('checkbox', {
			name: 'Redeploy otomatis proyek yang terpasang'
		});
		await expect.element(checkbox).toBeChecked();
		expect(rotateDatabasePassword).not.toHaveBeenCalled();
		await dialog.getByRole('button', { name: 'Ganti password' }).click();

		expect(rotateDatabasePassword).toHaveBeenCalledWith('ws-1', ready.id, {
			redeploy_attached: true
		});
		await expect.element(dialog).not.toBeInTheDocument();
	});

	it('rotates without redeploys when the box is cleared, and says what that means', async () => {
		vi.mocked(rotateDatabasePassword).mockResolvedValue(pending);
		renderCard('owner');
		await page.getByTestId('rotate-password').click();
		const dialog = page.getByRole('dialog', { name: 'Ganti password database?' });
		await dialog.getByRole('checkbox').click();
		await expect.element(dialog).toHaveTextContent(/kamu perlu redeploy setiap proyek sendiri/);
		await dialog.getByRole('button', { name: 'Ganti password' }).click();

		expect(rotateDatabasePassword).toHaveBeenCalledWith('ws-1', ready.id, {
			redeploy_attached: false
		});
	});

	it('asks for no redeploy when nothing is attached', async () => {
		vi.mocked(rotateDatabasePassword).mockResolvedValue(pending);
		renderCard('owner', { ...ready, projects: [] });
		await page.getByTestId('rotate-password').click();
		const dialog = page.getByRole('dialog', { name: 'Ganti password database?' });
		await expect.element(dialog).toHaveTextContent(/tidak ada aplikasi yang terputus/);
		await expect.element(dialog.getByRole('checkbox')).not.toBeInTheDocument();
		await dialog.getByRole('button', { name: 'Ganti password' }).click();

		expect(rotateDatabasePassword).toHaveBeenCalledWith('ws-1', ready.id, {
			redeploy_attached: false
		});
	});

	it('shows a pending rotation and blocks a second one', async () => {
		renderCard('owner', pending);
		await expect
			.element(page.getByTestId('rotation-pending'))
			.toHaveTextContent(/sedang mengganti password/);
		await expect.element(page.getByTestId('rotate-password')).toBeDisabled();
	});

	it('says when the password changed, and links each queued redeploy', async () => {
		vi.mocked(getProject).mockImplementation(async (id) => servingProject(id));
		renderCard('owner', completed);
		await expect
			.element(page.getByTestId('rotation-completed'))
			.toHaveTextContent(/Password (sudah|terakhir) diganti/);

		const webRow = page.getByTestId(`rotation-project-${web.id}`);
		await expect.element(webRow).toHaveTextContent(/Redeploy otomatis berjalan/);
		await expect
			.element(webRow.getByRole('link', { name: /Lihat deployment/ }))
			.toHaveAttribute('href', `/projects/${web.id}/deployments/${queuedDeploymentId}`);
		await expect
			.element(page.getByTestId(`rotation-project-${admin.id}`))
			.toHaveTextContent(/Deploy pertamanya memakai password baru/);
	});

	it('offers a Redeploy where none was queued, and then links it', async () => {
		const manual = {
			...completed,
			password_rotation: {
				...completed.password_rotation!,
				redeploy_attached: false,
				redeploys: null
			}
		};
		vi.mocked(getProject).mockImplementation(async (id) => servingProject(id));
		vi.mocked(triggerRedeploy).mockResolvedValue({ id: 'dep-new' } as Deployment);
		renderCard('member', manual);

		const webRow = page.getByTestId(`rotation-project-${web.id}`);
		await expect.element(webRow).toHaveTextContent(/Masih memakai password lama/);
		await webRow.getByRole('button', { name: `Redeploy ${web.name}` }).click();

		expect(triggerRedeploy).toHaveBeenCalledWith(web.id, {
			branch: 'main',
			idempotencyKey: undefined
		});
		await expect
			.element(webRow.getByRole('link', { name: /Lihat deployment/ }))
			.toHaveAttribute('href', `/projects/${web.id}/deployments/dep-new`);
	});

	it('says why a redeploy was skipped', async () => {
		const skipped = {
			...completed,
			password_rotation: {
				...completed.password_rotation!,
				redeploys: [
					{ project_id: web.id, deployment_id: null, skipped_reason: 'active_deployment_limit' }
				]
			}
		};
		vi.mocked(getProject).mockImplementation(async (id) => servingProject(id));
		renderCard('owner', skipped);
		await expect
			.element(page.getByTestId(`rotation-project-${web.id}`))
			.toHaveTextContent(/masih ada deployment yang berjalan/);
	});

	it('says a failed rotation kept the old password', async () => {
		renderCard('owner', failedRotation);
		await expect
			.element(page.getByTestId('rotation-failed'))
			.toHaveTextContent(/password lama masih berlaku/);
	});

	it('keeps the dialog open when a rotation is already running', async () => {
		vi.mocked(rotateDatabasePassword).mockRejectedValue(
			errorFromDatabaseFixture('rotate-password-busy')
		);
		renderCard('owner');
		await page.getByTestId('rotate-password').click();
		const dialog = page.getByRole('dialog', { name: 'Ganti password database?' });
		await dialog.getByRole('button', { name: 'Ganti password' }).click();
		await expect.element(dialog.getByRole('alert')).toHaveTextContent(/masih berjalan/);
	});

	it('gives a viewer no way to rotate or redeploy, but shows the state', async () => {
		vi.mocked(getProject).mockImplementation(async (id) => servingProject(id));
		renderCard('viewer', {
			...completed,
			password_rotation: {
				...completed.password_rotation!,
				redeploy_attached: false,
				redeploys: null
			}
		});
		await expect.element(page.getByTestId('rotation-completed')).toBeVisible();
		await expect
			.element(page.getByTestId(`rotation-project-${web.id}`))
			.toHaveTextContent(/Masih memakai password lama/);
		await expect.element(page.getByTestId('rotate-password')).not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: /^Redeploy/ })).not.toBeInTheDocument();
	});
});
