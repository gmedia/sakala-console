# Changelog

Semua perubahan penting pada project ini akan didokumentasikan di file ini mengikuti Keep a Changelog dan Semantic Versioning.

## [Unreleased]

### Added

- Login, register, forgot-password, resend verification, and account settings follow `GET /api/v1/auth/options`: email-based options and unconfigured providers are not offered, with a plain explanation, and `EMAIL_DELIVERY_UNAVAILABLE` shows the API's message.
- Initial SvelteKit static SPA foundation.
- Sakala design tokens and sidebar-based application shell.
- Sanctum-aware API client, typed errors, and TanStack Query foundation.
- OpenAPI type generation, unit/component/E2E testing, CI, and contributor documentation.
- Accessibility floor spec (`tests/e2e/a11y-floor.spec.ts`) over every route at 320, 768, 1024, 1280, and 1366 px, and a colour token contrast spec (`src/lib/design-tokens.spec.ts`).
- Skip link, a focus-trapped mobile drawer, and a lint rule against hex colours in `.svelte` class strings.
- A notice on the login page when a session ends by itself, and a clear message for `GITHUB_RATE_LIMITED` with its wait time.

### Changed

- Colour tokens meet WCAG 2.2 AA: 4.5:1 for text and 3:1 for control edges and the focus ring. Figma's `#A2A2A2` secondary text became `#6B6B6B`.
- Project links use `public_url` from the API instead of building `https://` from the domain.
- Interface wording is consistent: `Proyek`, `Pengaturan`, and `kamu`. Unsubstantiated claims on the auth and onboarding screens were replaced with what the product does.
- Times use `08:41:02`, with the date when older than today, and durations read as `2 menit 5 detik`. A failed step shows when it failed.
- Fonts are self-hosted with `font-display: swap`; the Google Fonts import is gone. Sources and licences are in `static/fonts/README.md`.

### Removed

- Dead code: `ApiStatusCard`, `ConfirmDialog`, `Select`, the system status resource, and `api/envelope.ts`.
