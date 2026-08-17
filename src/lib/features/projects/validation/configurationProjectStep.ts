export function validateProjectName(value: string): string | null {
	if (value.trim() === '') return 'Nama proyek wajib diisi.';
	return null;
}

export function validateBranch(value: string): string | null {
	if (value.trim() === '') return 'Branch wajib diisi.';
	return null;
}

export function sanitizePortInput(value: string): string {
	return value.replace(/\D/g, '');
}

export function validatePort(value: string): string | null {
	const trimmed = value.trim();
	if (trimmed === '') return 'Port wajib diisi.';
	if (!/^\d+$/.test(value)) return 'Port hanya boleh berisi angka';

	const port = Number(value);
	if (port < 1 || port > 65535) return 'Port harus antara 1-65535.';

	return null;
}

export function validateBuildCommand(value: string): string | null {
	if (value.trim() === '') return 'Build command wajib diisi.';
	return null;
}

export interface ConfigureProjectStepErrors {
	projectName: string | null;
	branch: string | null;
	port: string | null;
	buildCommand: string | null;
}

export function validateConfigureProjectStep(input: {
	projectName: string;
	branch: string;
	port: string;
	buildCommand: string;
}): ConfigureProjectStepErrors {
	return {
		projectName: validateProjectName(input.projectName),
		branch: validateBranch(input.branch),
		port: validatePort(input.port),
		buildCommand: validateBuildCommand(input.buildCommand)
	};
}

export function isConfigureProjectStepValid(errors: ConfigureProjectStepErrors): boolean {
	return Object.values(errors).every((error) => error === null);
}
