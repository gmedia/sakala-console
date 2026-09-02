import { getEcho } from '$lib/realtime/echo';

export function usePrivateChannel(
	channelName: string | (() => string | null),
	events: Record<string, (payload: unknown) => void>
) {
	$effect(() => {
		const rawName = typeof channelName === 'function' ? channelName() : channelName;
		if (!rawName) return;

		const validName: string = rawName;
		let subscribedEcho: Awaited<ReturnType<typeof getEcho>> = null;
		let cancelled = false;

		async function subscribe() {
			const echo = await getEcho();
			if (!echo || cancelled) return;

			const channel = echo.private(validName);

			Object.entries(events).forEach(([eventName, callback]) => {
				channel.listen(eventName, callback);
			});

			subscribedEcho = echo;
		}

		subscribe();

		return () => {
			cancelled = true;
			subscribedEcho?.leave(validName);
		};
	});
}
