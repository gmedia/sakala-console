import { vi, describe, it, expect, beforeEach } from 'vitest';
import { usePrivateChannel } from './use-channel.svelte';
import { getEcho } from '$lib/realtime/echo';

vi.mock('$lib/realtime/echo', () => ({ getEcho: vi.fn() }));

const mockedGetEcho = vi.mocked(getEcho);
type EchoInstance = Awaited<ReturnType<typeof getEcho>>;

function createMockEcho(
	overrides: { private?: ReturnType<typeof vi.fn>; leave?: ReturnType<typeof vi.fn> } = {}
) {
	const privateFn = overrides.private ?? vi.fn(() => ({ listen: vi.fn() }));
	const leaveFn = overrides.leave ?? vi.fn();
	return {
		echo: { private: privateFn, leave: leaveFn } as unknown as EchoInstance,
		privateFn,
		leaveFn
	};
}

describe('usePrivateChannel', () => {
	beforeEach(() => {
		mockedGetEcho.mockReset();
	});

	it('subscribes to channel and listens when echo is available', async () => {
		const { echo, privateFn } = createMockEcho();
		mockedGetEcho.mockResolvedValue(echo);

		const handler = vi.fn();
		const dispose = $effect.root(() => {
			usePrivateChannel('deployment.1', { '.DeploymentUpdated': handler });
		});

		await vi.waitFor(() => expect(privateFn).toHaveBeenCalledWith('deployment.1'));
		dispose();
	});

	it('never subscribes when effect is disposed before echo is available', async () => {
		let resolveEcho!: (value: EchoInstance) => void;
		mockedGetEcho.mockReturnValue(
			new Promise<EchoInstance>((resolve) => {
				resolveEcho = resolve;
			})
		);

		const dispose = $effect.root(() => {
			usePrivateChannel('deployment.1', {});
		});

		dispose();

		const { echo, privateFn, leaveFn } = createMockEcho();
		resolveEcho(echo);
		await Promise.resolve();
		await Promise.resolve();

		expect(privateFn).not.toHaveBeenCalled();
		expect(leaveFn).not.toHaveBeenCalled();
	});

	it('does not call getEcho when channelName resolves to null', () => {
		const dispose = $effect.root(() => {
			usePrivateChannel(() => null, {});
		});

		expect(mockedGetEcho).not.toHaveBeenCalled();
		dispose();
	});

	it('leave old channel and subscribing to new channel when channel name changes', async () => {
		let currentId = $state('a');

		const { echo: echoA, privateFn: privateA, leaveFn: leaveA } = createMockEcho();
		const { echo: echoB, privateFn: privateB, leaveFn: leaveB } = createMockEcho();

		mockedGetEcho.mockImplementation(() => Promise.resolve(currentId === 'a' ? echoA : echoB));

		const dispose = $effect.root(() => {
			usePrivateChannel(() => `deployment.${currentId}`, {});
		});

		await vi.waitFor(() => expect(privateA).toHaveBeenCalledWith('deployment.a'));

		currentId = 'b';

		await vi.waitFor(() => expect(leaveA).toHaveBeenCalledWith('deployment.a'));
		await vi.waitFor(() => expect(privateB).toHaveBeenCalledWith('deployment.b'));

		dispose();
		expect(leaveB).toHaveBeenCalledWith('deployment.b');
	});

	it('calls listen for each event that is registered', async () => {
		const listen = vi.fn();
		const { echo, privateFn } = createMockEcho({ private: vi.fn(() => ({ listen })) });
		mockedGetEcho.mockResolvedValue(echo);

		const onUpdated = vi.fn();
		const onLogCreated = vi.fn();

		const dispose = $effect.root(() => {
			usePrivateChannel('deployment.1', {
				'.DeploymentUpdated': onUpdated,
				'.DeploymentLogCreated': onLogCreated
			});
		});

		await vi.waitFor(() => expect(listen).toHaveBeenCalledTimes(2));
		expect(listen).toHaveBeenCalledWith('.DeploymentUpdated', onUpdated);
		expect(listen).toHaveBeenCalledWith('.DeploymentLogCreated', onLogCreated);
		expect(privateFn).toHaveBeenCalledWith('deployment.1');

		dispose();
	});
});
