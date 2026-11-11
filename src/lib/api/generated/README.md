# Generated API Types

`openapi.json` adalah export Scramble OpenAPI dari `sakala-api`, dan `schema.d.ts` di-generate darinya dengan `pnpm api:types`. `pnpm api:types:check` gagal kalau `schema.d.ts` tidak cocok dengan `openapi.json`. Cara export ulang ada di [docs/API_CLIENT.md](../../../../docs/API_CLIENT.md#generated-types).

Kedua file tidak boleh diedit manual dan tidak diformat Prettier. API Resource dan OpenAPI `sakala-api` adalah source of truth kontrak HTTP.
