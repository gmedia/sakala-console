/**
 * One icon per concept, the same everywhere (docs/UI_GUIDELINES.md, "Ikon"). Import the concept,
 * not the Phosphor name, so a resource never gets two icons and an icon never means two things.
 * Named re-exports keep tree shaking: a page bundles only the icons it imports.
 */
export { default as ProjectIcon } from 'phosphor-svelte/lib/SquaresFour';
export { default as DatabaseIcon } from 'phosphor-svelte/lib/Database';
export { default as BucketIcon } from 'phosphor-svelte/lib/Archive';
export { default as ValkeyIcon } from 'phosphor-svelte/lib/Memory';
export { default as DomainIcon } from 'phosphor-svelte/lib/Globe';
export { default as DeployIcon } from 'phosphor-svelte/lib/ArrowsClockwise';
export { default as WorkerIcon } from 'phosphor-svelte/lib/Cpu';
export { default as ScheduleIcon } from 'phosphor-svelte/lib/CalendarBlank';
export { default as ErrorIcon } from 'phosphor-svelte/lib/WarningCircle';
export { default as SuccessIcon } from 'phosphor-svelte/lib/CheckCircle';
/** A suggestion: next steps and "Saran untuk Laravel". */
export { default as SuggestionIcon } from 'phosphor-svelte/lib/Lightbulb';
/** Guides and documentation: the sidebar's Panduan and every panel's Bantuan. */
export { default as GuideIcon } from 'phosphor-svelte/lib/BookOpenText';
export { default as SettingsIcon } from 'phosphor-svelte/lib/GearSix';
