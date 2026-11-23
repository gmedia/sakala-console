import { describe, expect, it, vi } from 'vitest';
import { apiErrorFromResponse } from '$lib/api/errors';
import { ALREADY_MEMBER_CODE, inviteEach, parseInviteAddresses } from './invite-addresses';

const describeError = (error: unknown) => (error instanceof Error ? error.message : 'gagal');

describe('parseInviteAddresses', () => {
	it('takes a column pasted from a spreadsheet, one address per line', () => {
		const pasted =
			'fajar@kampus.test\r\ngita@kampus\nhana@kampus.test\nbima@kampus.test\nindra@kampus.test\n';

		expect(parseInviteAddresses(pasted, ['bima@kampus.test'])).toEqual({
			ready: ['fajar@kampus.test', 'hana@kampus.test', 'indra@kampus.test'],
			malformed: ['gita@kampus'],
			members: ['bima@kampus.test']
		});
	});

	it('splits on commas, semicolons, spaces, and tabs too', () => {
		expect(parseInviteAddresses('a@x.id, b@x.id;c@x.id d@x.id\te@x.id').ready).toEqual([
			'a@x.id',
			'b@x.id',
			'c@x.id',
			'd@x.id',
			'e@x.id'
		]);
	});

	it('invites an address once, whatever its letter case, and keeps the first spelling', () => {
		expect(parseInviteAddresses('Dewi@Kampus.test dewi@kampus.test').ready).toEqual([
			'Dewi@Kampus.test'
		]);
	});

	it('matches members regardless of case, and skips members without an email', () => {
		expect(
			parseInviteAddresses('BIMA@kampus.test', [null, undefined, 'bima@kampus.test']).members
		).toEqual(['BIMA@kampus.test']);
	});

	it('finds nothing in blank input', () => {
		expect(parseInviteAddresses(' \n , ')).toEqual({ ready: [], malformed: [], members: [] });
	});
});

describe('inviteEach', () => {
	const member = apiErrorFromResponse(409, {
		apiMessage: 'Orang ini sudah menjadi anggota workspace.',
		code: ALREADY_MEMBER_CODE
	});

	it('sends each address with the same role, in order', async () => {
		const invite = vi.fn().mockResolvedValue({});
		const progress: number[] = [];

		const outcome = await inviteEach(
			['a@x.id', 'b@x.id'],
			'viewer',
			invite,
			describeError,
			(done) => progress.push(done)
		);

		expect(invite.mock.calls).toEqual([
			[{ email: 'a@x.id', role: 'viewer' }],
			[{ email: 'b@x.id', role: 'viewer' }]
		]);
		expect(outcome.sent).toEqual(['a@x.id', 'b@x.id']);
		expect(progress).toEqual([1, 2]);
	});

	it('keeps going past an address the API refuses, and says which one', async () => {
		const invalid = apiErrorFromResponse(422, {
			errors: { email: ['Kolom email harus berupa alamat email.'] }
		});
		const invite = vi
			.fn()
			.mockRejectedValueOnce(member)
			.mockRejectedValueOnce(invalid)
			.mockResolvedValueOnce({});

		const outcome = await inviteEach(
			['m@x.id', 'bad@x.id', 'ok@x.id'],
			'member',
			invite,
			describeError
		);

		expect(outcome).toEqual({
			sent: ['ok@x.id'],
			members: ['m@x.id'],
			failed: [{ email: 'bad@x.id', message: 'Kolom email harus berupa alamat email.' }],
			notSent: [],
			stopReason: null
		});
	});

	it('stops at a rate limit, and lists what was not tried', async () => {
		const limited = apiErrorFromResponse(429, { retryAfterSeconds: 120 });
		const invite = vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(limited);

		const outcome = await inviteEach(
			['a@x.id', 'b@x.id', 'c@x.id'],
			'member',
			invite,
			describeError
		);

		expect(invite).toHaveBeenCalledTimes(2);
		expect(outcome.sent).toEqual(['a@x.id']);
		expect(outcome.notSent).toEqual(['b@x.id', 'c@x.id']);
		expect(outcome.stopReason).toBe(limited.message);
	});
});
