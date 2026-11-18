import type { Project } from '$lib/api/resources/projects';
import { getProjectPublicUrl } from './presentation';

/**
 * A project's avatar: the API's `thumbnail_url` when it sends one, otherwise a monogram of the
 * project's initials on a tile coloured from its id. It always sits next to the visible name, so it
 * helps tell projects apart and never identifies one on its own.
 */

/** One class per `--color-avatar-*` token in app.css, written out whole so Tailwind generates them. */
export const PROJECT_AVATAR_TONES = [
	'bg-avatar-1',
	'bg-avatar-2',
	'bg-avatar-3',
	'bg-avatar-4',
	'bg-avatar-5',
	'bg-avatar-6',
	'bg-avatar-7'
] as const;

export type ProjectAvatarTone = (typeof PROJECT_AVATAR_TONES)[number];

/**
 * What the avatar reads. The list sends no `slug`, only the public URL, whose first label is the
 * slug (the API builds the default domain as `<slug>.<base domain>`), so either one serves.
 */
export type ProjectAvatarSource = Pick<Project, 'id' | 'name'> & {
	slug?: string | null;
	public_url?: string | null;
	thumbnail_url?: string | null;
};

const MAX_INITIALS = 2;
const WORD_SEPARATOR = /[\s\-_./]+/u;
const LETTER_OR_NUMBER = /^[\p{L}\p{N}]/u;
// Indonesian casing, so the same name gives the same initials whatever the browser's language.
const INITIALS_LOCALE = 'id-ID';

const graphemes = new Intl.Segmenter(INITIALS_LOCALE, { granularity: 'grapheme' });

/** The first letter or number of a word, as a whole grapheme so a combining mark stays on it. */
function firstInitial(word: string): string | null {
	for (const { segment } of graphemes.segment(word)) {
		if (LETTER_OR_NUMBER.test(segment)) return segment;
	}
	return null;
}

/** Up to two initials from the first words that have a letter or number, or null when none does. */
export function initialsOf(text: string): string | null {
	const initials: string[] = [];
	for (const word of text.split(WORD_SEPARATOR)) {
		const initial = firstInitial(word);
		if (initial) initials.push(initial);
		if (initials.length === MAX_INITIALS) break;
	}
	return initials.length > 0 ? initials.join('').toLocaleUpperCase(INITIALS_LOCALE) : null;
}

function subdomainOf(publicUrl: string | null | undefined): string | null {
	const url = getProjectPublicUrl({ public_url: publicUrl });
	if (!url) return null;
	try {
		return new URL(url).hostname.split('.')[0] || null;
	} catch {
		return null;
	}
}

/**
 * The project's initials: from its name, else from its slug for a name with no letter or number
 * (only emoji, say), else null, and the tile shows an icon.
 */
export function getProjectInitials(project: ProjectAvatarSource): string | null {
	return (
		initialsOf(project.name) ??
		initialsOf(project.slug ?? '') ??
		initialsOf(subdomainOf(project.public_url) ?? '')
	);
}

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * FNV-1a, 32 bit, over the UTF-8 bytes. Short, stable across browsers, and spreads ids that differ
 * in one character; it is for picking a colour, not for anything that needs to be secure.
 */
export function fnv1a32(value: string): number {
	let hash = FNV_OFFSET_BASIS;
	for (const byte of new TextEncoder().encode(value)) {
		hash = Math.imul(hash ^ byte, FNV_PRIME) >>> 0;
	}
	return hash;
}

/** From the id, not the name, so a renamed project keeps its colour. */
export function getProjectAvatarTone(projectId: string): ProjectAvatarTone {
	return PROJECT_AVATAR_TONES[fnv1a32(projectId) % PROJECT_AVATAR_TONES.length];
}

/** The thumbnail to show, or null when the API sends none. */
export function getProjectThumbnailUrl(project: ProjectAvatarSource): string | null {
	return project.thumbnail_url?.trim() || null;
}
