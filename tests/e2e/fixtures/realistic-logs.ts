import { failedDeployment, logPage, succeededDeployment, type LogLine } from './project-detail';

/**
 * What a Railpack build really writes: git and BuildKit report progress on stderr, npm warns on
 * stderr, and only the failing build has errors. Times line up with the stage events below.
 */
type Raw = [time: string, stream: LogLine['stream'], message: string];

const at = (time: string) => `2026-09-20T08:${time}.000000Z`;

const COMMON: Raw[] = [
	['41:02', 'system', 'Cloning https://github.com/raniw/toko-kopi-web (main)'],
	['41:03', 'stderr', "Cloning into '/workspace/source'..."],
	['41:05', 'stdout', 'Railpack 0.9.2'],
	['41:05', 'stdout', '↳ Detected Node'],
	['41:06', 'stdout', '↳ Using npm package manager'],
	['41:08', 'stderr', '#0 building with "default" instance using docker driver'],
	['41:08', 'stderr', '#1 [internal] load build definition from Dockerfile'],
	['41:09', 'stderr', '#5 [build 2/5] RUN npm ci'],
	[
		'41:12',
		'stderr',
		'#5 3.112 npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory.'
	],
	['41:18', 'stderr', '#5 9.870 added 312 packages, and audited 313 packages in 9s'],
	['41:19', 'stderr', '#6 [build 3/5] RUN npm run build'],
	['41:19', 'stderr', '#6 0.412 > toko-kopi-web@1.0.0 build'],
	['41:19', 'stderr', '#6 0.413 > vite build'],
	['41:21', 'stderr', '#6 2.001 vite v6.0.3 building for production...']
];

const SUCCEEDED: Raw[] = [
	...COMMON,
	['41:24', 'stderr', '#6 4.880 ✓ 42 modules transformed.'],
	['41:25', 'stderr', '#6 5.201 dist/index.html  0.46 kB │ gzip: 0.30 kB'],
	['41:30', 'stderr', '#7 exporting to image'],
	['41:31', 'stderr', '#7 DONE 1.2s'],
	['41:40', 'system', 'Starting container on node runtime-1'],
	['41:42', 'stdout', 'Server listening on port 3000'],
	['41:45', 'system', 'Health check passed: GET / answered 200']
];

const FAILED: Raw[] = [
	...COMMON,
	['41:22', 'stderr', '#6 3.300 Reading postgres://kopi:rahasia-sekali@db.internal:5432/kopi'],
	['41:22', 'stderr', '#6 3.410 error during build:'],
	[
		'41:22',
		'stderr',
		'#6 3.411 [vite]: Rollup failed to resolve import "./components/Menu" from "src/App.jsx".'
	],
	[
		'41:22',
		'stderr',
		'#6 3.412     at viteLog (node_modules/vite/dist/node/chunks/dep.js:51432:15)'
	],
	[
		'41:23',
		'stderr',
		'#6 ERROR: process "/bin/sh -c npm run build" did not complete successfully: exit code: 1'
	],
	[
		'41:23',
		'stderr',
		'ERROR: failed to solve: process "/bin/sh -c npm run build" did not complete successfully: exit code: 1'
	]
];

function toLines(raw: Raw[]): LogLine[] {
	return raw.map(([time, stream, message], index) => ({
		sequence: index + 1,
		stream,
		message,
		recorded_at: at(time)
	}));
}

export const succeededLogLines = toLines(SUCCEEDED);
export const failedLogLines = toLines(FAILED);

const event = (sequence: number, type: string, time: string) => ({
	sequence,
	level: 'info',
	type,
	message: type,
	metadata: null,
	occurred_at: `2026-09-20T08:${time}Z`
});

export const succeededEvents = [
	event(1, 'deployment.checkout.started', '41:02'),
	event(2, 'deployment.analysis.started', '41:05'),
	event(3, 'deployment.build.started', '41:08'),
	event(4, 'deployment.container.started', '41:40'),
	event(5, 'deployment.health.started', '41:44'),
	event(6, 'deployment.route.started', '41:46')
];

export const failedEvents = succeededEvents.slice(0, 3);

export const realisticSucceeded = {
	...succeededDeployment,
	sequence: 4,
	started_at: '2026-09-20T08:41:01Z',
	finished_at: '2026-09-20T08:41:47Z'
};

export const realisticFailed = {
	...failedDeployment,
	sequence: 5,
	started_at: '2026-09-20T08:41:01Z',
	finished_at: '2026-09-20T08:41:24Z',
	failure: {
		...failedDeployment.failure,
		detail: 'process "/bin/sh -c npm run build" did not complete successfully: exit code: 1'
	}
};

export const logReply = (lines: LogLine[]) => () => ({ body: logPage([...lines].reverse()) });
