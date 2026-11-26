import { tick } from 'svelte';
import { afterNavigate } from '$app/navigation';
import { page } from '$app/state';

/** The field an editor opens on: the checked option of a group, or its first field. */
export function focusEditorField(form: HTMLElement | null) {
	const field =
		form?.querySelector<HTMLInputElement>('input:checked:not(:disabled)') ??
		form?.querySelector<HTMLInputElement>('input:not(:disabled):not([type=hidden])');
	field?.focus();
	if (field?.type === 'text') field.select();
}

/**
 * Opens an inline editor from its anchor, which is where a panel step such as "Naikkan kuota"
 * links: on arriving with the anchor in the address, and on every click of a link to it (a second
 * click on the same hash changes no address). Focus goes into the editor once the router and the
 * browser are done moving it. Only while the person may edit; called during a component's setup.
 */
export function openAtAnchor(
	anchor: string,
	editorId: string,
	canEdit: () => boolean,
	open: () => void
) {
	let opened = false;
	const settle = () => {
		if (!opened) return;
		opened = false;
		document.getElementById(anchor)?.scrollIntoView({ block: 'center' });
		focusEditorField(document.getElementById(editorId));
	};
	const openNow = () => {
		if (!canEdit()) return;
		open();
		opened = true;
		// After a hash link the browser moves focus to the anchor, so the field takes it next frame.
		void tick().then(() => requestAnimationFrame(settle));
	};
	// Arriving from another page, the router resets focus once the navigation is done.
	afterNavigate(() => void tick().then(settle));

	/** Not state: only the arrival at the anchor matters, not every refetch afterwards. */
	let handled = '';
	$effect(() => {
		const target = page.url.hash.slice(1);
		if (target !== anchor) {
			handled = '';
			return;
		}
		// Waits for the role to load before it counts as handled.
		if (handled === target || !canEdit()) return;
		handled = target;
		openNow();
	});

	$effect(() => {
		const onclick = (event: MouseEvent) => {
			if (!(event.target instanceof Element)) return;
			if (event.target.closest(`a[href="#${anchor}"]`)) openNow();
		};
		document.addEventListener('click', onclick);
		return () => document.removeEventListener('click', onclick);
	});
}
