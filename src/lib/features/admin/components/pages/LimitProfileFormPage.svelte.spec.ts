import { page, userEvent } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { goto } from '$app/navigation';
import {
	createLimitProfile,
	getAdminWorkspace,
	getLimitProfile,
	updateLimitProfile,
	parseAdminWorkspaceDetail,
	parseLimitProfile
} from '$lib/api/resources/admin/accounts';
import { listRegions } from '$lib/api/resources/regions';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import profilesFixture from '../../../../../../tests/fixtures/admin/limit-profiles.json';
import createdFixture from '../../../../../../tests/fixtures/admin/limit-profile-create.json';
import workspaceFixture from '../../../../../../tests/fixtures/admin/workspace-detail.json';
import LimitProfileFormPage from './LimitProfileFormPage.svelte';

const currentUrl = vi.hoisted(() => ({
	url: new URL('http://localhost/admin/limit-profiles/new')
}));

vi.mock('$app/state', () => ({
	page: {
		get url() {
			return currentUrl.url;
		}
	}
}));

vi.mock('$app/navigation', () => ({
	goto: vi.fn().mockResolvedValue(undefined),
	beforeNavigate: vi.fn()
}));
vi.mock('$lib/api/resources/regions', () => ({ listRegions: vi.fn() }));
vi.mock('$lib/config/public', () => ({
	publicConfig: { apiUrl: 'http://api.test', appUrl: 'http://app.test' }
}));

vi.mock('$lib/api/resources/admin/accounts', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/resources/admin/accounts')>()),
	getLimitProfile: vi.fn(),
	createLimitProfile: vi.fn(),
	updateLimitProfile: vi.fn(),
	getAdminWorkspace: vi.fn()
}));

const created = parseLimitProfile(createdFixture.body);
const workspace = parseAdminWorkspaceDetail(workspaceFixture.body);
const kelas = parseLimitProfile({ data: profilesFixture.body.data[0] });

const renderNew = () =>
	render(QueryTestHost, {
		props: { component: LimitProfileFormPage, props: { profileId: null } }
	});
const renderEdit = () =>
	render(QueryTestHost, {
		props: { component: LimitProfileFormPage, props: { profileId: kelas.id } }
	});
const field = (name: string) => page.getByRole('spinbutton', { name, exact: true });
const nameField = () => page.getByRole('textbox', { name: 'Nama (wajib)' });
const optionalToggle = () => page.getByRole('button', { name: 'Opsional' });
const submit = (label = 'Buat profil') => page.getByRole('button', { name: label, exact: true });

beforeEach(() => {
	currentUrl.url = new URL('http://localhost/admin/limit-profiles/new');
	vi.mocked(goto).mockClear();
	vi.mocked(getLimitProfile).mockReset().mockResolvedValue(kelas);
	vi.mocked(createLimitProfile).mockReset().mockResolvedValue(created);
	vi.mocked(getAdminWorkspace).mockReset();
	vi.mocked(updateLimitProfile).mockReset().mockResolvedValue(created);
	vi.mocked(listRegions).mockReset().mockResolvedValue(['jkt', 'sby']);
});

describe('the limit profile page', () => {
	it('opens with the cursor in Nama, and groups the numbers in three parts', async () => {
		await renderNew();

		await expect.element(nameField()).toHaveFocus();
		await expect
			.element(page.getByTestId('profile-group-workspace'))
			.toHaveTextContent(/Kapasitas workspace.*Proyek.*Container berjalan.*Deployment berjalan/);
		await expect
			.element(page.getByTestId('profile-group-project'))
			.toHaveTextContent(/Sumber daya per proyek.*Memori.*CPU/);
		await expect.element(optionalToggle()).toHaveAttribute('aria-expanded', 'false');
		await expect.element(field('Build per jam (opsional)')).not.toBeInTheDocument();
	});

	it('says what Build per jam counts now that the API enforces it', async () => {
		await renderNew();
		await optionalToggle().click();

		const builds = field('Build per jam (opsional)');
		await expect.element(builds).toHaveValue(null);
		await expect
			.element(builds)
			.toHaveAccessibleDescription(
				'Deployment yang membangun image di workspace ini dalam 60 menit terakhir, termasuk yang gagal. Redeploy yang memakai ulang image tidak dihitung. Kosong berarti ikut bawaan server (20 kalau tidak diubah).'
			);
	});
});

