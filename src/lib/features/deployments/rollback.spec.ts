import { describe, expect, it } from 'vitest';
import { apiErrorFromResponse, NetworkError } from '$lib/api/errors';
import {
	getRollbackErrorMessage,
	getRollbackPlan,
	isStaleRollbackTarget,
	ROLLBACK_COPY
} from './rollback';

const target = {
	id: 'd4',
	sequence: 4,
	commit_sha: '9f8e7d6c5b4a39281706f5e4d3c2b1a098765432',
	commit_message: 'fix: harga di keranjang',
	rollback_target: { image_expected: true }
};
const live = {
	id: 'd7',
	sequence: 7,
	commit_sha: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
	commit_message: null
};

describe('getRollbackPlan', () => {
	it('compares the live version with the target, without a build when the image is kept', () => {
		const plan = getRollbackPlan(target, live, { auto_deploy: true, auto_deploy_pause: null });
		expect(plan.current).toEqual({
			id: 'd7',
			sequence: 7,
			shortSha: 'a1b2c3d',
			message: 'Deployment manual'
		});
		expect(plan.target).toMatchObject({ sequence: 4, shortSha: '9f8e7d6' });
		expect(plan.imageKept).toBe(true);
		expect(plan.notes).toEqual([
			ROLLBACK_COPY.settings(4),
			ROLLBACK_COPY.imageKept,
			ROLLBACK_COPY.autoDeployPaused
		]);
		expect(plan.notes[0]).toContain('Environment variable tetap yang sekarang');
	});

	it('says the commit is built again when the image is gone', () => {
		const plan = getRollbackPlan({ ...target, rollback_target: { image_expected: false } }, live, {
			auto_deploy: true
		});
		expect(plan.imageKept).toBe(false);
		expect(plan.notes).toContain(ROLLBACK_COPY.imageRebuilt);
		expect(plan.notes).not.toContain(ROLLBACK_COPY.imageKept);
	});

	it('says the target brings back its own workers when the project has any (ADR-022)', () => {
		const withWorkers = getRollbackPlan(target, live, { auto_deploy: false }, { hasWorkers: true });
		expect(withWorkers.notes).toEqual([
			ROLLBACK_COPY.settings(4),
			ROLLBACK_COPY.imageKept,
			ROLLBACK_COPY.workers(4)
		]);
		expect(withWorkers.notes[2]).toMatch(/tidak berjalan sampai deployment berikutnya/);
		expect(getRollbackPlan(target, live, { auto_deploy: false }).notes).not.toContain(
			ROLLBACK_COPY.workers(4)
		);
	});

	it('pauses auto-deploy only where it is on, or already paused by an earlier rollback', () => {
		expect(getRollbackPlan(target, live, { auto_deploy: false }).pausesAutoDeploy).toBe(false);
		expect(getRollbackPlan(target, live, { auto_deploy: false }).notes).not.toContain(
			ROLLBACK_COPY.autoDeployPaused
		);
		const paused = {
			paused_at: '2026-11-23T03:00:00Z',
			reason: 'rollback',
			deployment_id: 'd6',
			deployment_sequence: 6,
			held_push_count: 1
		} as const;
		expect(
			getRollbackPlan(target, live, { auto_deploy: false, auto_deploy_pause: paused })
				.pausesAutoDeploy
		).toBe(true);
	});

	it('has no current side when nothing serves', () => {
		expect(getRollbackPlan(target, null, { auto_deploy: true }).current).toBeNull();
	});
});

describe('getRollbackErrorMessage', () => {
	const refused = (reason: unknown) =>
		apiErrorFromResponse(409, {
			code: 'DEPLOYMENT_NOT_ROLLBACK_TARGET',
			apiMessage: 'Deployment cannot be rolled back to.',
			details: { reason }
		});

	it('explains each refusal reason by code, never by the API message', () => {
		expect(getRollbackErrorMessage(refused('already_active'), 4)).toBe(
			ROLLBACK_COPY.refused.already_active(4)
		);
		expect(getRollbackErrorMessage(refused('branch_changed'), 4)).toBe(
			ROLLBACK_COPY.refused.branch_changed(4)
		);
		expect(getRollbackErrorMessage(refused('not_succeeded'), 4)).toBe(
			ROLLBACK_COPY.refused.not_succeeded(4)
		);
		expect(getRollbackErrorMessage(refused('no_commit'), 4)).toBe(
			ROLLBACK_COPY.refused.no_commit(4)
		);
		expect(getRollbackErrorMessage(refused('settings_unavailable'), 4)).toBe(
			ROLLBACK_COPY.refused.settings_unavailable(4)
		);
		expect(getRollbackErrorMessage(refused('something_new'), 4)).toBe(
			ROLLBACK_COPY.refusedOther(4)
		);
		expect(isStaleRollbackTarget(refused('already_active'))).toBe(true);
	});

	it('reads a suspended project and the deploy refusals as Redeploy does', () => {
		expect(
			getRollbackErrorMessage(
				apiErrorFromResponse(409, { code: 'PROJECT_SUSPENDED', apiMessage: 'Suspended.' }),
				4
			)
		).toBe(ROLLBACK_COPY.suspended);
		expect(
			getRollbackErrorMessage(
				apiErrorFromResponse(409, {
					code: 'PROJECT_RELEASE_COMMAND_UNSUPPORTED',
					apiMessage: 'x'
				}),
				4
			)
		).toContain('release command');
	});

	it('falls back to the connection message without an answer', () => {
		expect(getRollbackErrorMessage(new NetworkError(), 4)).not.toBe('');
		expect(isStaleRollbackTarget(new NetworkError())).toBe(false);
	});
});
