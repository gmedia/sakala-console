import type EchoType from 'laravel-echo';
export type ConnectionStatus =
	| 'idle'
	| 'connecting'
	| 'connected'
	| 'disconnected'
	| 'unavailable'
	| 'failed';
export const realtimeState = $state<{ status: ConnectionStatus }>({ status: 'idle' });

const PUSHER_STATE_MAP: Record<string, ConnectionStatus> = {
	initialized: 'idle',
	connecting: 'connecting',
	connected: 'connected',
	unavailable: 'unavailable',
	failed: 'failed',
	disconnected: 'disconnected'
};

export function mapPusherState(current: string): ConnectionStatus {
	return PUSHER_STATE_MAP[current] ?? 'unavailable';
}

export function bindConnectionState(echo: EchoType<'reverb'>): void {
	realtimeState.status = 'connecting';
	echo.connector.pusher.connection.bind('state_change', (states: { current: string }) => {
		realtimeState.status = mapPusherState(states.current);
	});
}

export function resetConnectionState(): void {
	realtimeState.status = 'idle';
}
