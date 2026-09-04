import { describe, it, expect, beforeEach } from 'vitest';
import {
	retainChannel,
	releaseChannel,
	__resetChannelRegistryForTesting
} from './channel-registry';

describe('channel-registry', () => {
	beforeEach(() => {
		__resetChannelRegistryForTesting();
	});

	it('release after one retained becomes the last subscriber (true)', async () => {
		retainChannel('deployment.1');
		expect(releaseChannel('deployment.1')).toBe(true);
	});

	it('do not release the last subscriber as long as there are other retained subscribers that have not yet been released.', async () => {
		retainChannel('deployment.1');
		retainChannel('deployment.1');

		expect(releaseChannel('deployment.1')).toBe(false);
		expect(releaseChannel('deployment.1')).toBe(true);
	});

	it('3 retains need 3 releases before become last subscriber', async () => {
		retainChannel('deployment.1');
		retainChannel('deployment.1');
		retainChannel('deployment.1');

		expect(releaseChannel('deployment.1')).toBe(false);
		expect(releaseChannel('deployment.1')).toBe(false);
		expect(releaseChannel('deployment.1')).toBe(true);
	});

	it('channel name different have counts independent', async () => {
		retainChannel('deployment.1');
		retainChannel('deployment.1');
		retainChannel('deployment.2');

		expect(releaseChannel('deployment.2')).toBe(true);
		expect(releaseChannel('deployment.1')).toBe(false);
		expect(releaseChannel('deployment.1')).toBe(true);
	});

	it('release without a prior retain is still safe, return true', async () => {
		expect(releaseChannel('deployment.never-retained')).toBe(true);
	});

	it('release exceeding the retain (over-release) does not throw an exception, it remains consistent.', async () => {
		retainChannel('deployment.1');

		expect(releaseChannel('deployment.1')).toBe(true);
		expect(releaseChannel('deployment.1')).toBe(true);
	});

	it('__resetChannelRegistryForTesting() resets all channel, not just the specified one', async () => {
		retainChannel('deployment.1');
		retainChannel('deployment.1');
		retainChannel('deployment.2');

		__resetChannelRegistryForTesting();

		expect(releaseChannel('deployment.1')).toBe(true);
		expect(releaseChannel('deployment.2')).toBe(true);
	});
});
