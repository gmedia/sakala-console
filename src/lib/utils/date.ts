export function formatDate(date: string): string {
	return new Date(date).toLocaleDateString('id-ID', {
		month: 'long',
		day: 'numeric',
		year: 'numeric'
	});
}
