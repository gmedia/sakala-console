import { page, userEvent } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { goto } from '$app/navigation';
import {
	createLimitProfile,
	getAdminWorkspace,
	listLimitProfiles,
	updateLimitProfile,
	parseAdminWorkspaceDetail,
	parseLimitProfile,
	parseLimitProfiles
} from '$lib/api/resources/admin/accounts';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import profilesFixture from '../../../../../../tests/fixtures/admin/limit-profiles.json';
import createdFixture from '../../../../../../tests/fixtures/admin/limit-profile-create.json';
import workspaceFixture from '../../../../../../tests/fixtures/admin/workspace-detail.json';
import LimitProfilesPage from './LimitProfilesPage.svelte';

const currentUrl = vi.hoisted(() => ({ url: new URL('http://localhost/admin/limit-profiles') }));

vi.mock('$app/state', () => ({
	page: {
		get url() {
			return currentUrl.url;
		}
	}
}));

vi.mock('$app/navigation', () => ({ goto: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/config/public', () => ({
	publicConfig: { apiUrl: 'http://api.test', appUrl: 'http://app.test' }
}));

vi.mock('$lib/api/resources/admin/accounts', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/resources/admin/accounts')>()),
	listLimitProfiles: vi.fn(),
	createLimitProfile: vi.fn(),
	updateLimitProfile: vi.fn(),
	getAdminWorkspace: vi.fn()
}));

const created = parseLimitProfile(createdFixture.body);
const workspace = parseAdminWorkspaceDetail(workspaceFixture.body);
const emptyList = parseLimitProfiles({
	...profilesFixture.body,
	data: [],
	meta: { ...profilesFixture.body.meta, total: 0 }
});

const renderPage = () => render(QueryTestHost, { props: { component: LimitProfilesPage } });
const field = (name: string) => page.getByRole('spinbutton', { name, exact: true });

beforeEach(() => {
	currentUrl.url = new URL('http://localhost/admin/limit-profiles');
	vi.mocked(goto).mockClear();
	vi.mocked(listLimitProfiles).mockReset().mockResolvedValue(emptyList);
	vi.mocked(createLimitProfile).mockReset().mockResolvedValue(created);
	vi.mocked(getAdminWorkspace).mockReset();
	vi.mocked(updateLimitProfile).mockReset().mockResolvedValue(created);
});