describe('creating a limit profile', () => {
	it('starts from the documented team defaults and marks what is required', async () => {
		await renderNew();

		const form = page.getByRole('form', { name: 'Buat profil batas' });
		await expect.element(form).toHaveTextContent('batas default tim bawaan Sakala');
		await expect.element(nameField()).toHaveValue('');
		await expect.element(field('Proyek (wajib)')).toHaveValue(2);
		await expect.element(field('Container berjalan (wajib)')).toHaveValue(2);
		await expect.element(field('Deployment berjalan (wajib)')).toHaveValue(1);
		await expect.element(field('Memori per proyek (MB) (wajib)')).toHaveValue(512);
		await expect.element(field('CPU per proyek (millicore) (wajib)')).toHaveValue(1000);

		await userEvent.fill(nameField(), 'Magang');
		await userEvent.fill(page.getByLabelText('Alasan'), 'Pilot magang');
		await submit().click();

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
			max_replicas: null,
			max_databases: null,
			max_database_storage_mb: null,
			max_buckets: null,
			max_bucket_storage_mb: null,
			max_valkeys: null,
			max_valkey_memory_mb: null,
			default_region: null,
			reason: 'Pilot magang'
		});
		await expect.poll(() => vi.mocked(goto).mock.calls[0]?.[0]).toBe('/admin/limit-profiles');
	});

	it('names the missing fields beside the button instead of a silent disabled one', async () => {
		await renderNew();
		await userEvent.clear(field('Proyek (wajib)'));

		const confirm = submit();
		await expect.element(confirm).toBeEnabled();
		await confirm.click();

		const summary =
			'Belum bisa disimpan. Periksa isian yang ditandai: Nama, Proyek. Isi alasan dulu.';
		await expect.element(page.getByRole('alert')).toHaveTextContent(summary);
		await expect.element(confirm).toHaveAccessibleDescription(summary);
		await expect.element(nameField()).toHaveFocus();
		await expect
			.element(field('Proyek (wajib)'))
			.toHaveAccessibleDescription('Belum diisi. Isi bilangan bulat 1 sampai 1.000.');
		expect(createLimitProfile).not.toHaveBeenCalled();
	});

	// Regression, production v0.5.0: typing into the number inputs left the form stuck, because a
	// number input binds a number and the form called `.trim()` on it. Typed key by key, as people do.
	it('accepts every field typed on the keyboard and sends integers', async () => {
		await renderNew();
		await optionalToggle().click();

		await userEvent.type(nameField(), 'Pilot besar');
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

		const confirm = submit();
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
			max_replicas: null,
			max_databases: null,
			max_database_storage_mb: null,
			max_buckets: null,
			max_bucket_storage_mb: null,
			max_valkeys: null,
			max_valkey_memory_mb: null,
			default_region: null,
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
			`http://localhost/admin/limit-profiles/new?return_to=%2Fadmin%2Fworkspaces%2F${live.workspace.id}`
		);

		await renderNew();

		const form = page.getByRole('form', { name: 'Buat profil batas' });
		await expect
			.element(form)
			.toHaveTextContent('batas Default tim yang berlaku di workspace tadi');
		await expect.element(field('Proyek (wajib)')).toHaveValue(4);
		await expect.element(field('Memori per proyek (MB) (wajib)')).toHaveValue(768);

		await userEvent.fill(nameField(), 'Magang');
		await userEvent.fill(page.getByLabelText('Alasan'), 'Pilot magang');
		await submit().click();

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
		await renderNew();
		await optionalToggle().click();

		await expect.element(idleField()).toHaveValue(null);
		await expect
			.element(idleField())
			.toHaveAccessibleDescription(
				'Kosong berarti ikut bawaan server, 0 berarti proyek tidak pernah tidur, atau 1 sampai 10.080 menit tanpa pengunjung.'
			);
	});

	it('sends 0 as never, not as empty, when typed on the keyboard', async () => {
		await renderNew();
		await optionalToggle().click();

		await userEvent.type(nameField(), 'Demo');
		await userEvent.type(idleField(), '0');
		await userEvent.type(page.getByLabelText('Alasan'), 'Demo selalu menyala');
		await submit().click();

		await expect.poll(() => vi.mocked(createLimitProfile).mock.calls.length).toBe(1);
		expect(vi.mocked(createLimitProfile).mock.calls[0][0]).toMatchObject({
			idle_sleep_minutes: 0
		});
	});

	it('refuses more than a week before sending', async () => {
		await renderNew();
		await optionalToggle().click();

		await userEvent.type(idleField(), '10081');

		await expect
			.element(idleField())
			.toHaveAccessibleDescription('Bilangan bulat 0 sampai 10.080.');
		expect(createLimitProfile).not.toHaveBeenCalled();
	});

	it('editing a profile that never sleeps opens Opsional, and empty sends null to follow the server', async () => {
		vi.mocked(getLimitProfile).mockResolvedValue({ ...kelas, idle_sleep_minutes: 0 });
		await renderEdit();

		await expect.element(optionalToggle()).toHaveAttribute('aria-expanded', 'true');
		await expect.element(idleField()).toHaveValue(0);

		await userEvent.clear(idleField());
		// Emptying the only optional value keeps the group open while the cursor is in it.
		await expect.element(idleField()).toBeVisible();
		await userEvent.type(page.getByLabelText('Alasan'), 'Ikut bawaan lagi');
		await submit('Simpan perubahan').click();

		await expect.poll(() => vi.mocked(updateLimitProfile).mock.calls.length).toBe(1);
		expect(vi.mocked(updateLimitProfile).mock.calls[0][1]).toMatchObject({
			idle_sleep_minutes: null
		});
		await expect.poll(() => vi.mocked(goto).mock.calls[0]?.[0]).toBe('/admin/limit-profiles');
	});
});

