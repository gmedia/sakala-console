import { ApiError, DATABASE_ERROR_CODES, getErrorMessage, getFieldError } from '$lib/api/errors';
import { parseDatabaseRefusal } from '$lib/api/resources/database-refusals';
import { databaseErrorMessage } from '$lib/features/databases/presentation';
import { DATABASE_OPTIONS } from './database-choice';
import {
	FIRST_DEPLOY_STEPS,
	type FirstDeployDatabase,
	type FirstDeployStep
} from './run-first-deploy';

export type FirstDeployFailure = {
	message: string;
	/** Deploying without a database gets the app live; offered when the database is the obstacle. */
	offerWithoutDatabase: boolean;
};

/** Refusals that stay true however often the user retries, so going on without one is the way out. */
const DATABASE_DEAD_ENDS: readonly string[] = [
	DATABASE_ERROR_CODES.unavailable,
	DATABASE_ERROR_CODES.limitExceeded,
	DATABASE_ERROR_CODES.storageLimitExceeded,
	DATABASE_ERROR_CODES.regionUnavailable,
	DATABASE_ERROR_CODES.crossRegionUnsupported
];

export const FIRST_DEPLOY_ERROR_COPY = {
	releaseCommand:
		'Release command belum tersimpan, jadi deploy belum dimulai. Tekan Deploy sekarang sekali lagi.',
	createDatabase:
		'Database belum bisa dibuat, jadi deploy belum dimulai. Tekan Deploy sekarang sekali lagi, atau pilih Tanpa database.',
	attachDatabase:
		'Database belum bisa dipasang ke proyek ini, jadi deploy belum dimulai. Tekan Deploy sekarang sekali lagi, atau pilih Tanpa database.',
	unavailable:
		'Server database Sakala sedang tidak bisa menerima database baru. Deploy tanpa database dulu, lalu pasang database dari halaman Database nanti.',
	deploy: 'Deploy belum berhasil dijalankan. Tekan Deploy sekarang sekali lagi.',
	variables:
		'Variabel belum tersimpan, jadi deploy belum dimulai. Tekan Deploy sekarang sekali lagi.',
	databaseNotReady: (status: string) =>
		`Database proyek ini belum siap (status ${status}), jadi deploy belum bisa dimulai. Tunggu sampai siap, atau lepas database-nya dari halaman Database.`
} as const;

function databaseStepFailure(error: unknown, database: FirstDeployDatabase): FirstDeployFailure {
	const creating = database.kind === DATABASE_OPTIONS.create;
	const code = error instanceof ApiError ? error.code : undefined;
	if (code === DATABASE_ERROR_CODES.unavailable) {
		return { message: FIRST_DEPLOY_ERROR_COPY.unavailable, offerWithoutDatabase: true };
	}
	const message = databaseErrorMessage(
		error,
		creating ? 'create' : 'attach',
		creating ? FIRST_DEPLOY_ERROR_COPY.createDatabase : FIRST_DEPLOY_ERROR_COPY.attachDatabase
	);
	return { message, offerWithoutDatabase: code !== undefined && DATABASE_DEAD_ENDS.includes(code) };
}

function deployStepFailure(error: unknown): FirstDeployFailure {
	if (error instanceof ApiError && error.code === DATABASE_ERROR_CODES.notReady) {
		const details = parseDatabaseRefusal('DATABASE_NOT_READY', error.details);
		return {
			message: details
				? FIRST_DEPLOY_ERROR_COPY.databaseNotReady(details.status)
				: getErrorMessage(error, FIRST_DEPLOY_ERROR_COPY.deploy),
			offerWithoutDatabase: false
		};
	}
	return {
		message: getErrorMessage(error, FIRST_DEPLOY_ERROR_COPY.deploy),
		offerWithoutDatabase: false
	};
}

/** What to say when a step of "Deploy sekarang" was refused, from the API's `code`. */
export function firstDeployFailure(
	step: FirstDeployStep,
	error: unknown,
	database: FirstDeployDatabase
): FirstDeployFailure {
	switch (step) {
		case FIRST_DEPLOY_STEPS.releaseCommand:
			return {
				message:
					getFieldError(error, 'release_command') ??
					getErrorMessage(error, FIRST_DEPLOY_ERROR_COPY.releaseCommand),
				offerWithoutDatabase: false
			};
		case FIRST_DEPLOY_STEPS.database:
			return databaseStepFailure(error, database);
		case FIRST_DEPLOY_STEPS.variables:
			return {
				message: getErrorMessage(error, FIRST_DEPLOY_ERROR_COPY.variables),
				offerWithoutDatabase: false
			};
		case FIRST_DEPLOY_STEPS.deploy:
			return deployStepFailure(error);
	}
}

/** The project has a database already: a lost response to an earlier create, or another tab. */
export function isAlreadyAttached(error: unknown): boolean {
	return error instanceof ApiError && error.code === DATABASE_ERROR_CODES.projectAlreadyAttached;
}