describe('creating a limit profile', () => {
	it('starts from the documented team defaults and marks what is required', async () => {
		await renderPage();
		await page.getByRole('button', { name: 'Buat profil' }).click();

		const form = page.getByRole('dialog', { name: 'Buat profil batas' });
		await expect.element(form).toHaveTextContent('batas default tim bawaan Sakala');
		await expect.element(page.getByRole('textbox', { name: 'Nama (wajib)' })).toHaveValue('');
		await expect.element(field('Proyek (wajib)')).toHaveValue(2);
		await expect.element(field('Container berjalan (wajib)')).toHaveValue(2);
		await expect.element(field('Deployment berjalan (wajib)')).toHaveValue(1);
		await expect.element(field('Memori per proyek (MB) (wajib)')).toHaveValue(512);
		await expect.element(field('CPU per proyek (millicore) (wajib)')).toHaveValue(1000);
		const builds = field('Build per jam (opsional)');
		await expect.element(builds).toHaveValue(null);
		await expect.element(builds).toHaveAccessibleDescription(/Boleh dikosongkan/);

		await userEvent.fill(page.getByRole('textbox', { name: 'Nama (wajib)' }), 'Magang');
		await userEvent.fill(page.getByLabelText('Alasan'), 'Pilot magang');
		await page.getByRole('button', { name: 'Buat profil', exact: true }).last().click();

		await expect.poll(() => vi.mocked(createLimitProfile).mock.calls.length).toBe(1);
		expect(createLimitProfile).toHaveBeenCalledWith({
			name: 'Magang',
			max_projects: 2,
			max_active_containers: 2,
			max_active_deployments: 1,
			max_memory_mb: 512,
			max_cpu_millis: 1000,
			max_builds_per_hour: null,
			idle_sleep_minutes: null,
			reason: 'Pilot magang'
		});
		expect(goto).not.toHaveBeenCalled();
	});

	it('names the missing fields beside the button instead of a silent disabled one', async () => {
		await renderPage();
		await page.getByRole('button', { name: 'Buat profil' }).click();
		await userEvent.clear(field('Proyek (wajib)'));

		const confirm = page
			.getByRole('dialog', { name: 'Buat profil batas' })
			.getByRole('button', { name: 'Buat profil' });
		await expect.element(confirm).toBeEnabled();
		await confirm.click();

		const summary =
			'Belum bisa dilanjutkan. Periksa isian yang ditandai: Nama, Proyek. Isi alasan dulu.';
		await expect.element(page.getByRole('alert')).toHaveTextContent(summary);
		await expect.element(confirm).toHaveAccessibleDescription(summary);
		await expect.element(page.getByRole('textbox', { name: 'Nama (wajib)' })).toHaveFocus();
		await expect
			.element(field('Proyek (wajib)'))
			.toHaveAccessibleDescription('Belum diisi. Isi bilangan bulat 1 sampai 1.000.');
		expect(createLimitProfile).not.toHaveBeenCalled();
	});

	// Regression, production v0.5.0: typing into the number inputs left the form stuck, because a
	// number input binds a number and the form called `.trim()` on it. Typed key by key, as people do.
	it('accepts every field typed on the keyboard and sends integers', async () => {
		await renderPage();
		await page.getByRole('button', { name: 'Buat profil' }).click();
		const form = page.getByRole('dialog', { name: 'Buat profil batas' });

		await userEvent.type(page.getByRole('textbox', { name: 'Nama (wajib)' }), 'Pilot besar');
		for (const [name, typed] of [
			['Proyek (wajib)', '100'],
			['Container berjalan (wajib)', '100'],
			['Deployment berjalan (wajib)', '100'],
			['Memori per proyek (MB) (wajib)', '512'],
			['CPU per proyek (millicore) (wajib)', '1000'],
			['Build per jam (opsional)', '1000']
		] as const) {
			await userEvent.clear(field(name));
			await userEvent.type(field(name), typed);
		}
		await userEvent.type(page.getByLabelText('Alasan'), 'Pilot fakultas');

		const confirm = form.getByRole('button', { name: 'Buat profil' });
		await expect.element(confirm).toBeEnabled();
		await expect.element(confirm).not.toHaveAttribute('aria-describedby');
		await confirm.click();

		await expect.poll(() => vi.mocked(createLimitProfile).mock.calls.length).toBe(1);
		await expect.element(page.getByRole('alert')).not.toBeInTheDocument();
		const sent = vi.mocked(createLimitProfile).mock.calls[0][0];
		expect(sent).toEqual({
			name: 'Pilot besar',
			max_projects: 100,
			max_active_containers: 100,
			max_active_deployments: 100,
			max_memory_mb: 512,
			max_cpu_millis: 1000,
			max_builds_per_hour: 1000,
			idle_sleep_minutes: null,
			reason: 'Pilot fakultas'
		});
		for (const key of [
			'max_projects',
			'max_active_containers',
			'max_active_deployments',
			'max_memory_mb',
			'max_cpu_millis',
			'max_builds_per_hour'
		] as const) {
			expect(Number.isInteger(sent[key]), key).toBe(true);
		}
	});

	it('opened for a team workspace on the default, starts from its live limits and goes back to it', async () => {
		const live = structuredClone(workspace);
		live.workspace.limit_profile = null;
		live.quota.limit_profile = null;
		live.quota.limits = {
			...live.quota.limits,
			max_projects: 4,
			max_active_containers: 3,
			max_active_deployments: 2,
			max_memory_mb: 768,
			max_cpu_millis: 1500
		};
		vi.mocked(getAdminWorkspace).mockResolvedValue(live);
		currentUrl.url = new URL(
			`http://localhost/admin/limit-profiles?create=1&return_to=%2Fadmin%2Fworkspaces%2F${live.workspace.id}`
		);

		await renderPage();

		const form = page.getByRole('dialog', { name: 'Buat profil batas' });
		await expect
			.element(form)
			.toHaveTextContent('batas Default tim yang berlaku di workspace tadi');
		await expect.element(field('Proyek (wajib)')).toHaveValue(4);
		await expect.element(field('Memori per proyek (MB) (wajib)')).toHaveValue(768);

		await userEvent.fill(page.getByRole('textbox', { name: 'Nama (wajib)' }), 'Magang');
		await userEvent.fill(page.getByLabelText('Alasan'), 'Pilot magang');
		await form.getByRole('button', { name: 'Buat profil' }).click();

		await expect
			.poll(() => vi.mocked(goto).mock.calls[0]?.[0])
			.toBe(`/admin/workspaces/${live.workspace.id}?limit_profile=${created.id}`);
		expect(vi.mocked(createLimitProfile).mock.calls[0][0]).toMatchObject({
			max_projects: 4,
			max_active_containers: 3,
			max_active_deployments: 2,
			max_memory_mb: 768,
			max_cpu_millis: 1500
		});
	});
});

