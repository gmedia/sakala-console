import { describe, expect, it } from 'vitest';
import { apiErrorFromResponse } from '$lib/api/errors';
import {
	canRestart,
	getRestartErrorMessage,
	isRestartPending,
	parseRestartOutcome,
	RESTART_COPY
} from './restart';

const pending = { requested_at: '2026-11-23T03:00:00Z', status: 'pending' } as const;

describe('canRestart', () => {
	it('offers Restart while the project runs or crash-loops', () => {
		expect(canRestart({ status: 'active', runtime_status: 'running', restart: null })).toBe(true);
		expect(canRestart({ status: 'active', runtime_status: 'crashed' })).toBe(true);
	});

	it('does not offer it asleep, stopped, deploying, never deployed, or suspended', () => {
		for (const runtime_status of ['sleeping', 'stopped', 'deploying', 'not_deployed', 'failed']) {
			expect(canRestart({ status: 'active', runtime_status } as never)).toBe(false);
		}
		expect(canRestart({ status: 'suspended', runtime_status: 'running' })).toBe(false);
	});

	it('does not offer a second restart while one waits for its node', () => {
		expect(canRestart({ status: 'active', runtime_status: 'running', restart: pending })).toBe(
			false
		);
		expect(isRestartPending({ restart: pending })).toBe(true);
		expect(isRestartPending({})).toBe(false);
	});
});

describe('parseRestartOutcome', () => {
	it('reads how a restart ended from the broadcast', () => {
		expect(
			parseRestartOutcome({
				deployment_id: 'd8',
				status: 'succeeded',
				project_runtime_status: 'running',
				restart: { command_id: 'cmd-1', outcome: 'succeeded' }
			})
		).toEqual({ commandId: 'cmd-1', outcome: 'succeeded' });
		expect(parseRestartOutcome({ restart: { command_id: 'cmd-2', outcome: 'failed' } })).toEqual({
			commandId: 'cmd-2',
			outcome: 'failed'
		});
	});

	it('ignores every other update, and an outcome it does not know', () => {
		expect(parseRestartOutcome({ deployment_id: 'd8', status: 'succeeded' })).toBeNull();
		expect(
			parseRestartOutcome({ restart: { command_id: 'cmd-1', outcome: 'pending' } })
		).toBeNull();
		expect(parseRestartOutcome({ restart: { outcome: 'succeeded' } })).toBeNull();
		expect(parseRestartOutcome(null)).toBeNull();
	});
});

describe('getRestartErrorMessage', () => {
	it('explains each refusal by code', () => {
		const refusal = (code: string) => apiErrorFromResponse(409, { code, apiMessage: 'x' });
		expect(getRestartErrorMessage(refusal('PROJECT_NOT_RUNNING'))).toBe(RESTART_COPY.notRunning);
		expect(getRestartErrorMessage(refusal('PROJECT_RUNTIME_BUSY'))).toBe(RESTART_COPY.busy);
		expect(getRestartErrorMessage(refusal('PROJECT_SUSPENDED'))).toBe(RESTART_COPY.suspended);
	});
});
