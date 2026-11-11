import { z } from 'zod';
import { ApiError, getErrorMessage, getFieldError } from '$lib/api/errors';

export const createProjectFormSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, 'Nama proyek wajib diisi')
		.max(120, 'Nama proyek maksimal 120 karakter'),
	branch: z
		.string()
		.trim()
		.min(1, 'Branch wajib dipilih')
		.max(255, 'Nama branch maksimal 255 karakter'),
	repository: z.discriminatedUnion('type', [
		z.object({
			type: z.literal('github_installation'),
			installation_id: z.string().min(1, 'GitHub installation ID wajib diisi'),
			repository_id: z.number().int().positive('Repository GitHub harus dipilih')
		}),
		z.object({
			type: z.literal('public_url'),
			url: z
				.string()
				.trim()
				.min(1, 'URL repository wajib diisi')
				.url('Format URL tidak valid')
				.regex(
					/^https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(\.git)?$/,
					'URL harus berupa repository GitHub publik (contoh: https://github.com/user/repo)'
				)
		})
	])
});

export type CreateProjectFormData = z.infer<typeof createProjectFormSchema>;

// Mirrors ValidatesBuildConfiguration in sakala-api, which stays the final check.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTER = /[\x00-\x1F\x7F]/;
const ROOT_DIRECTORY = /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;
const DOT_SEGMENT = /(?:^|\/)\.{1,2}(?:\/|$)/;
const COMMAND_MAX_LENGTH = 1000;
const ROOT_DIRECTORY_MAX_LENGTH = 255;
export const PORT_MIN = 1;
export const PORT_MAX = 65535;

function commandSchema(label: string) {
	return z
		.string()
		.trim()
		.max(COMMAND_MAX_LENGTH, `${label} paling panjang ${COMMAND_MAX_LENGTH} karakter.`)
		.refine((value) => !CONTROL_CHARACTER.test(value), {
			message: `${label} harus satu baris. Gabungkan beberapa langkah dengan &&, atau pindahkan ke script di repository.`
		})
		.transform((value) => value || null);
}

/** Empty means "not set", which the API stores as null. */
export const buildConfigurationSchema = z.object({
	configured_port: z
		.string()
		.trim()
		.refine(
			(value) =>
				value === '' ||
				(/^\d+$/.test(value) && Number(value) >= PORT_MIN && Number(value) <= PORT_MAX),
			{
				message: `Isi port dengan angka ${PORT_MIN} sampai ${PORT_MAX}, misalnya 8080. Kosongkan untuk memakai port bawaan.`
			}
		)
		.transform((value) => (value === '' ? null : Number(value))),
	build_command: commandSchema('Build command'),
	start_command: commandSchema('Start command'),
	root_directory: z
		.string()
		.trim()
		.max(
			ROOT_DIRECTORY_MAX_LENGTH,
			`Root directory paling panjang ${ROOT_DIRECTORY_MAX_LENGTH} karakter.`
		)
		.refine((value) => value === '' || !DOT_SEGMENT.test(value), {
			message:
				'Root directory tidak boleh memakai . atau .. karena harus tetap di dalam repository. Tulis path-nya langsung, misalnya apps/web.'
		})
		.refine((value) => value === '' || ROOT_DIRECTORY.test(value), {
			message:
				'Root directory harus berupa path relatif di dalam repository, misalnya apps/web, tanpa / di awal atau di akhir.'
		})
		.transform((value) => value || null)
});

export type BuildConfigurationInput = z.input<typeof buildConfigurationSchema>;
export type BuildConfiguration = z.output<typeof buildConfigurationSchema>;

export type CreateProjectFieldErrors = {
	name?: string;
	branch?: string;
	repository?: string;
	configured_port?: string;
	build_command?: string;
	start_command?: string;
	root_directory?: string;
	general?: string;
};

const CONFIGURATION_FIELDS = [
	'name',
	'branch',
	'configured_port',
	'build_command',
	'start_command',
	'root_directory'
] as const;

const REPOSITORY_FIELDS = [
	'repository.url',
	'repository.installation_id',
	'repository.repository_id',
	'repository',
	'repository.type'
];

const INACTIVE_INSTALLATION_MESSAGE =
	'Instalasi GitHub untuk repository ini sudah tidak aktif. Kembali ke langkah Repository untuk menghubungkannya ulang.';

export function mapCreateProjectErrors(error: unknown): CreateProjectFieldErrors {
	if (error instanceof ApiError && error.isValidationError) {
		const fieldErrors: CreateProjectFieldErrors = {};

		for (const field of CONFIGURATION_FIELDS) {
			const message = getFieldError(error, field);
			if (message) fieldErrors[field] = message;
		}

		for (const field of REPOSITORY_FIELDS) {
			const message = getFieldError(error, field);
			if (message) {
				fieldErrors.repository = message;
				break;
			}
		}

		if (Object.keys(fieldErrors).length === 0 && error.message) {
			fieldErrors.general = error.message;
		}

		return fieldErrors;
	}

	// The API words this 409 in English, and it has a next step the message should name.
	if (error instanceof ApiError && error.status === 409 && !error.code) {
		return { general: INACTIVE_INSTALLATION_MESSAGE };
	}

	return { general: getErrorMessage(error, 'Proyek belum berhasil dibuat. Silakan coba lagi.') };
}
