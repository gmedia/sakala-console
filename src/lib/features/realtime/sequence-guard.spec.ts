import { describe, it, expect } from 'vitest';
import { SequenceGuard } from './sequence-guard';

describe('SequenceGuard', () => {
	it('should accept a higher sequence number than initial (default 0)', () => {
		const guard = new SequenceGuard();
		expect(guard.accept(1)).toBe(true);
		expect(guard.getSequence()).toBe(1);
	});

	it('should reject a same sequence number', () => {
		const guard = new SequenceGuard();
		guard.accept(5);
		expect(guard.accept(5)).toBe(false);
		expect(guard.getSequence()).toBe(5);
	});

	it('should reject a lower sequence number (out of order / duplicate)', () => {
		const guard = new SequenceGuard();
		guard.accept(10);
		expect(guard.accept(3)).toBe(false);
		expect(guard.getSequence()).toBe(10);
	});

	it('accept increasing sequence', () => {
		const guard = new SequenceGuard();
		expect(guard.accept(1)).toBe(true);
		expect(guard.accept(2)).toBe(true);
		expect(guard.accept(3)).toBe(true);
		expect(guard.getSequence()).toBe(3);
	});

	it('can seed with initial sequence', () => {
		const guard = new SequenceGuard(100);
		expect(guard.accept(100)).toBe(false);
		expect(guard.accept(101)).toBe(true);
	});

	it('reset() should reset the sequence to default 0', () => {
		const guard = new SequenceGuard();
		guard.accept(50);
		guard.reset();
		expect(guard.getSequence()).toBe(0);
		expect(guard.accept(10)).toBe(true);
	});

	it('reset(n) should return sequence to n', () => {
		const guard = new SequenceGuard();
		guard.accept(50);
		guard.reset(20);
		expect(guard.getSequence()).toBe(20);
		expect(guard.accept(15)).toBe(false);
		expect(guard.accept(21)).toBe(true);
	});
});
