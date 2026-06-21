# Authentication

## Strategy

Console first-party memakai Laravel Sanctum SPA cookie/session auth. JWT atau bearer token tidak disimpan di browser. Agent dan future CLI memakai mekanisme token terpisah.

## Local Domains

```text
Console: http://app.sakala.localhost:5173
API:     http://api.sakala.localhost:8000
Cookie:  .sakala.localhost
```

API harus mengizinkan console pada CORS dan `SANCTUM_STATEFUL_DOMAINS`.

## Unsafe Requests

Sebelum `POST`, `PUT`, `PATCH`, atau `DELETE`, API client mengambil `/sanctum/csrf-cookie` jika `XSRF-TOKEN` belum tersedia. Token cookie dikirim kembali pada `X-XSRF-TOKEN`, dan request selalu memakai `credentials: include`.

## OAuth Direction

Flow GitHub yang akan diimplementasikan:

```text
Console -> API GitHub redirect -> GitHub -> API callback
API creates session -> redirect to Console -> Console fetches current user
```

Auth guard console hanya mengelola loading dan navigation. Seluruh resource tetap dilindungi middleware dan Policy API.
