export type ParsedGitUrl = {
	owner: string;
	name: string;
	fullName: string;
};

export function parseGitUrl(url: string): ParsedGitUrl | null {
	try {
		const cleaned = url.trim().replace(/\.git$/, '');
		const { pathname } = new URL(cleaned);
		const segments = pathname.split('/').filter(Boolean);

		if (segments.length < 2) return null;

		const [owner, name] = segments;
		return { owner, name, fullName: `${owner}/${name}` };
	} catch {
		return null;
	}
}
