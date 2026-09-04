const refCounts = new Map<string, number>();

export function retainChannel(name: string): void {
	refCounts.set(name, (refCounts.get(name) ?? 0) + 1);
}

export function releaseChannel(name: string): boolean {
	const count = refCounts.get(name) ?? 0;
	if (count <= 1) {
		refCounts.delete(name);
		return true;
	}
	refCounts.set(name, count - 1);
	return false;
}

export function __resetChannelRegistryForTesting(): void {
	refCounts.clear();
}
