import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { parsePilotLimitsResponse } from '$lib/api/resources/pilot-limits';
import { createSchedule, parseSchedule } from '$lib/api/resources/schedules';
import QueryTestHost from '$lib/testing/QueryTestHost.svelte';
import { errorFromWorkloadFixture, getWorkloadFixture } from '$lib/testing/workload-fixtures';
import { scheduleLimits } from '../schedules';
import ScheduleForm from './ScheduleForm.svelte';

vi.mock('$lib/config/public', () => ({
	publicConfig: { apiUrl: 'http://api.test', appUrl: 'http://app.test' }
}));
vi.mock('$lib/api/resources/schedules', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/api/resources/schedules')>()),
	createSchedule: vi.fn(),
	updateSchedule: vi.fn()
}));

const limits = scheduleLimits(parsePilotLimitsResponse(getWorkloadFixture('pilot-limits-on').body));
const created = parseSchedule(getWorkloadFixture('schedule-create').body);
const onSaved = vi.fn();

function open(props: Record<string, unknown> = {}) {
	return render(QueryTestHost, {
		props: {
			component: ScheduleForm,
			props: { projectId: 'p-1', limits, cancelHref: '/projects/p-1/settings', onSaved, ...props }
		}
	});
}

const form = () => page.getByTestId('schedule-form');
const preview = () => page.getByTestId('schedule-preview');

beforeEach(() => {
	vi.mocked(createSchedule).mockReset();
	onSaved.mockReset();
});

describe('ScheduleForm', () => {
	it('starts on a nightly preset and previews the next three runs in WIB', async () => {
		await open();
		await expect
			.element(form().getByRole('radio', { name: /Setiap hari pukul 02\./ }))
			.toBeChecked();
		await expect.element(preview()).toHaveTextContent(/WIB/);
		await expect.element(preview().getByRole('listitem').nth(2)).toHaveTextContent(/02\.\d\d WIB$/);
	});

	it('says at once when an expression is closer than the workspace minimum', async () => {
		await open();
		await form().getByLabelText('Ekspresi cron').fill('*/5 * * * *');
		await expect.element(preview()).toHaveTextContent(/paling sering berjalan setiap 15 menit/);
		await expect.element(form().getByRole('radio', { name: 'Kustom' })).toBeChecked();
	});

	it('creates the schedule with what the form shows', async () => {
		vi.mocked(createSchedule).mockResolvedValue(created);
		await open();
		await form().getByLabelText('Nama').fill('Laporan harian');
		await form().getByLabelText('Perintah').fill('php artisan report:daily');
		await form().getByLabelText('Ekspresi cron').fill('30  2 * * *');
		await form().getByRole('button', { name: 'Simpan jadwal' }).click();
		expect(createSchedule).toHaveBeenCalledWith('p-1', {
			name: 'Laporan harian',
			command: 'php artisan report:daily',
			cron_expression: '30 2 * * *',
			timezone: 'Asia/Jakarta',
			timeout_seconds: 300,
			enabled: true
		});
		expect(onSaved).toHaveBeenCalledWith(created, true);
	});

	it('fills the Laravel scheduler at the minimum interval and says what Laravel runs', async () => {
		await open({ laravelSuggestion: true });
		await expect.element(form().getByLabelText('Perintah')).toHaveValue('php artisan schedule:run');
		await expect.element(form().getByLabelText('Ekspresi cron')).toHaveValue('*/15 * * * *');
		await expect
			.element(form())
			.toHaveTextContent(/Laravel hanya menjalankan task yang jatuh tempo/);
	});

	it('starts disabled when the workspace has no active schedule left, and says why', async () => {
		await open({ limits: { ...limits, currentSchedules: 2 } });
		await expect.element(form().getByRole('switch', { name: 'Aktif' })).not.toBeChecked();
		await expect.element(form()).toHaveTextContent(/disimpan nonaktif/);
	});

	it('shows the refusal of the schedule limit in words that say what to do', async () => {
		vi.mocked(createSchedule).mockRejectedValue(errorFromWorkloadFixture('schedule-create-limit'));
		await open();
		await form().getByLabelText('Nama').fill('Ketiga');
		await form().getByLabelText('Perintah').fill('php artisan x');
		await form().getByRole('button', { name: 'Simpan jadwal' }).click();
		await expect.element(form().getByRole('alert')).toHaveTextContent(/Simpan jadwal ini nonaktif/);
	});
});