describe('replicas in a limit profile', () => {
	const replicasField = () => field('Maks. replika (opsional)');

	it('starts empty, which allows one replica, and explains the range', async () => {
		await renderNew();
		await optionalToggle().click();

		await expect.element(replicasField()).toHaveValue(null);
		await expect
			.element(replicasField())
			.toHaveAccessibleDescription(
				'Replika per proyek, 1 sampai 10. Kosong berarti 1, jadi replika tidak aktif. Semua replika satu proyek berjalan di satu node, yang bisa membatasinya lebih rendah.'
			);
	});

	it.each(['0', '11'])('refuses %s before sending', async (value) => {
		await renderNew();
		await optionalToggle().click();
		const form = page.getByRole('form', { name: 'Buat profil batas' });

		await userEvent.type(nameField(), 'Demo');
		await userEvent.type(replicasField(), value);
		await userEvent.type(page.getByLabelText('Alasan'), 'Coba replika');

		await expect
			.element(replicasField())
			.toHaveAccessibleDescription('Bilangan bulat 1 sampai 10.');
		await submit().click();
		await expect.element(form).toHaveTextContent('Periksa isian yang ditandai: Maks. replika.');
		expect(createLimitProfile).not.toHaveBeenCalled();
	});

	it('sends the number typed', async () => {
		await renderNew();
		await optionalToggle().click();

		await userEvent.type(nameField(), 'Demo');
		await userEvent.type(replicasField(), '3');
		await userEvent.type(page.getByLabelText('Alasan'), 'Demo dengan replika');
		await submit().click();

		await expect.poll(() => vi.mocked(createLimitProfile).mock.calls.length).toBe(1);
		expect(vi.mocked(createLimitProfile).mock.calls[0][0]).toMatchObject({ max_replicas: 3 });
	});

	it('editing to empty sends null for one replica', async () => {
		vi.mocked(getLimitProfile).mockResolvedValue({ ...kelas, max_replicas: 4 });
		await renderEdit();
		await expect.element(replicasField()).toHaveValue(4);

		await userEvent.clear(replicasField());
		await userEvent.type(page.getByLabelText('Alasan'), 'Replika dimatikan');
		await submit('Simpan perubahan').click();

		await expect.poll(() => vi.mocked(updateLimitProfile).mock.calls.length).toBe(1);
		expect(vi.mocked(updateLimitProfile).mock.calls[0][1]).toMatchObject({ max_replicas: null });
	});
});

