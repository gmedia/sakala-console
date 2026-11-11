const isHidden = () => typeof document !== 'undefined' && document.hidden;

/** A burst of realtime events costs one request, and a background tab costs none until it is seen. */
export const COALESCE_DELAY_MS = 1_000;

export function createCoalescedTask(run: () => void | Promise<void>, delayMs = COALESCE_DELAY_MS) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	let waitingForVisible = false;

	function handleVisibility() {
		if (isHidden() || !waitingForVisible) return;
		waitingForVisible = false;
		document.removeEventListener('visibilitychange', handleVisibility);
		void run();
	}

	function fire() {
		timer = undefined;
		if (!isHidden()) {
			void run();
			return;
		}
		waitingForVisible = true;
		document.addEventListener('visibilitychange', handleVisibility);
	}

	return {
		request() {
			if (timer !== undefined || waitingForVisible) return;
			timer = setTimeout(fire, delayMs);
		},
		dispose() {
			clearTimeout(timer);
			timer = undefined;
			waitingForVisible = false;
			if (typeof document !== 'undefined') {
				document.removeEventListener('visibilitychange', handleVisibility);
			}
		}
	};
}
