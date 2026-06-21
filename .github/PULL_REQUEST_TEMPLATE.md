## Ringkasan

Jelaskan perubahan utama dan alasan teknis/product-nya.

## Area

- [ ] API client / contract
- [ ] Authentication / onboarding
- [ ] Projects / deployments
- [ ] UI primitive / application shell
- [ ] Testing / tooling / CI
- [ ] Documentation / security

## Cara Menguji

```bash
pnpm quality
pnpm test:e2e
```

## Checklist

- [ ] Commit mengikuti Conventional Commits.
- [ ] Console tetap frontend-only dan business logic tetap di API.
- [ ] Loading, empty, error, responsive, dan keyboard state dipertimbangkan.
- [ ] API type/route mengikuti OpenAPI `sakala-api`.
- [ ] User-facing copy memakai Bahasa Indonesia.
- [ ] Tidak ada secret, token, atau data pribadi pada source/test fixture.
- [ ] Dokumentasi diperbarui jika route, env, auth, atau architecture berubah.
- [ ] Seluruh quality check lulus.

## Related Issue

Closes #
