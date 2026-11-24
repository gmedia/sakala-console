import { describe, expect, it } from 'vitest';
import { parsePilotLimitsResponse } from '$lib/api/resources/pilot-limits';
import {
	parseSchedule,
	parseScheduleRunsPage,
	SCHEDULE_RUN_STATUSES
} from '$lib/api/resources/schedules';
import { errorFromWorkloadFixture, getWorkloadFixture } from '$lib/testing/workload-fixtures';
import {
	CRON_ERRORS,
	CRON_PRESET_IDS,
	cronError,
	cronPresets,
	emptyScheduleDraft,
	intervalText,
	isScheduleQuotaFull,
	pausedNotice,
	randomPresetMinute,
	RUN_REFUSAL_MESSAGES,
	runDurationText,
	runExplanation,
	runNowRefusal,
	runStatusView,
	scheduleChanges,
	scheduleDraftErrors,
	scheduleDraftFrom,
	scheduleLimits,
	scheduleQuotaText,
	scheduleSaveErrorMessage,
	scheduleStateView,
	scheduleSuggestion,
	suggestionExpression,
	type ScheduleDraft
} from './schedules';

const NOW = new Date('2026-11-24T10:07:30Z');
const limits = scheduleLimits(parsePilotLimitsResponse(getWorkloadFixture('pilot-limits-on').body));
const apiMessage = (name: string, field: string) =>
	(getWorkloadFixture(name).body as { errors: Record<string, string[]> }).errors[field][0];

function draft(overrides: Partial<ScheduleDraft> = {}): ScheduleDraft {
	return {
		name: 'Laporan harian',
		command: 'php artisan report:daily',
		cron_expression: '30 2 * * *',
		timezone: 'Asia/Jakarta',
		timeout_seconds: '300',
		enabled: true,
		...overrides
	};
}

describe('run status', () => {
	it('labels every status the API sends, and keeps a new one as it is', () => {
		const labels = SCHEDULE_RUN_STATUSES.map((status) => runStatusView(status).label);
		expect(labels).toEqual([
			'Menunggu giliran',
			'Mengantre',
			'Berjalan',
			'Berhasil',
			'Gagal',
			'Melewati batas waktu',
			'Dihentikan',
			'Terputus',
			'Terlewat',
			'Dilewati'
		]);
		expect(runStatusView('paused_by_node')).toEqual({
			label: 'paused_by_node',
			tone: 'neutral',
			open: false
		});
	});

	it('marks waiting, queued, and running as open, which Stop run applies to', () => {
		const open = SCHEDULE_RUN_STATUSES.filter((status) => runStatusView(status).open);
		expect(open).toEqual(['waiting', 'queued', 'running']);
	});

	it('explains a run in the API words, and a lost run without a summary in its own', () => {
		const runs = parseScheduleRunsPage(getWorkloadFixture('runs').body).data;
		const missed = runs.find((run) => run.status === 'missed')!;
		expect(runExplanation(missed)).toBe(missed.reason_message);
		expect(runExplanation({ status: 'lost', error_summary: null, reason_message: null })).toMatch(
			/berhenti melapor/
		);
		expect(
			runExplanation({ status: 'succeeded', error_summary: null, reason_message: null })
		).toBeNull();
	});

	it('says the duration in words', () => {
		expect(runDurationText(5230)).toBe('5 detik');
		expect(runDurationText(300_000)).toBe('5 menit');
		expect(runDurationText(null)).toBeNull();
	});
});

describe('schedule state', () => {
	it('tells a schedule Sakala paused from one switched off and one failing', () => {
		const paused = parseSchedule(getWorkloadFixture('schedule-paused').body);
		expect(scheduleStateView(paused)).toMatchObject({ key: 'paused', label: 'Dijeda otomatis' });
		expect(scheduleStateView({ ...paused, paused_at: null })).toMatchObject({ key: 'disabled' });
		expect(scheduleStateView({ ...paused, enabled: true, paused_at: null })).toMatchObject({
			key: 'failing',
			label: 'Gagal 10 kali berturut-turut'
		});
		expect(
			scheduleStateView({ ...paused, enabled: true, paused_at: null, health: 'healthy' })
		).toMatchObject({ key: 'active', label: 'Aktif' });
	});

	it('says why and how to resume a paused schedule', () => {
		const paused = parseSchedule(getWorkloadFixture('schedule-paused').body);
		const notice = pausedNotice(paused, 'Sel, 24 Nov 2026, 09.30 WIB');
		expect(notice).toMatch(/setelah 10 run gagal berturut-turut/);
		expect(notice).toMatch(/Aktifkan lagi/);
	});
});

