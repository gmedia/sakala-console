/**
 * Where the "Profil batas" page sends the admin back after creating a profile from an assign
 * dialog. Only these two detail pages qualify, so a crafted link cannot redirect anywhere else.
 */
export type ProfileReturnTarget = { kind: 'workspaces' | 'users'; id: string };

const PATTERN = /^\/admin\/(workspaces|users)\/([A-Za-z0-9-]{1,64})$/;

export function profileReturnPath(target: ProfileReturnTarget): string {
	return `/admin/${target.kind}/${target.id}`;
}

export function parseProfileReturn(value: string | null): ProfileReturnTarget | null {
	const match = value ? PATTERN.exec(value) : null;
	if (!match) return null;
	return { kind: match[1] as ProfileReturnTarget['kind'], id: match[2] };
}

/** Query parameter that carries a freshly created profile back to its assign dialog. */
export const ASSIGN_PROFILE_PARAM = 'limit_profile';
