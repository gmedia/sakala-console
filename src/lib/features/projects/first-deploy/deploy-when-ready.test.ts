import { describe, expect, it } from 'vitest';
import {
	deployWhenReadyOf,
	deployWhenReadySkippedText,
	deployWhenReadyView,
	isWaitingForDatabase
} from './deploy-when-ready';

const request = (
	status: string,
	extra: Partial<{ deployment_id: string; skipped_reason: string }> = {}
) => ({
	status,
	requested_at: '2026-11-19T10:00:00Z',
	deployment_id: extra.deployment_id ?? null,
	skipped_reason: extra.skipped_reason ?? null
});

const projectWith = (deploy_when_ready: ReturnType<typeof request> | null | undefined) => ({
	databases: [
		{
			id: 'db-1',
			name: 'kopi',
			status: 'provisioning',
			region: 'jkt',
			variables: [],
			overridden_variables: [],
			deploy_when_ready
		}
	]
});

describe('deployWhenReadyView', () => {
	it('waits while the database is made', () => {
		expect(deployWhenReadyView(request('waiting'))).toEqual({ kind: 'waiting' });
	});

	it('hands over the deployment the API started', () => {
		expect(deployWhenReadyView(request('started', { deployment_id: 'd-1' }))).toEqual({
			kind: 'started',
			deploymentId: 'd-1'
		});
	});

	it('explains a skip per reason, and marks a failed database', () => {
		expect(
			deployWhenReadyView(request('skipped', { skipped_reason: 'database_provisioning_failed' }))
		).toEqual({
			kind: 'skipped',
			reason: 'Database gagal dibuat, jadi deploy tidak dimulai.',
			provisioningFailed: true
		});
		expect(
			deployWhenReadyView(request('skipped', { skipped_reason: 'active_deployment_limit' }))
		).toMatchObject({
			provisioningFailed: false,
			reason: expect.stringContaining('deployment lain')
		});
	});

	it('keeps waiting for a status it does not know, and has nothing without a request', () => {
		expect(deployWhenReadyView(request('something-new'))).toEqual({ kind: 'waiting' });
		expect(deployWhenReadyView(null)).toBeNull();
	});
});

describe('deployWhenReadySkippedText', () => {
	it('falls back for a reason from a newer API', () => {
		expect(deployWhenReadySkippedText('new_reason')).toBe(
			'Deploy otomatis belum bisa dimulai untuk proyek ini.'
		);
		expect(deployWhenReadySkippedText(null)).toBe(
			'Deploy otomatis belum bisa dimulai untuk proyek ini.'
		);
	});
});

describe('isWaitingForDatabase', () => {
	it('reads the project’s attached database', () => {
		expect(isWaitingForDatabase(projectWith(request('waiting')))).toBe(true);
		expect(isWaitingForDatabase(projectWith(request('started', { deployment_id: 'd' })))).toBe(
			false
		);
		expect(isWaitingForDatabase(projectWith(undefined))).toBe(false);
		expect(isWaitingForDatabase({ databases: [] })).toBe(false);
		expect(isWaitingForDatabase(undefined)).toBe(false);
		expect(deployWhenReadyOf({})).toBeNull();
	});
});
