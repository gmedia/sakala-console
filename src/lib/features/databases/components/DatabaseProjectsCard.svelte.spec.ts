import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import {
	attachDatabase,
	detachDatabase,
	parseAttachment,
	parseDatabaseList,
	type Database
} from '$lib/api/resources/databases';
import { getListProjects } from '$lib/api/resources/projects';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import { errorFromDatabaseFixture, getDatabaseFixture } from '$lib/testing/database-fixtures';
import type { RedeployNotice } from '../presentation';
import DatabaseProjectsCard from './DatabaseProjectsCard.svelte';

vi.mock('$lib/config/public', () => ({
	publicConfig: { apiUrl: 'http://api.test', appUrl: 'http://app.test' }
}));
vi.mock('$lib/api/resources/databases', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/resources/databases')>()),
	attachDatabase: vi.fn(),
	detachDatabase: vi.fn()
}));
vi.mock('$lib/api/resources/projects', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/resources/projects')>()),
	getListProjects: vi.fn()
}));

const all = parseDatabaseList(getDatabaseFixture('databases').body);
const attached = all.find((database) => database.projects.length > 0)!;
const locked = all.find((database) => database.status === 'locked')!;
const attachment = parseAttachment(getDatabaseFixture('attach').body);

const projectRow = (id: string, name: string) => ({
	id,
	name,
	repository_full_name: null,
	repository_source: 'public_url',
	github_installation_id: null,
	github_repository_id: null,
	branch: 'main',
	thumbnail_url: null,
	public_url: `https://${name}.sakala.app`,
	runtime_status: 'running',
	suspension: null,
	latest_deployment: null,
	stack: null,
	last_deployed_at: null,
	created_at: '2026-01-01T00:00:00Z'
});

const MANAGE = { canManage: true, canViewCredentials: true };

function renderCard(database: Database, props: Record<string, unknown> = {}) {
	const onChanged = vi.fn<(notices: RedeployNotice[]) => void>();
	render(QueryTestHost, {
		props: {
			component: DatabaseProjectsCard,
			props: { database, workspaceId: 'ws-1', access: MANAGE, notices: [], onChanged, ...props }
		}
	});
	return onChanged;
}

beforeEach(() => {
	vi.mocked(attachDatabase).mockReset();
	vi.mocked(detachDatabase).mockReset();
	vi.mocked(getListProjects)
		.mockReset()
		.mockResolvedValue({
			data: [
				projectRow(attached.projects[0].id, attached.projects[0].name),
				projectRow('p-kasir', 'api-kasir'),
				{
					...projectRow('p-admin', 'panel-admin'),
					databases: [{ id: 'db-other', name: 'analitik', status: 'ready' }]
				}
			],
			links: { first: null, last: null, prev: null, next: null },
			meta: {
				current_page: 1,
				from: 1,
				last_page: 1,
				links: [],
				path: null,
				per_page: 6,
				to: 2,
				total: 2
			}
		} as never);
});

describe('DatabaseProjectsCard', () => {
	it('attaches a chosen project from the same workspace and reports the redeploy', async () => {
		vi.mocked(attachDatabase).mockResolvedValue({
			...attachment,
			project: { id: 'p-kasir', name: 'api-kasir', slug: 'api-kasir' },
			redeploy_required: true
		});
		const onChanged = renderCard(attached);
		await page.getByTestId('attach-project').click();

		const dialog = page.getByRole('dialog', { name: 'Pasang ke proyek' });
		await expect.element(dialog.getByRole('radio', { name: /toko-kopi-web/ })).toBeDisabled();
		// A project uses one database, so one that already has another cannot be chosen.
		await expect.element(dialog.getByRole('radio', { name: /panel-admin/ })).toBeDisabled();
		await expect.element(dialog.getByText('memakai analitik')).toBeVisible();
		expect(getListProjects).toHaveBeenCalledWith(expect.objectContaining({ workspace_id: 'ws-1' }));
		await dialog.getByRole('radio', { name: 'api-kasir' }).click();
		await dialog.getByRole('button', { name: 'Pasang database' }).click();

		expect(attachDatabase).toHaveBeenCalledWith('ws-1', attached.id, 'p-kasir');
		await expect.element(dialog).not.toBeInTheDocument();
		expect(onChanged).toHaveBeenCalledWith([
			{ projectId: 'p-kasir', projectName: 'api-kasir', kind: 'attached', redeployRequired: true }
		]);
	});

	it('keeps the dialog open with the API reason when the project uses another database', async () => {
		vi.mocked(attachDatabase).mockRejectedValue(
			errorFromDatabaseFixture('attach-project-already-attached')
		);
		renderCard(attached);
		await page.getByTestId('attach-project').click();
		const dialog = page.getByRole('dialog', { name: 'Pasang ke proyek' });
		await dialog.getByRole('radio', { name: 'api-kasir' }).click();
		await dialog.getByRole('button', { name: 'Pasang database' }).click();
		await expect
			.element(dialog.getByTestId('attach-error'))
			.toHaveTextContent(/sudah memakai database toko-kopi-db/);
	});

	it('detaches only after a confirmation that the data stays', async () => {
		vi.mocked(detachDatabase).mockResolvedValue(undefined);
		const onChanged = renderCard(attached);
		const project = attached.projects[0];
		await page.getByRole('button', { name: `Lepas dari ${project.name}` }).click();

		const dialog = page.getByRole('dialog', { name: `Lepas ${attached.name}?` });
		await expect.element(dialog).toHaveTextContent(/Data di database tetap ada/);
		expect(detachDatabase).not.toHaveBeenCalled();
		await dialog.getByRole('button', { name: 'Lepas database' }).click();

		expect(detachDatabase).toHaveBeenCalledWith('ws-1', attached.id, project.id);
		expect(onChanged).toHaveBeenCalledWith([
			{ projectId: project.id, projectName: project.name, kind: 'detached' }
		]);
	});

	it('says why a locked database cannot be attached', async () => {
		renderCard(locked);
		await expect.element(page.getByTestId('attach-project')).toBeDisabled();
		await expect
			.element(page.getByText(/Database yang terkunci belum bisa dipasang/))
			.toBeVisible();
	});

	it('shows a viewer the projects without any action', async () => {
		renderCard(attached, { access: { canManage: false, canViewCredentials: false } });
		await expect.element(page.getByRole('link', { name: attached.projects[0].name })).toBeVisible();
		await expect.element(page.getByTestId('attach-project')).not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: /Lepas/ })).not.toBeInTheDocument();
	});

	it('lists the redeploy each change needs, with a link to the project', async () => {
		renderCard(attached, {
			notices: [{ projectId: 'p-kasir', projectName: 'api-kasir', kind: 'rotated' }]
		});
		const notices = page.getByTestId('redeploy-notices');
		await expect
			.element(notices)
			.toHaveTextContent(/Redeploy api-kasir setelah penggantian password/);
		await expect
			.element(notices.getByRole('link'))
			.toHaveAttribute('href', '/projects/p-kasir/environments');
	});
});
