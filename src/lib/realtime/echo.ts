import { browser } from '$app/environment';
import { getRealtimeEnv } from './env';
import { bindConnectionState, resetConnectionState } from './connection-state.svelte';
import { authorizeChannel, type ChannelAuthorization } from '$lib/api/resources/broadcasting';
import type EchoType from 'laravel-echo';

let echoInstance: EchoType<'reverb'> | null = null;
let initPromise: Promise<EchoType<'reverb'> | null> | null = null;

export async function getEcho(): Promise<EchoType<'reverb'> | null> {
	if (!browser) return null;
	if (echoInstance) return echoInstance;
	if (!initPromise) {
		initPromise = initEcho();
	}
	echoInstance = await initPromise;
	return echoInstance;
}

async function initEcho(): Promise<EchoType<'reverb'> | null> {
	const env = getRealtimeEnv();
	if (!env) {
		console.warn('Env reverb tidak lengkap. Realtime dinonaktifkan.');
		return null;
	}

	try {
		const [{ default: Echo }, { default: Pusher }] = await Promise.all([
			import('laravel-echo'),
			import('pusher-js')
		]);

		(window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher;

		const instance = new Echo({
			broadcaster: 'reverb',
			key: env.key,
			wsHost: env.host,
			wsPort: env.port,
			wssPort: env.port,
			forceTLS: env.scheme === 'https',
			enabledTransports: ['ws', 'wss'],
			authorizer: (channel: { name: string }) => ({
				authorize(
					socketId: string,
					callback: (error: Error | null, data: ChannelAuthorization | null) => void
				) {
					authorizeChannel(channel.name, socketId).then(
						(data) => callback(null, data as ChannelAuthorization),
						(error) => callback(error instanceof Error ? error : new Error(String(error)), null)
					);
				}
			})
		});
		bindConnectionState(instance);
		return instance;
	} catch (error) {
		console.warn('Gagal inisialisasi Echo: ', error);
		initPromise = null;
		return null;
	}
}

export async function disconnectEcho(): Promise<void> {
	if (echoInstance) {
		echoInstance.disconnect();
		echoInstance = null;
		initPromise = null;
		resetConnectionState();
	}
}
