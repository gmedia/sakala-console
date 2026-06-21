export type ApiEnvelope<T> = {
	data: T;
};

export type ApiCollectionEnvelope<T> = ApiEnvelope<T[]> & {
	links?: Record<string, string | null>;
	meta?: Record<string, unknown>;
};
