/**
 * What every attached project receives on its next deployment (BucketConnectionEnvironment in
 * sakala-api), in the order the API documents them. Kept free of imports, so code that only needs
 * the names does not pull in the HTTP client. `AWS_ENDPOINT_URL` is left out on purpose: current AWS
 * SDKs read it for every service, so an app's own SES or SQS calls would reach Sakala's endpoint.
 */
export const BUCKET_VARIABLES = [
	'AWS_ENDPOINT_URL_S3',
	'AWS_ENDPOINT',
	'AWS_USE_PATH_STYLE_ENDPOINT',
	'AWS_DEFAULT_REGION',
	'AWS_REGION',
	'AWS_BUCKET',
	'AWS_ACCESS_KEY_ID',
	'AWS_SECRET_ACCESS_KEY'
] as const;

/** The key pair: overriding one of these mixes the app's own AWS key with Sakala's bucket. */
export const BUCKET_KEY_VARIABLES: readonly string[] = [
	'AWS_ACCESS_KEY_ID',
	'AWS_SECRET_ACCESS_KEY'
];

/** The one variable whose value is secret; the Console never shows it to members. */
export const BUCKET_SECRET_VARIABLE = 'AWS_SECRET_ACCESS_KEY';

/**
 * Laravel's default disk. Suggested by the Console, never injected: switching it on attach would
 * silently move files the app meant to keep local.
 */
export const LARAVEL_FILESYSTEM_DISK = { key: 'FILESYSTEM_DISK', value: 's3' } as const;
