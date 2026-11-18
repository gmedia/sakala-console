import { SvelteSet } from 'svelte/reactivity';
import { readDismissedSteps, writeDismissedSteps, type DismissalStorage } from './next-steps';

function browserStorage(): DismissalStorage | null {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage;
	} catch {
		return null;
	}
}

/** The suggestions this browser hid for one project, remembered in `localStorage`. */
export function useDismissedSteps(projectId: () => string) {
	const dismissed = new SvelteSet<string>();

	// The layout stays mounted across projects, so the set follows the project in view.
	$effect.pre(() => {
		const stored = readDismissedSteps(browserStorage(), projectId());
		dismissed.clear();
		for (const id of stored) dismissed.add(id);
	});

	return {
		get ids(): ReadonlySet<string> {
			return dismissed;
		},
		dismiss(id: string) {
			dismissed.add(id);
			writeDismissedSteps(browserStorage(), projectId(), dismissed);
		}
	};
}
