import { ApiError } from '$lib/api/errors';

/**
 * The current user resource says `role: 'admin'`. This only decides what the console shows: every
 * admin route answers 403 to anyone else, and that answer wins when the two disagree, for example
 * right after an admin was demoted.
 */
export function isAdmin(user: { role?: string | null } | null | undefined): boolean {
	return user?.role === 'admin';
}

export function isForbidden(error: unknown): boolean {
	return error instanceof ApiError && error.isForbidden;
}

export function isNotFound(error: unknown): boolean {
	return error instanceof ApiError && error.status === 404;
}
