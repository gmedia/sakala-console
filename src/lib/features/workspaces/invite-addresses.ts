import { ApiError } from '$lib/api/errors';
import type { WorkspaceRole } from '$lib/api/resources/workspaces';

/**
 * What separates pasted addresses: commas, semicolons, spaces, tabs, and new lines, which covers a
 * column copied from a spreadsheet and a list from an email client.
 */
const ADDRESS_SEPARATOR = /[\s,;]+/;

/**
 * Enough to catch a typo before the request. The API validates the address for real, and its
 * refusal is shown next to the address, so this stays lenient on purpose.
 */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** sakala-api `AlreadyWorkspaceMemberException`. */
export const ALREADY_MEMBER_CODE = 'ALREADY_WORKSPACE_MEMBER';

export const INVITE_COPY = {
	example: 'nama@kampus.ac.id',
	malformed: (email: string) =>
		`${email} belum berupa alamat email lengkap, misalnya nama@kampus.ac.id.`,
	member: (email: string) => `${email} sudah menjadi anggota workspace ini.`,
	notSent: (count: number, reason: string) => `${count} alamat belum dikirim. ${reason}`
} as const;

export type ParsedAddresses = {
	/** Addresses to invite, each once, spelled as typed. */
	ready: string[];
	malformed: string[];
	/** Already members, as the member list says; the API refuses them too. */
	members: string[];
};

const normalize = (email: string) => email.trim().toLowerCase();

/**
 * Splits what was typed or pasted into addresses, each once (the case of a letter does not make a
 * second one), and sorts out the ones that cannot be invited before anything is sent.
 */
export function parseInviteAddresses(
	raw: string,
	memberEmails: readonly (string | null | undefined)[] = []
): ParsedAddresses {
	const members = new Set(memberEmails.filter(Boolean).map((email) => normalize(email!)));
	const seen = new Set<string>();
	const parsed: ParsedAddresses = { ready: [], malformed: [], members: [] };

	for (const address of raw.split(ADDRESS_SEPARATOR)) {
		const key = normalize(address);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		if (!LOOKS_LIKE_EMAIL.test(address)) parsed.malformed.push(address);
		else if (members.has(key)) parsed.members.push(address);
		else parsed.ready.push(address);
	}
	return parsed;
}

export type InviteOutcome = {
	sent: string[];
	/** Refused by the API as already a member, which the member list on screen did not know yet. */
	members: string[];
	/** Refused for a reason about this address, with the API's words. */
	failed: { email: string; message: string }[];
	/** Not tried, because the API said to stop (rate limit, lost permission). */
	notSent: string[];
	/** Why the rest was not tried. */
	stopReason: string | null;
};

/** Refusals that would answer every remaining address the same way. */
function stopsTheRest(error: unknown): boolean {
	return (
		error instanceof ApiError &&
		(error.isRateLimited || error.isForbidden || error.isUnauthenticated)
	);
}

/**
 * Invites the addresses one after another with the same role, the way the API takes them, and
 * reports what happened to each. One refused address does not stop the others; a rate limit does.
 */
export async function inviteEach(
	emails: readonly string[],
	role: WorkspaceRole,
	invite: (payload: { email: string; role: WorkspaceRole }) => Promise<unknown>,
	describe: (error: unknown) => string,
	onProgress?: (done: number) => void
): Promise<InviteOutcome> {
	const outcome: InviteOutcome = {
		sent: [],
		members: [],
		failed: [],
		notSent: [],
		stopReason: null
	};

	for (const [index, email] of emails.entries()) {
		try {
			await invite({ email, role });
			outcome.sent.push(email);
		} catch (error) {
			if (error instanceof ApiError && error.code === ALREADY_MEMBER_CODE) {
				outcome.members.push(email);
			} else if (stopsTheRest(error)) {
				outcome.notSent = emails.slice(index);
				outcome.stopReason = describe(error);
				break;
			} else {
				outcome.failed.push({
					email,
					message: (error instanceof ApiError && error.errors.email?.[0]) || describe(error)
				});
			}
		}
		onProgress?.(index + 1);
	}
	return outcome;
}
