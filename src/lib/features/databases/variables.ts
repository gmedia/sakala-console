/**
 * What every attached project receives on its next deployment (DatabaseConnectionEnvironment in
 * sakala-api), in the order the API documents them. Kept free of imports, so code that only needs
 * the names (the .env.example suggestions) does not pull in the HTTP client.
 */
export const DATABASE_VARIABLES = [
	'DATABASE_URL',
	'DB_CONNECTION',
	'DB_HOST',
	'DB_PORT',
	'DB_DATABASE',
	'DB_USERNAME',
	'DB_PASSWORD'
] as const;
