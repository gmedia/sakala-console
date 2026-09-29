export const GITHUB_REPO_URL_REGEX =
	/^https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(\.git)?$/;

export function validateRepositoryUrl(url: string): string | null {
	const trimmed = url.trim();
	if (!trimmed) {
		return 'Repository URL wajib diisi.';
	}

	let parsed: URL;
	try {
		parsed = new URL(trimmed);
	} catch {
		return 'Repository URL tidak valid.';
	}

	const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
	if (hostname !== 'github.com') {
		return 'URL harus berupa repository GitHub publik (contoh: https://github.com/user/repo)';
	}

	const parts = parsed.pathname.split('/').filter(Boolean);
	if (parts.length < 2) {
		return 'Format repository GitHub tidak valid.';
	}

	if (!GITHUB_REPO_URL_REGEX.test(trimmed)) {
		return 'URL harus berupa repository GitHub publik (contoh: https://github.com/user/repo)';
	}

	return null;
}
