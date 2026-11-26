import { SvelteSet } from 'svelte/reactivity';
import { useCurrentUser } from '$lib/features/auth/queries';
import { readDismissedSteps, writeDismissedSteps, type DismissalStorage } from './next-steps';

function browserStorage(): DismissalStorage | null {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage;
	} catch {
		return null;
	}
}

/**
 * The suggestions this person hid for one project, remembered in `localStorage` under their user id
 * and the project id. The overview's "Langkah berikutnya" and the settings pages' "Berikutnya" share
 * it: one choice, wherever it was made.
 */
export function useDismissedSteps(projectId: () => string) {
	const user = useCurrentUser();
	const owner = () => user.data?.id;
	const dismissed = new SvelteSet<string>();

	// The layout stays mounted across projects, and the user arrives after the first render, so the
	// set follows both.
	$effect.pre(() => {
		const stored = readDismissedSteps(browserStorage(), projectId(), owner());
		dismissed.clear();
		for (const id of stored) dismissed.add(id);
	});

	return {
		get ids(): ReadonlySet<string> {
			return dismissed;
		},
		dismiss(id: string) {
			dismissed.add(id);
			writeDismissedSteps(browserStorage(), projectId(), dismissed, owner());
		},
		/** Brings back every hidden suggestion of this project. */
		restore() {
			dismissed.clear();
			writeDismissedSteps(browserStorage(), projectId(), dismissed, owner());
		}
	};
}
