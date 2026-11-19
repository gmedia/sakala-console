import { describe, expect, it } from 'vitest';
import type { DeploymentEvent } from '$lib/api/resources/deployment';
import type { DeploymentLogLine } from './deployment-logs';
import { classifyLogLines, getFailureWindow } from './log-classification';

const line = (
	sequence: number,
	time: string,
	stream: DeploymentLogLine['stream'],
	message: string
): DeploymentLogLine => ({
	sequence,
	stream,
	message,
	recorded_at: `2026-09-20T08:${time}.000000Z`
});

let eventSequence = 0;
const event = (type: string, time: string) =>
	({
		sequence: (eventSequence += 1),
		level: 'info',
		type,
		message: type,
		metadata: null,
		occurred_at: `2026-09-20T08:${time}Z`
	}) as DeploymentEvent;

const EVENTS = [
	event('deployment.checkout.started', '41:02'),
	event('deployment.analysis.started', '41:05'),
	event('deployment.build.started', '41:08')
];

const BUILD_PROGRESS = [
	line(1, '41:03', 'stderr', "Cloning into '/workspace/source'..."),
	line(2, '41:05', 'stdout', 'Railpack 0.9.2'),
	line(3, '41:09', 'stderr', '#5 [build 2/5] RUN npm ci'),
	line(4, '41:12', 'stderr', '#5 3.112 npm warn deprecated inflight@1.0.6: leaks memory.'),
	line(5, '41:18', 'stderr', '#6 4.880 ✓ 42 modules transformed, 0 errors')
];

const base = {
	started_at: '2026-09-20T08:41:01Z',
	created_at: '2026-09-20T08:41:00Z',
	finished_at: '2026-09-20T08:41:24Z'
};

describe('a successful deployment', () => {
	const window = getFailureWindow({ ...base, status: 'succeeded', failure: null }, EVENTS);

	it('has no failure window', () => {
		expect(window).toBeNull();
	});

	it('shows stderr progress as normal, and only an explicit warning as a warning', () => {
		expect(classifyLogLines(BUILD_PROGRESS, window)).toEqual([
			'normal',
			'normal',
			'normal',
			'warning',
			'normal'
		]);
	});
});

describe('a deployment that failed while building', () => {
	const failed = {
		...base,
		status: 'failed' as const,
		failure: {
			code: 'runtime_build_failed',
			category: 'build',
			summary: 'Build berhenti.',
			recovery_hint: '',
			user_fixable: true,
			detail: null,
			stage: 'building' as const
		}
	};
	const window = getFailureWindow(failed, EVENTS);
	const lines = [
		line(1, '41:03', 'stderr', 'error: this is from cloning, before the failed stage'),
		...BUILD_PROGRESS.slice(1),
		line(6, '41:22', 'stderr', '#6 3.410 error during build:'),
		line(7, '41:22', 'stderr', '#6 3.412     at viteLog (node_modules/vite/dep.js:51432:15)'),
		line(8, '41:23', 'stderr', 'exit code: 1'),
		line(
			9,
			'41:30',
			'system',
			'Build files could not be fully removed. Failed cleanup is harmless.'
		)
	];

	it('starts the window when the failed stage began', () => {
		expect(window?.start).toBe(Date.parse('2026-09-20T08:41:08Z'));
	});

	it('marks error lines of that stage and its final stderr line, nothing else', () => {
		expect(classifyLogLines(lines, window)).toEqual([
			'normal', // an error word before the failed stage
			'normal',
			'normal',
			'warning',
			'normal', // "0 errors" is not the word error
			'error',
			'normal', // a stack frame without an error word
			'error', // the last stderr line of the stage
			'normal' // the agent's own system lines are never errors
		]);
	});

	it('falls back to the last recorded stage when the failed one has no event', () => {
		const noStage = { ...failed, failure: { ...failed.failure, stage: null } };
		expect(getFailureWindow(noStage, EVENTS)?.start).toBe(Date.parse('2026-09-20T08:41:08Z'));
	});

	it('takes the whole run when no stage was recorded', () => {
		expect(getFailureWindow(failed, [])?.start).toBe(Date.parse(base.started_at));
	});
});

describe('words', () => {
	const window = { start: -Infinity, end: Infinity };
	it.each([
		['npm ERR! code ELIFECYCLE', 'error'],
		['ERROR: failed to solve', 'error'],
		['Traceback (most recent call last):', 'error'],
		['fatal: repository not found', 'error'],
		['PHP Fatal error:  Uncaught Exception', 'error'],
		['WARNING: The requested image platform does not match', 'warning'],
		['npm WARN deprecated', 'warning'],
		['warnings: 0', 'normal'],
		['Terrorist module loaded', 'normal']
	])('"%s" is %s inside a failed stage', (message, level) => {
		const lines = [line(1, '41:10', 'stdout', message), line(2, '41:11', 'stderr', 'last')];
		expect(classifyLogLines(lines, window)[0]).toBe(level);
	});
});
