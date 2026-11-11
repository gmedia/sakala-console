import { defineConfig } from '@playwright/test';

// Runs against a Console container that tests/container/runtime-config.sh started, not a preview
// server, so it exercises the real image and its entrypoint.
export default defineConfig({
	testDir: '.',
	testMatch: 'runtime-config.spec.ts',
	reporter: 'list',
	use: { baseURL: process.env.CONSOLE_URL }
});
