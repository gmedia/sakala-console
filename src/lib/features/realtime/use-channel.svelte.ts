import { getEcho } from '$lib/realtime/echo';
import { retainChannel, releaseChannel } from './channel-registry';

type EchoInstance = Awaited<ReturnType<typeof getEcho>>;
type PrivateChannel = ReturnType<NonNullable<EchoInstance>['private']>;

export function usePrivateChannel(
	channelName: string | (() => string | null),
	events: Record<string, (payload: unknown) => void>
) {
	$effect(() => {
		const rawName = typeof channelName === 'function' ? channelName() : channelName;
		if (!rawName) return;

		const validName: string = rawName;
		const boundEvents = Object.entries(events);
		let cancelled = false;
		let retained = false;
		let subscribedEcho: Awaited<ReturnType<typeof getEcho>> = null;
		let subscribedChannel: PrivateChannel | null = null;

		async function subscribe() {
			const echo = await getEcho();
			if (!echo || cancelled) return;

			const channel = echo.private(validName);
			const registeredEvents: [string, (payload: unknown) => void][] = [];

			try {
				for (const [eventName, callback] of boundEvents) {
					channel.listen(eventName, callback);
					registeredEvents.push([eventName, callback]);
				}

				if (cancelled) {
					for (const [eventName, callback] of boundEvents) {
						channel.stopListening(eventName, callback);
					}
					return;
				}

				subscribedEcho = echo;
				subscribedChannel = channel;

				retainChannel(validName);
				retained = true;
			} catch (error) {
				for (const [eventName, callback] of registeredEvents) {
					channel.stopListening(eventName, callback);
				}
				throw error;
			}
		}

		subscribe().catch((error) => {
			console.warn('Gagal subscribe ke channel', validName, error);
		});

		return () => {
			cancelled = true;
			if (!retained) return;

			if (subscribedChannel) {
				for (const [eventName, callback] of boundEvents) {
					subscribedChannel.stopListening(eventName, callback);
				}
			}

			const isLastSubscriber = releaseChannel(validName);
			if (isLastSubscriber) {
				subscribedEcho?.leave(validName);
			}
		};
	});
}
