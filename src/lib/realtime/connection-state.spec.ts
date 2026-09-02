import { describe, it, expect, beforeEach } from 'vitest';
import {
	realtimeState,
	mapPusherState,
	bindConnectionState,
	resetConnectionState
} from './connection-state.svelte';
import type EchoType from 'laravel-echo';

describe('mapPusherState', () => {
	it.each([
		['initialized', 'idle'],
		['connecting', 'connecting'],
		['connected', 'connected'],
		['unavailable', 'unavailable'],
		['failed', 'unavailable'],
		['disconnected', 'disconnected'],
		['state-tak-dikenal', 'unavailable']
	] as const)('mapPusherState("%s") should return "%s"', (input, expected) => {
		expect(mapPusherState(input)).toBe(expected);
	});
});

describe('bindConnectionState & resetConnectionState', () => {
	beforeEach(() => {
		resetConnectionState();
	});

	function createMockEcho() {
		let boundCallback: ((states: { current: string }) => void) | undefined;
		const echo = {
			connector: {
				pusher: {
					connection: {
						bind: (event: string, callback: (states: { current: string }) => void) => {
							if (event === 'state_change') boundCallback = callback;
						}
					}
				}
			}
		} as unknown as EchoType<'reverb'>;
		return { echo, emit: (current: string) => boundCallback?.({ current }) };
	}

	it('set status to connecting on bindConnectionState', () => {
		const { echo } = createMockEcho();
		bindConnectionState(echo);
		expect(realtimeState.status).toBe('connecting');
	});

	it('updates status based on emitted events', () => {
		const { echo, emit } = createMockEcho();
		bindConnectionState(echo);

		emit('connected');
		expect(realtimeState.status).toBe('connected');

		emit('failed');
		expect(realtimeState.status).toBe('unavailable');
	});

	it('resetConnectionState resets status to "idle"', () => {
		const { echo, emit } = createMockEcho();
		bindConnectionState(echo);
		emit('connected');

		resetConnectionState();

		expect(realtimeState.status).toBe('idle');
	});
});
