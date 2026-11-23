/**
 * The columns of a Riwayat row, shared by the header, deployment rows, and skipped pushes so they
 * line up. With row actions (someone who may deploy, and a deployment to go back to on the page) a
 * last column holds the menu. Whole class names, so Tailwind finds them.
 */
const COLUMNS = {
	plain:
		'grid-cols-[auto_minmax(0,1fr)] @3xl:grid-cols-[6.5rem_2.5rem_minmax(0,1fr)_4.5rem_5rem_6.5rem_6.5rem]',
	withActions:
		'grid-cols-[auto_minmax(0,1fr)_auto] @3xl:grid-cols-[6.5rem_2.5rem_minmax(0,1fr)_4.5rem_5rem_6.5rem_6.5rem_2.5rem]'
} as const;

/** The header has no phone layout: it only shows from 48rem of card. */
const HEADER_COLUMNS = {
	plain: '@3xl:grid-cols-[6.5rem_2.5rem_minmax(0,1fr)_4.5rem_5rem_6.5rem_6.5rem]',
	withActions: '@3xl:grid-cols-[6.5rem_2.5rem_minmax(0,1fr)_4.5rem_5rem_6.5rem_6.5rem_2.5rem]'
} as const;

export function historyRowColumns(withActions: boolean): string {
	return withActions ? COLUMNS.withActions : COLUMNS.plain;
}

export function historyHeaderColumns(withActions: boolean): string {
	return withActions ? HEADER_COLUMNS.withActions : HEADER_COLUMNS.plain;
}

/** The menu's cell: beside both lines of a phone row, last on a wide one. */
export const HISTORY_ACTION_CELL =
	'col-start-3 row-span-2 row-start-1 self-start @3xl:col-start-8 @3xl:row-span-1 @3xl:self-center';
