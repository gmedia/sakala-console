/**
 * What people paste into "URL GitHub publik" is rarely the bare repository address: it comes from
 * the address bar of a file or a branch, from the Code button (`.git`, or the SSH form), or is
 * typed without `https://`. Each of those names one repository, so it is accepted and sent to the
 * API in one form, `https://github.com/owner/repo` (Postel's Law). Only GitHub is supported.
 *
 * Built on the platform `URL` parser. `hosted-git-info` was tried first: it refuses the forms
 * without a scheme and the `/blob/` links, and reads `#readme` as a branch, so it would need the
 * same rules around it.
 */

export const GITHUB_HOST = 'github.com';
export const GITHUB_REPOSITORY_EXAMPLE = 'https://github.com/owner/repo';

/** GitHub's own rules: owner up to 39 characters, repository names without spaces or slashes. */
const OWNER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/;
const NAME_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;
const SSH_PREFIX = /^(?:ssh:\/\/)?git@github\.com[:/]/i;
const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const GIT_SUFFIX = /\.git$/i;
/** `owner/repo` on its own, the way GitHub writes it in titles and READMEs. */
const SHORTHAND = /^([^/\s:.]+)\/([^/\s]+?)\/?$/;

export const REPOSITORY_URL_MESSAGES = {
	required: `Tempel alamat repository GitHub, contohnya ${GITHUB_REPOSITORY_EXAMPLE}.`,
	notGithub: `Sakala baru bisa membaca repository dari GitHub. Tempel alamat seperti ${GITHUB_REPOSITORY_EXAMPLE}.`,
	missingRepository: `Alamat ini belum menyebut nama repository-nya. Contoh lengkapnya: ${GITHUB_REPOSITORY_EXAMPLE}.`,
	unreadable: `Alamat ini tidak terbaca sebagai repository GitHub. Contoh yang bisa dipakai: ${GITHUB_REPOSITORY_EXAMPLE}.`
} as const;

export type NormalizedRepositoryUrl = {
	ok: true;
	/** Always `https://github.com/owner/repo`, the form the API stores. */
	url: string;
	owner: string;
	name: string;
	fullName: string;
	/** The input was not already the canonical address, so the field says which one is used. */
	changed: boolean;
};

export type RepositoryUrlError = { ok: false; message: string };

function parseLoosely(input: string): URL | null {
	let candidate = `https://${input}`;
	if (SSH_PREFIX.test(input)) candidate = input.replace(SSH_PREFIX, `https://${GITHUB_HOST}/`);
	else if (SCHEME.test(input)) candidate = input;
	try {
		return new URL(candidate);
	} catch {
		return null;
	}
}

export function normalizeGithubRepositoryUrl(
	raw: string
): NormalizedRepositoryUrl | RepositoryUrlError {
	const input = raw.trim();
	if (!input) return { ok: false, message: REPOSITORY_URL_MESSAGES.required };

	const shorthand = input.match(SHORTHAND);
	const parsed = parseLoosely(shorthand ? `${GITHUB_HOST}/${shorthand[1]}/${shorthand[2]}` : input);
	if (!parsed) return { ok: false, message: REPOSITORY_URL_MESSAGES.unreadable };

	const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
	if (host !== GITHUB_HOST) return { ok: false, message: REPOSITORY_URL_MESSAGES.notGithub };

	// Anything after owner/repo (tree/<branch>, blob/<path>, issues, a hash) points inside the same
	// repository. The branch is chosen in the next step.
	const [owner, rawName] = parsed.pathname.split('/').filter(Boolean);
	if (!owner || !rawName) return { ok: false, message: REPOSITORY_URL_MESSAGES.missingRepository };

	const name = rawName.replace(GIT_SUFFIX, '');
	if (!OWNER_PATTERN.test(owner) || !NAME_PATTERN.test(name) || /^\.+$/.test(name)) {
		return { ok: false, message: REPOSITORY_URL_MESSAGES.unreadable };
	}

	const url = `https://${GITHUB_HOST}/${owner}/${name}`;
	return { ok: true, url, owner, name, fullName: `${owner}/${name}`, changed: input !== url };
}

/** The message to show under the field, or null when the input names a GitHub repository. */
export function validateRepositoryUrl(url: string): string | null {
	const result = normalizeGithubRepositoryUrl(url);
	return result.ok ? null : result.message;
}
