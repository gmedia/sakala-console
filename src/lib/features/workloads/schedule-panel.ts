import type { PanelStep } from '$lib/components/panel/panel';
import type { ProjectSchedule } from '$lib/api/resources/schedules';
import { runStatusView } from './schedules';

/** The schedule page's side panel and fact line (docs/UI_GUIDELINES.md, text budget). */
export const SCHEDULE_PANEL_COPY = {
	label: 'Langkah dan bantuan jadwal',
	failedRun: 'Lihat run gagal',
	next: (time: string) => `Berikutnya ${time}`,
	timeout: (seconds: string) => `batas ${seconds}`,
	howItRuns: 'Cara jadwal berjalan',
	history: 'Riwayat dan log',
	editAll: 'Ubah jadwal',
	timeoutSubject: 'batas waktu run',
	nameSubject: 'nama jadwal',
	nameHint: 'Hanya untuk dikenali di Sakala. Perintah dan waktunya tidak berubah.',
	timeoutSaved: (seconds: string) => `Batas waktu run menjadi ${seconds}.`,
	dangerTitle: 'Hapus jadwal',
	dangerBody: 'Riwayat run-nya ikut terhapus.'
} as const;

/** Where a run sits on the page, for a next step that leads to it. */
export const runAnchor = (runId: string) => `run-${runId}`;

type StepSchedule = Pick<ProjectSchedule, 'latest_run'>;

/**
 * The next step that applies to the schedule now: when its newest run failed, the way to that run
 * and its log, for someone who may fix it. It goes away by itself once a run succeeds, so it needs
 * no way to hide it. Viewers get no steps, as on every page.
 */
export function deriveScheduleSteps(schedule: StepSchedule, canManage: boolean): PanelStep[] {
	const run = schedule.latest_run;
	if (!canManage || !run || runStatusView(run.status).tone !== 'error') return [];
	return [
		{
			id: 'failed-run',
			label: SCHEDULE_PANEL_COPY.failedRun,
			href: `#${runAnchor(run.id)}`
		}
	];
}
