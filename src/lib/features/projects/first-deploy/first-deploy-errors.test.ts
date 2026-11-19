import { describe, expect, it } from 'vitest';
import { ApiError } from '$lib/api/errors';
import { QUOTA_COPY } from '$lib/features/databases/presentation';
import {
	FIRST_DEPLOY_ERROR_COPY,
	firstDeployFailure,
	isAlreadyAttached
} from './first-deploy-errors';

const refusal = (code: string, details: Record<string, unknown> = {}, message = 'Pesan API.') =>
	new ApiError(message, 409, {}, undefined, { code, details });

const create = { kind: 'create' } as const;
const attach = { kind: 'attach', databaseId: 'db-1' } as const;

describe('firstDeployFailure for the database step', () => {
	it.each([
		['DATABASE_UNAVAILABLE', {}, FIRST_DEPLOY_ERROR_COPY.unavailable],
		['DATABASE_LIMIT_EXCEEDED', { limit: 2, current: 2 }, QUOTA_COPY.countFull(2)],
		['DATABASE_LIMIT_EXCEEDED', { limit: 0, current: 0 }, QUOTA_COPY.disabled]
	])('maps %s to its copy and offers going on without a database', (code, details, message) => {
		expect(firstDeployFailure('database', refusal(code, details), create)).toEqual({
			message,
			offerWithoutDatabase: true
		});
	});

	it('rebuilds the storage refusal from its numbers', () => {
		const failure = firstDeployFailure(
			'database',
			refusal('DATABASE_STORAGE_LIMIT_EXCEEDED', {
				limit_mb: 512,
				current_bytes: 600 * 1024 * 1024
			}),
			create
		);
		expect(failure.message).toContain('600 MB dari 512 MB');
		expect(failure.offerWithoutDatabase).toBe(true);
	});

	it.each(['DATABASE_REGION_UNAVAILABLE', 'DATABASE_CROSS_REGION_UNSUPPORTED'])(
		'offers going on without a database for %s',
		(code) => {
			expect(firstDeployFailure('database', refusal(code), create).offerWithoutDatabase).toBe(true);
		}
	);

	it('keeps the API’s own words for an attach refusal that a retry can fix', () => {
		expect(
			firstDeployFailure(
				'database',
				refusal('DATABASE_NOT_READY', { status: 'provisioning' }, 'Database kopi belum siap.'),
				attach
			)
		).toEqual({ message: 'Database kopi belum siap.', offerWithoutDatabase: false });
	});

	it('falls back per action for an error without a code', () => {
		expect(firstDeployFailure('database', new Error('boom'), attach).message).toBe(
			FIRST_DEPLOY_ERROR_COPY.attachDatabase
		);
		expect(firstDeployFailure('database', new Error('boom'), create).message).toBe(
			FIRST_DEPLOY_ERROR_COPY.createDatabase
		);
	});
});

describe('firstDeployFailure for the other steps', () => {
	it('names a database that is not ready when the deploy is refused', () => {
		expect(
			firstDeployFailure('deploy', refusal('DATABASE_NOT_READY', { status: 'failed' }), attach)
				.message
		).toBe(FIRST_DEPLOY_ERROR_COPY.databaseNotReady('failed'));
	});

	it('shows the field error of a refused release command', () => {
		const error = new ApiError('Data tidak valid.', 422, {
			release_command: ['Release command terlalu panjang.']
		});
		expect(firstDeployFailure('release-command', error, create).message).toBe(
			'Release command terlalu panjang.'
		);
	});
});

describe('isAlreadyAttached', () => {
	it('recognises the refusal of a second database for the project', () => {
		expect(isAlreadyAttached(refusal('PROJECT_DATABASE_ALREADY_ATTACHED'))).toBe(true);
		expect(isAlreadyAttached(refusal('DATABASE_LIMIT_EXCEEDED'))).toBe(false);
		expect(isAlreadyAttached(new Error('x'))).toBe(false);
	});
});
