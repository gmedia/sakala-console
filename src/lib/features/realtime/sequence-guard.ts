export class SequenceGuard {
	private currentSequence: number;

	constructor(initialSequence: number = 0) {
		this.currentSequence = initialSequence;
	}

	public accept(payloadSequence: number): boolean {
		if (payloadSequence > this.currentSequence) {
			this.currentSequence = payloadSequence;
			return true;
		}
		return false;
	}

	public getSequence(): number {
		return this.currentSequence;
	}

	public reset(sequence: number = 0): void {
		this.currentSequence = sequence;
	}
}
