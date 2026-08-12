export function validateRepositoryUrl(url: string): string | null {
	if (!url.trim()) {
		return 'Repository URL wajib diisi.';
	}

	try {
		const parsed = new URL(url);
		const parts = parsed.pathname.split('/').filter(Boolean);

		if (parts.length < 2) {
			return 'Format repository GitHub tidak valid.';
		}

		return null;
	} catch {
		return 'Repository URL tidak valid.';
	}
}