describe('databases and region in a limit profile', () => {
	const databases = () => field('Database (opsional)');
	const storage = () => field('Penyimpanan database (MB) (opsional)');
	const region = () => page.getByRole('combobox', { name: 'Region bawaan (opsional)' });

	it('explains 0 and empty for both database limits, and says databases are a pilot', async () => {
		await renderNew();
		await optionalToggle().click();

		await expect.element(databases()).toHaveValue(null);
		await expect
			.element(databases())
			.toHaveAccessibleDescription(
				/0 berarti workspace ini tidak bisa membuat database.*pilot terbatas/
			);
		await expect
			.element(storage())
			.toHaveAccessibleDescription(/0 berarti semuanya dikunci.*512 MB kalau tidak diubah/);
	});

	it('sends 0 databases as a value, and the region chosen from the API list', async () => {
		await renderNew();
		await optionalToggle().click();
		await expect.element(region().getByRole('option', { name: 'sby' })).toBeInTheDocument();

		await userEvent.type(nameField(), 'Tanpa database');
		await userEvent.type(databases(), '0');
		await userEvent.selectOptions(region(), 'sby');
		await userEvent.type(page.getByLabelText('Alasan'), 'Kelas tanpa database');
		await submit().click();

		await expect.poll(() => vi.mocked(createLimitProfile).mock.calls.length).toBe(1);
		expect(vi.mocked(createLimitProfile).mock.calls[0][0]).toMatchObject({
			max_databases: 0,
			max_database_storage_mb: null,
			default_region: 'sby'
		});
	});

	it('refuses more databases than the API allows before sending', async () => {
		await renderNew();
		await optionalToggle().click();

		await userEvent.type(databases(), '1001');

		await expect.element(databases()).toHaveAccessibleDescription('Bilangan bulat 0 sampai 1.000.');
	});

	it('sends bucket limits, and says the server opens none unless told to', async () => {
		await renderNew();
		await optionalToggle().click();
		const buckets = field('Bucket (opsional)');
		await expect
			.element(buckets)
			.toHaveAccessibleDescription(
				/0 berarti workspace ini tidak bisa membuat bucket.*\(0 kalau tidak diubah/
			);

		await userEvent.type(nameField(), 'Pilot bucket');
		await userEvent.type(buckets, '2');
		await userEvent.type(field('Penyimpanan bucket (MB) (opsional)'), '1024');
		await userEvent.type(page.getByLabelText('Alasan'), 'Pilot penyimpanan file');
		await submit().click();

		await expect.poll(() => vi.mocked(createLimitProfile).mock.calls.length).toBe(1);
		expect(vi.mocked(createLimitProfile).mock.calls[0][0]).toMatchObject({
			max_buckets: 2,
			max_bucket_storage_mb: 1024
		});
	});

	it('opens Opsional for a saved region, and keeps one no node reports anymore', async () => {
		vi.mocked(getLimitProfile).mockResolvedValue({ ...kelas, default_region: 'id-jog-1' });
		await renderEdit();

		await expect.element(optionalToggle()).toHaveAttribute('aria-expanded', 'true');
		await expect.element(region()).toHaveValue('id-jog-1');
		await expect
			.element(region())
			.toHaveAccessibleDescription(/Region id-jog-1 sekarang tidak punya node aktif/);

		await userEvent.selectOptions(region(), 'Semua region');
		await userEvent.type(page.getByLabelText('Alasan'), 'Boleh di mana saja');
		await submit('Simpan perubahan').click();

		await expect.poll(() => vi.mocked(updateLimitProfile).mock.calls.length).toBe(1);
		expect(vi.mocked(updateLimitProfile).mock.calls[0][1]).toMatchObject({ default_region: null });
	});

	it('says when no node reports a region yet', async () => {
		vi.mocked(listRegions).mockResolvedValue([]);
		await renderNew();
		await optionalToggle().click();

		await expect
			.element(region())
			.toHaveAccessibleDescription(/Belum ada node yang melaporkan region/);
	});
});
