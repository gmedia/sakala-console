/**
 * Example apps for a first deploy (P-07). They live in one repository owned by the Sakala
 * organisation, one folder per app, and are deployed on every release so they keep working.
 * Picking one in the wizard fills in the public URL, the root directory, the release command, and
 * the variables listed here. Keep this list in step with the folders of that repository.
 */
export const STARTER_EXAMPLES_REPOSITORY = 'https://github.com/gmedia/sakala-examples';

/** How the wizard fills a variable the example needs before its first deploy. */
export type StarterExampleEnvValue =
	| { kind: 'fixed'; value: string }
	/** A fresh `base64:` key of 32 random bytes, what `php artisan key:generate` writes. */
	| { kind: 'laravel-app-key' };

export type StarterExampleEnv = {
	key: string;
	value: StarterExampleEnvValue;
	/** Shown on the configuration step, so the user knows why it is already there. */
	hint: string;
};

export type StarterExample = {
	id: string;
	label: string;
	description: string;
	repository: string;
	rootDirectory: string;
	releaseCommand: string | null;
	/** The project name, and so the address, the wizard suggests. */
	projectName: string;
	env: StarterExampleEnv[];
};

export const STARTER_EXAMPLES: readonly StarterExample[] = [
	{
		id: 'static-site',
		label: 'Situs HTML statis',
		description: 'HTML dan CSS, tanpa langkah build.',
		repository: STARTER_EXAMPLES_REPOSITORY,
		rootDirectory: 'static-site',
		releaseCommand: null,
		projectName: 'contoh-situs-statis',
		env: []
	},
	{
		id: 'node-express',
		label: 'Node.js dan Express',
		description: 'Server web kecil dengan npm.',
		repository: STARTER_EXAMPLES_REPOSITORY,
		rootDirectory: 'node-express',
		releaseCommand: null,
		projectName: 'contoh-node-express',
		env: []
	},
	{
		id: 'laravel',
		label: 'Laravel',
		description: 'Aplikasi PHP, APP_KEY dibuatkan otomatis.',
		repository: STARTER_EXAMPLES_REPOSITORY,
		rootDirectory: 'laravel',
		releaseCommand: null,
		projectName: 'contoh-laravel',
		env: [
			{
				key: 'APP_KEY',
				value: { kind: 'laravel-app-key' },
				hint: 'Laravel butuh APP_KEY untuk mengenkripsi session. Sakala sudah membuatkan kunci baru dan menyimpannya sebagai secret.'
			}
		]
	}
];

export function findStarterExample(id: string | null | undefined): StarterExample | undefined {
	return STARTER_EXAMPLES.find((example) => example.id === id);
}