describe('idle sleep in a limit profile', () => {
	const idleField = () => field('Tidur otomatis (menit) (opsional)');

	it('starts empty, which follows the server, and explains 0 and the range', async () => {
		await renderPage();
		await page.getByRole('button', { name: 'Buat profil' }).click();

		await expect.element(idleField()).toHaveValue(null);
		await expect
			.element(idleField())
			.toHaveAccessibleDescription(
				'Kosong berarti ikut bawaan server, 0 berarti proyek tidak pernah tidur, atau 1 sampai 10.080 menit tanpa pengunjung.'
			);
	});

	it('sends 0 as never, not as empty, when typed on the keyboard', async () => {
		await renderPage();
		await page.getByRole('button', { name: 'Buat profil' }).click();
		const form = page.getByRole('dialog', { name: 'Buat profil batas' });

		await userEvent.type(page.getByRole('textbox', { name: 'Nama (wajib)' }), 'Demo');
		await userEvent.type(idleField(), '0');
		await userEvent.type(page.getByLabelText('Alasan'), 'Demo selalu menyala');
		await form.getByRole('button', { name: 'Buat profil' }).click();

		await expect.poll(() => vi.mocked(createLimitProfile).mock.calls.length).toBe(1);
		expect(vi.mocked(createLimitProfile).mock.calls[0][0]).toMatchObject({
			idle_sleep_minutes: 0
		});
	});

	it('refuses more than a week before sending', async () => {
		await renderPage();
		await page.getByRole('button', { name: 'Buat profil' }).click();

		await userEvent.type(idleField(), '10081');

		await expect
			.element(idleField())
			.toHaveAccessibleDescription('Bilangan bulat 0 sampai 10.080.');
		expect(createLimitProfile).not.toHaveBeenCalled();
	});

	it('shows the value in the table, and editing to empty sends null to follow the server', async () => {
		const never = parseLimitProfiles({
			...profilesFixture.body,
			data: [{ ...profilesFixture.body.data[0], idle_sleep_minutes: 0 }]
		});
		vi.mocked(listLimitProfiles).mockResolvedValue(never);
		await renderPage();

		await expect.element(page.getByRole('cell', { name: 'Tidak pernah' })).toBeVisible();
		await page.getByRole('button', { name: 'Ubah Kelas' }).click();
		await expect.element(idleField()).toHaveValue(0);

		await userEvent.clear(idleField());
		await userEvent.type(page.getByLabelText('Alasan'), 'Ikut bawaan lagi');
		await page
			.getByRole('dialog', { name: 'Ubah profil batas' })
			.getByRole('button', { name: 'Simpan perubahan' })
			.click();

		await expect.poll(() => vi.mocked(updateLimitProfile).mock.calls.length).toBe(1);
		expect(vi.mocked(updateLimitProfile).mock.calls[0][1]).toMatchObject({
			idle_sleep_minutes: null
		});
	});
});
