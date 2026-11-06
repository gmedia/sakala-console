import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	},
	{
		// The phosphor barrel prebundles to 20 MB of JS, and loading it into every test iframe crashed
		// the Chromium renderer on a cold Vite cache (8 of 10 runs). Import each icon on its own.
		rules: {
			'no-restricted-imports': [
				'error',
				{
					paths: [
						{
							name: 'phosphor-svelte',
							message: "Import the icon on its own: 'phosphor-svelte/lib/<Name>'."
						}
					]
				}
			]
		}
	},
	{
		// Colours come from the tokens in app.css, which are checked for contrast. An arbitrary
		// `bg-[#...]` or `color="#..."` skips that check. Illustrations and third-party logos may use
		// hex in their SVG fill and stroke, so those attributes stay allowed.
		files: ['src/**/*.svelte'],
		rules: {
			'no-restricted-syntax': [
				'error',
				{
					selector: 'SvelteLiteral[value=/\\[#[0-9a-fA-F]{3,8}/]',
					message: 'Use a colour token from app.css, not a hex literal.'
				},
				{
					selector: 'Literal[value=/\\[#[0-9a-fA-F]{3,8}/]',
					message: 'Use a colour token from app.css, not a hex literal.'
				},
				{
					selector: 'TemplateElement[value.raw=/\\[#[0-9a-fA-F]{3,8}/]',
					message: 'Use a colour token from app.css, not a hex literal.'
				},
				{
					selector:
						"SvelteAttribute[key.name='color'] > SvelteLiteral[value=/^#[0-9a-fA-F]{3,8}$/]",
					message: 'Use a colour token from app.css, not a hex literal.'
				}
			]
		}
	}
);
