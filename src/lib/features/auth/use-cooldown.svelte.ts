/** A countdown in whole seconds that stops by itself and when the component goes away. */
export function useCooldown() {
	let remaining = $state(0);
	let timer: ReturnType<typeof setInterval> | undefined;

	function stop() {
		clearInterval(timer);
		timer = undefined;
	}

	function start(seconds: number) {
		stop();
		remaining = seconds;
		timer = setInterval(() => {
			remaining -= 1;
			if (remaining <= 0) stop();
		}, 1000);
	}

	$effect(() => stop);

	return {
		get remaining() {
			return remaining;
		},
		start
	};
}
