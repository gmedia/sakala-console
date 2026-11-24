import { describe, expect, it } from 'vitest';
import { parsePilotLimitsResponse } from '$lib/api/resources/pilot-limits';
import { parseProcessList } from '$lib/api/resources/processes';
import { getWorkloadFixture } from '$lib/testing/workload-fixtures';
import {
	emptyProcessDraft,
	LARAVEL_QUEUE_WORKER,
	processCrashText,
	processDraftErrors,
	processDraftFrom,
	processPayload,
	processResourcesText,
	processSuggestion,
	workerQuota,
	workerQuotaText,
	type ProcessDraft
} from './processes';

const apiMessage = (name: string, field: string) =>
	(getWorkloadFixture(name).body as { errors: Record<string, string[]> }).errors[field][0];
const processes = parseProcessList(getWorkloadFixture('processes').body);
const LIMITS = { maxReplicas: 2, maxMemoryMb: 512, maxCpuMillis: 1000, takenNames: ['queue'] };

function draft(overrides: Partial<ProcessDraft> = {}): ProcessDraft {
	return { ...emptyProcessDraft(), name: 'mailer', command: 'npm run mailer', ...overrides };
}

describe('process form', () => {
	it('starts with one container and accepts a valid worker', () => {
		expect(emptyProcessDraft().replicas).toBe('1');
		expect(Object.values(processDraftErrors(draft(), LIMITS)).filter(Boolean)).toEqual([]);
	});

	it.each([
		['web', 'process-create-reserved'],
		['job', 'process-create-reserved'],
		['Queue 1', 'process-create-pattern'],
		['1queue', 'process-create-pattern'],
		['queue', 'process-create-duplicate']
	])('refuses the name %j in the API words', (name, fixture) => {
		expect(processDraftErrors(draft({ name }), LIMITS).name).toBe(apiMessage(fixture, 'name'));
	});

	it('refuses a long name, a multi-line command, and too many containers', () => {
		const errors = processDraftErrors(
			draft({ name: 'a'.repeat(31), command: 'a\nb', replicas: '3' }),
			LIMITS
		);
		expect(errors.name).toMatch(/paling panjang 30/);
		expect(errors.command).toBe(apiMessage('process-create-multiline', 'command'));
		expect(errors.replicas).toBe(apiMessage('process-create-replicas-max', 'replicas'));
	});

	it('keeps memory and CPU optional, within the caps', () => {
		expect(processDraftErrors(draft({ memory_mb: '' }), LIMITS).memory_mb).toBeUndefined();
		expect(processDraftErrors(draft({ memory_mb: '0' }), LIMITS).memory_mb).toMatch(/lebih dari 0/);
		expect(processDraftErrors(draft({ cpu_millis: '2000' }), LIMITS).cpu_millis).toMatch(
			/paling banyak 1000/
		);
	});

	it('sends a whole worker on create and only the changes on edit', () => {
		expect(processPayload(draft({ name: ' mailer ', memory_mb: '128' }))).toEqual({
			name: 'mailer',
			command: 'npm run mailer',
			replicas: 1,
			memory_mb: 128,
			cpu_millis: null
		});
		const queue = processes[1];
		expect(processPayload(processDraftFrom(queue), queue)).toEqual({});
		expect(
			processPayload({ ...processDraftFrom(queue), replicas: '0', memory_mb: '' }, queue)
		).toEqual({
			replicas: 0,
			memory_mb: null
		});
	});
});

describe('process presentation', () => {
	it('says how a worker crashed, in WIB', () => {
		expect(processCrashText(processes[1].crash!, 'Asia/Jakarta')).toBe(
			'Keluar dengan kode 1, restart 4 kali, sejak Sel, 24 Nov 2026, 17.01 WIB'
		);
		expect(
			processCrashText({ ...processes[1].crash!, oom_killed: true, restart_count: 0 }, 'UTC')
		).toBe('Kehabisan memori, sejak Sel, 24 Nov 2026, 10.01 UTC');
	});

	it('says which resources follow the project', () => {
		expect(processResourcesText(processes[0])).toBe('Memori ikut proyek, CPU 250 millicore');
	});

	it('names the worker quota and that workers use container slots', () => {
		const limits = parsePilotLimitsResponse(getWorkloadFixture('pilot-limits-on').body);
		const quota = workerQuota(limits, processes)!;
		expect(quota).toMatchObject({ max: 2, current: 0, defined: 1 });
		expect(workerQuotaText(quota)).toBe(
			'Workspace ini bisa menjalankan 2 container worker sekaligus, 0 sedang berjalan. Setiap container worker juga memakai satu slot container berjalan workspace (1 dari 5 terpakai).'
		);
		expect(workerQuotaText({ ...quota, max: 0 })).toMatch(/belum bisa menjalankan worker/);
		expect(workerQuota(undefined, processes)).toBeNull();
	});

	it('suggests the Laravel queue worker until the project has one', () => {
		expect(processSuggestion('laravel', [])).toBe(LARAVEL_QUEUE_WORKER);
		expect(
			processSuggestion('laravel', [{ name: 'jobs', command: 'php artisan queue:work' }])
		).toBeNull();
		expect(processSuggestion('express', [])).toBeNull();
	});
});
