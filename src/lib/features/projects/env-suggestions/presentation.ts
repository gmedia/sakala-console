import {
	SUGGESTION_GROUPS,
	type EnvSuggestionGroup,
	type ExampleNote,
	type NeedsInputSuggestion,
	type PlatformSource
} from './classify-env-example';

/** One name per group, the same in the wizard and on the Variabel tab. */
export const SUGGESTION_GROUP_LABELS: Record<EnvSuggestionGroup, string> = {
	[SUGGESTION_GROUPS.needsInput]: 'Perlu kamu isi',
	[SUGGESTION_GROUPS.generated]: 'Dibuatkan Sakala',
	[SUGGESTION_GROUPS.example]: 'Dari .env.example',
	[SUGGESTION_GROUPS.platform]: 'Diisi Sakala'
};

/** What each group means, shown once under its title. */
export const SUGGESTION_GROUP_DESCRIPTIONS: Record<EnvSuggestionGroup, string> = {
	[SUGGESTION_GROUPS.needsInput]:
		'Namanya seperti kredensial, jadi nilainya harus dari kamu. Disimpan sebagai secret. Kosongkan kalau belum perlu, deploy tetap jalan.',
	[SUGGESTION_GROUPS.generated]:
		'Kunci acak yang dibuat di browser ini, disimpan sebagai secret. Nilainya tersembunyi sampai kamu memintanya.',
	[SUGGESTION_GROUPS.example]:
		'Nilai dari file contoh di repository. Ubah yang perlu; baris kosong tidak disimpan.',
	[SUGGESTION_GROUPS.platform]:
		'Tidak perlu ditulis: Sakala memberikannya ke setiap deployment, jadi tidak disimpan sebagai variabel.'
};

export const SUGGESTION_COPY = {
	sectionTitle: 'Environment variable',
	tabAction: 'Isi dari .env.example',
	tabTitle: 'Isi dari .env.example',
	tabDescription: (file: string) =>
		`Saran dari ${file} di repository. Pilih yang dipakai; yang sudah ada di proyek mengikuti pilihan di bawah.`,
	include: (key: string) => `Pakai ${key}`,
	valueLabel: (key: string) => `Nilai ${key}`,
	show: (key: string) => `Tampilkan nilai ${key}`,
	hide: (key: string) => `Sembunyikan nilai ${key}`,
	emptyHint: 'Kosongkan kalau belum perlu.',
	truncated: 'File contohnya panjang, jadi hanya 200 variabel pertama yang dibaca.'
} as const;

const PLATFORM_TEXT: Record<PlatformSource, string> = {
	port: 'Sakala mengisi PORT dengan port proyek.',
	database: 'Diisi dari database proyek saat deploy.'
};

export function platformText(source: PlatformSource): string {
	return PLATFORM_TEXT[source];
}

/** The hint under a row whose value is not the file's own. */
export function exampleNoteText(note: ExampleNote): string {
	switch (note.kind) {
		case 'production-override':
			return note.from
				? `Diubah dari ${note.from} untuk production.`
				: 'Disarankan untuk production.';
		case 'project-url':
			return 'Alamat proyek ini.';
		case 'database-url-override':
			return 'Laravel membaca DB_URL sebelum DB_HOST, jadi nilai ini akan menimpa koneksi database dari Sakala. Biarkan mati kecuali kamu memang butuh.';
		case 'variable-reference':
			return `Nilai contohnya merujuk ke ${note.reference}, dan Sakala tidak mengisi rujukan. Tulis nilainya sendiri kalau perlu.`;
	}
}

/** "Contoh: smtp.mailgun.org. Kosongkan kalau belum perlu." */
export function needsInputHint(row: Pick<NeedsInputSuggestion, 'hint'>): string {
	return row.hint ? `Contoh: ${row.hint}. ${SUGGESTION_COPY.emptyHint}` : SUGGESTION_COPY.emptyHint;
}

export function alreadySetText(keys: readonly string[]): string | null {
	return keys.length > 0 ? `Sudah ada di proyek, tidak diubah: ${keys.join(', ')}.` : null;
}

const countFormat = new Intl.NumberFormat('id-ID');

/** "Dibuatkan Sakala (2): APP_KEY, SESSION_SECRET", the summary of a collapsed group. */
export function groupSummary(group: EnvSuggestionGroup, keys: readonly string[]): string {
	return `${SUGGESTION_GROUP_LABELS[group]} (${countFormat.format(keys.length)})`;
}

/**
 * The first sentence of the Persiapan phase: what Sakala already did, then how many things are
 * left for the user (Tesler's Law: the system carries the rest).
 */
export function prepareLead({
	repository,
	prepared,
	needsYou,
	databaseDecision
}: {
	repository: string;
	/** Variables Sakala prepared: generated, example, and platform rows. */
	prepared: number;
	/** "Perlu kamu isi" rows. */
	needsYou: number;
	/** The database question is open. */
	databaseDecision: boolean;
}): string {
	const done =
		prepared > 0
			? `Sakala sudah membaca ${repository} dan menyiapkan ${countFormat.format(prepared)} variabel.`
			: `Sakala sudah membaca ${repository}.`;
	const asks: string[] = [];
	if (databaseDecision) asks.push('pilihan database');
	if (needsYou > 0) asks.push(`${countFormat.format(needsYou)} variabel yang perlu kamu isi`);
	if (asks.length === 0) return `${done} Periksa sebentar, lalu deploy.`;
	return `${done} Tinggal ${new Intl.ListFormat('id', { type: 'conjunction' }).format(asks)}.`;
}