describe('presets', () => {
	it('offers the workspace minimum when it divides an hour, then hourly, daily, and weekly', () => {
		expect(cronPresets(15, 23)).toEqual([
			{ id: CRON_PRESET_IDS.interval, label: 'Setiap 15 menit', expression: '*/15 * * * *' },
			{
				id: CRON_PRESET_IDS.hourly,
				label: 'Setiap jam pada menit 23',
				expression: '23 * * * *'
			},
			{ id: CRON_PRESET_IDS.daily, label: 'Setiap hari pukul 02.23', expression: '23 2 * * *' },
			{ id: CRON_PRESET_IDS.weekly, label: 'Setiap Senin pukul 02.23', expression: '23 2 * * 1' }
		]);
	});

	it('never offers what the minimum would refuse', () => {
		expect(cronPresets(7, 5).map((preset) => preset.id)).toEqual(['hourly', 'daily', 'weekly']);
		expect(cronPresets(120, 5).map((preset) => preset.id)).toEqual(['daily', 'weekly']);
		for (const preset of cronPresets(15, 41)) {
			expect(cronError(preset.expression, 'Asia/Jakarta', 15, NOW)).toBeUndefined();
		}
	});

	it('picks a minute from 1 to 59, never 0', () => {
		expect(randomPresetMinute(() => 0)).toBe(1);
		expect(randomPresetMinute(() => 0.999)).toBe(59);
	});
});

describe('schedule form', () => {
	it('accepts a valid draft', () => {
		expect(Object.values(scheduleDraftErrors(draft(), limits, NOW)).filter(Boolean)).toEqual([]);
	});

	it('refuses an expression closer than the minimum, in the API words', () => {
		const errors = scheduleDraftErrors(draft({ cron_expression: '*/5 * * * *' }), limits, NOW);
		expect(errors.cron_expression).toBe(apiMessage('schedule-create-interval', 'cron_expression'));
	});

	it('refuses the shapes the API refuses, before sending', () => {
		expect(cronError('@daily', 'Asia/Jakarta', 15, NOW)).toBe(CRON_ERRORS.macro);
		expect(cronError('0 * * *', 'Asia/Jakarta', 15, NOW)).toBe(
			apiMessage('schedule-create-invalid', 'cron_expression')
		);
		const errors = scheduleDraftErrors(
			draft({ name: '', command: 'a\nb', timeout_seconds: '601' }),
			limits,
			NOW
		);
		expect(errors.name).toMatch(/Isi nama jadwal/);
		expect(errors.command).toBe(apiMessage('schedule-create-multiline', 'command'));
		expect(errors.timeout_seconds).toBe(apiMessage('schedule-create-invalid', 'timeout_seconds'));
	});

	it('starts disabled when the workspace already uses all its schedules', () => {
		expect(emptyScheduleDraft(limits, '0 2 * * *').enabled).toBe(true);
		const full = { ...limits, currentSchedules: 2 };
		expect(isScheduleQuotaFull(full)).toBe(true);
		expect(emptyScheduleDraft(full, '0 2 * * *')).toMatchObject({
			enabled: false,
			timezone: 'Asia/Jakarta',
			timeout_seconds: '300'
		});
	});

	it('sends only what changed', () => {
		const schedule = parseSchedule(getWorkloadFixture('schedule-create').body);
		const unchanged = scheduleDraftFrom(schedule);
		expect(scheduleChanges(unchanged, schedule)).toEqual({});
		expect(
			scheduleChanges(
				{ ...unchanged, cron_expression: '45  */2 * * *', timeout_seconds: '120' },
				schedule
			)
		).toEqual({ cron_expression: '45 */2 * * *', timeout_seconds: 120 });
	});

	it('names the quota and the minimum interval', () => {
		expect(scheduleQuotaText(limits)).toBe(
			'0 dari 2 jadwal aktif di workspace ini terpakai. Jarak antar-run paling dekat 15 menit.'
		);
		expect(scheduleQuotaText({ ...limits, maxSchedules: 0 })).toMatch(
			/belum bisa menjalankan jadwal/
		);
		expect(intervalText(90)).toBe('1 jam 30 menit');
	});
});

describe('refusals', () => {
	it('explains a refused run now by its reason', () => {
		expect(runNowRefusal(errorFromWorkloadFixture('run-now-overlap'))).toEqual({
			reason: 'overlap',
			message: RUN_REFUSAL_MESSAGES.overlap
		});
		expect(runNowRefusal(errorFromWorkloadFixture('run-now-no-live'))?.message).toMatch(
			/Deploy proyek dulu/
		);
		expect(runNowRefusal(new Error('offline'))).toBeNull();
	});

	it('says what to do when the schedule limit is reached', () => {
		expect(
			scheduleSaveErrorMessage(errorFromWorkloadFixture('schedule-create-limit'), 'fallback')
		).toBe(
			'Workspace ini sudah punya 2 jadwal aktif, dan batasnya 2. Simpan jadwal ini nonaktif, atau nonaktifkan jadwal lain dulu.'
		);
	});
});

describe('Laravel suggestion', () => {
	it('suggests schedule:run at the minimum interval for a Laravel project without one', () => {
		expect(scheduleSuggestion('laravel', [])?.command).toBe('php artisan schedule:run');
		expect(scheduleSuggestion('laravel', [{ command: 'php artisan schedule:run' }])).toBeNull();
		expect(scheduleSuggestion('express', [])).toBeNull();
		expect(suggestionExpression(15, 7)).toBe('*/15 * * * *');
	});
});
