import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { LimitProfile } from '$lib/api/resources/admin/accounts';
import LimitProfileDialog from './LimitProfileDialog.svelte';

const WORKSPACE = '01a1cae3-b6e6-71a1-8a4d-4b075ba386bc';

function profile(overrides: Partial<LimitProfile>): LimitProfile {
	return {
		id: '01a1cae3-b758-7353-92f7-68405a6c5c5f',
		name: 'Magang',
		max_projects: 3,
		max_active_containers: 2,
		max_active_deployments: 1,
		max_memory_mb: 512,
		max_cpu_millis: 500,
		max_builds_per_hour: null,
		workspaces_count: 0,
		created_at: null,
		updated_at: null,
		...overrides
	};
}

function props(overrides: Record<string, unknown> = {}) {
	return {
		open: true,
		id: 'workspace-profile',
		subject: 'Workspace Tim Kampus',
		consequence: 'Batas baru langsung berlaku untuk semua anggota.',
		defaultLabel: 'Default tim',
		defaultLimits: { max_projects: 10, max_active_containers: 5, max_active_deployments: 2 },
		currentProfileId: null,
		profiles: [] as LimitProfile[],
		profilesLoading: false,
		profilesError: false,
		onRetryProfiles: vi.fn(),
		returnTo: { kind: 'workspaces' as const, id: WORKSPACE },
		onCancel: vi.fn(),
		onConfirm: vi.fn(() => Promise.resolve()),
		...overrides
	};
}

describe('LimitProfileDialog', () => {
	it('with no profiles yet, explains where they come from and links to the create form', async () => {
		await render(LimitProfileDialog, props());

		const dialog = page.getByRole('dialog', { name: 'Ubah profil batas' });
		await expect.element(dialog).toHaveTextContent('Sekarang memakai Default tim.');
		await expect
			.element(page.getByRole('heading', { name: 'Belum ada profil batas' }))
			.toBeVisible();
		const link = page.getByRole('link', { name: 'Buat profil batas' });
		await expect
			.element(link)
			.toHaveAttribute(
				'href',
				`/admin/limit-profiles?create=1&return_to=%2Fadmin%2Fworkspaces%2F${WORKSPACE}`
			);
		await expect.element(link).toHaveFocus();
		// Nothing to choose, so nothing to confirm and no reason to write.
		await expect.element(page.getByRole('combobox')).not.toBeInTheDocument();
		await expect.element(page.getByLabelText('Alasan')).not.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'Simpan profil' }))
			.not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Tutup' })).toBeVisible();
	});

	it('shows what each profile allows, so the admin knows what they assign', async () => {
		await render(
			LimitProfileDialog,
			props({ profiles: [profile({}), profile({ id: 'kelas', name: 'Kelas', max_projects: 5 })] })
		);

		const select = page.getByRole('combobox', { name: 'Profil batas' });
		await expect
			.element(select)
			.toHaveTextContent(
				'Magang (3 proyek, 2 container berjalan, 1 deployment berjalan)Kelas (5 proyek'
			);
		await expect
			.element(select)
			.toHaveAccessibleDescription(
				/Default tim: 10 proyek, 5 container berjalan, 2 deployment berjalan/
			);

		await userEvent.selectOptions(select.element(), 'kelas');
		await expect
			.element(select)
			.toHaveAccessibleDescription(/Kelas: 5 proyek, 2 container berjalan, 1 deployment berjalan/);
	});

	it('says that keeping the current profile changes nothing, instead of a silent button', async () => {
		const onConfirm = vi.fn(() => Promise.resolve());
		await render(LimitProfileDialog, props({ profiles: [profile({})], onConfirm }));

		const select = page.getByRole('combobox', { name: 'Profil batas' });
		await expect.element(select).toHaveAccessibleDescription(/tidak mengubah apa pun/);
		await userEvent.fill(page.getByLabelText('Alasan'), 'Pilot kampus');
		const confirm = page.getByRole('button', { name: 'Simpan profil' });
		await confirm.click();

		expect(onConfirm).not.toHaveBeenCalled();
		await expect
			.element(confirm)
			.toHaveAccessibleDescription(
				'Belum bisa dilanjutkan. Pilih profil yang berbeda dari yang sedang dipakai.'
			);
		await expect.element(select).toHaveFocus();

		await userEvent.selectOptions(select.element(), profile({}).id);
		await confirm.click();
		expect(onConfirm).toHaveBeenCalledWith(profile({}).id, 'Pilot kampus');
	});

	it('opens with a profile just created for this workspace already chosen', async () => {
		await render(
			LimitProfileDialog,
			props({ profiles: [profile({})], initialProfileId: profile({}).id })
		);

		await expect
			.element(page.getByRole('combobox', { name: 'Profil batas' }))
			.toHaveValue(profile({}).id);
	});

	it('offers a retry when the list fails to load, and says so if confirmed anyway', async () => {
		const onRetryProfiles = vi.fn();
		await render(
			LimitProfileDialog,
			props({ profiles: undefined, profilesError: true, onRetryProfiles })
		);

		await expect
			.element(page.getByText('Daftar profil batas gagal dimuat.', { exact: true }))
			.toBeVisible();
		await page.getByRole('button', { name: 'Coba lagi' }).click();
		expect(onRetryProfiles).toHaveBeenCalledTimes(1);

		await userEvent.fill(page.getByLabelText('Alasan'), 'Pilot');
		await page.getByRole('button', { name: 'Simpan profil' }).click();
		await expect
			.element(page.getByRole('button', { name: 'Simpan profil' }))
			.toHaveAccessibleDescription(/Daftar profil batas gagal dimuat. Pilih Coba lagi/);
	});
});
