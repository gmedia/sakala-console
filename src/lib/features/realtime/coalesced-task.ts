const isHidden = () => typeof document !== 'undefined' && document.hidden;

/** A burst of realtime events costs one request, and a background tab costs none until it is seen. */
export const COALESCE_DELAY_MS = 1_000;

export type CoalescedRequestOptions = {
	/**
	 * Runs even while the tab is in the background. For the read after a deployment ends: the
	 * broadcast only carries the status, so until that read the page shows a failure without its
	 * cause and a deployment that still seems to run. It happens once per deployment.
	 */
	evenIfHidden?: boolean;
};

export function createCoalescedTask(run: () => void | Promise<void>, delayMs = COALESCE_DELAY_MS) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	let waitingForVisible = false;
	let runWhileHidden = false;

	function stopWaitingForVisible() {
		waitingForVisible = false;
		if (typeof document !== 'undefined') {
			document.removeEventListener('visibilitychange', handleVisibility);
		}
	}

	function handleVisibility() {
		if (isHidden() || !waitingForVisible) return;
		stopWaitingForVisible();
		void run();
	}

	function fire() {
		timer = undefined;
		const evenIfHidden = runWhileHidden;
		runWhileHidden = false;
		if (evenIfHidden || !isHidden()) {
			void run();
			return;
		}
		waitingForVisible = true;
		document.addEventListener('visibilitychange', handleVisibility);
	}

	return {
		request({ evenIfHidden = false }: CoalescedRequestOptions = {}) {
			if (evenIfHidden) {
				runWhileHidden = true;
				// What was waiting for the tab to be seen joins this run instead.
				if (waitingForVisible) stopWaitingForVisible();
			}
			if (timer !== undefined || waitingForVisible) return;
			timer = setTimeout(fire, delayMs);
		},
		dispose() {
			clearTimeout(timer);
			timer = undefined;
			runWhileHidden = false;
			stopWaitingForVisible();
		}
	};
}
