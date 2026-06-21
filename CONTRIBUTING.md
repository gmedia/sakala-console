# Contributing

## Setup

Gunakan Node.js 22.12+, pnpm 10.31, dan API lokal sesuai README.

```bash
pnpm install
cp .env.example .env
pnpm exec playwright install chromium
pnpm dev
```

## Branch and Commit

Gunakan branch fokus seperti `feat/project-list`, `fix/sanctum-csrf`, atau `docs/api-client`. Commit mengikuti Conventional Commits:

```text
feat(console-auth): add GitHub login entry
fix(api-client): preserve validation errors
docs(console): explain static fallback
```

## Change Rules

- Pertahankan console sebagai frontend-only static SPA.
- Gunakan API client dan generated OpenAPI contract.
- Jangan menaruh data API dalam global UI store.
- Jangan membuat complex accessible primitive tanpa foundation yang tepat.
- Tambahkan dependency hanya untuk use case konkret.
- Gunakan Bahasa Indonesia untuk user-facing copy.
- Perbarui docs ketika route, env, auth, atau API boundary berubah.

## Pull Request Checklist

- [ ] Scope PR fokus dan tidak membawa refactor tak terkait.
- [ ] `pnpm quality` lulus.
- [ ] E2E relevan lulus jika user flow berubah.
- [ ] Loading, empty, error, dan responsive state dipertimbangkan.
- [ ] Perubahan tidak menjadikan client guard sebagai authorization boundary.
- [ ] Tidak ada secret, token, atau data pribadi di source/test fixture.
