import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCoalescedTask } from './coalesced-task';

describe('createCoalescedTask', () => {
	let hidden: boolean;

	beforeEach(() => {
		hidden = false;
		vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('turns a burst into one run', () => {
		const run = vi.fn();
		const task = createCoalescedTask(run, 1_000);

		task.request();
		task.request();
		vi.advanceTimersByTime(500);
		task.request();
		vi.advanceTimersByTime(500);

		expect(run).toHaveBeenCalledOnce();
		task.dispose();
	});

	it('runs again for a request after the first one finished', () => {
		const run = vi.fn();
		const task = createCoalescedTask(run, 1_000);

		task.request();
		vi.advanceTimersByTime(1_000);
		task.request();
		vi.advanceTimersByTime(1_000);

		expect(run).toHaveBeenCalledTimes(2);
		task.dispose();
	});

	it('waits for a background tab to be seen, then runs once', () => {
		const run = vi.fn();
		const task = createCoalescedTask(run, 1_000);
		hidden = true;

		task.request();
		vi.advanceTimersByTime(60_000);
		task.request();
		expect(run).not.toHaveBeenCalled();

		hidden = false;
		document.dispatchEvent(new Event('visibilitychange'));

		expect(run).toHaveBeenCalledOnce();
		task.dispose();
	});

	it('does nothing after dispose', () => {
		const run = vi.fn();
		const task = createCoalescedTask(run, 1_000);

		task.request();
		task.dispose();
		vi.advanceTimersByTime(5_000);

		expect(run).not.toHaveBeenCalled();
	});
});
