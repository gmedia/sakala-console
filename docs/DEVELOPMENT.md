# Development

## Workflow

1. Jalankan `sakala-api` pada domain lokal.
2. Salin `.env.example` menjadi `.env`.
3. Jalankan `pnpm dev`.
4. Buat resource API sebelum feature query/mutation.
5. Susun page dari feature component, bukan business logic langsung di route.

## State Policy

TanStack Query digunakan untuk data server. Svelte runes digunakan untuk local UI state. Jangan menyalin response API ke `$state` global.

## Realtime

Jangan memasang Laravel Echo/Pusher sebelum contract channel tersedia. Implementasi nanti harus mendokumentasikan auth endpoint, event name, payload, reconnect, dan fallback polling.

## Quality

```bash
pnpm quality
pnpm test:e2e
```

Pre-commit hook hanya memformat dan lint file staged. Full quality gate tetap wajib sebelum pull request.
