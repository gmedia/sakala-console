# Security Policy

## Reporting

Jangan membuka public issue untuk dugaan kerentanan yang dapat dieksploitasi. Laporkan secara privat melalui GitHub Security Advisory repository atau kanal keamanan maintainer.

Sertakan dampak, langkah reproduksi minimum, environment, dan saran mitigasi jika tersedia. Jangan menyertakan credential atau data pribadi nyata.

## Console Boundaries

- Console tidak menyimpan token auth di `localStorage`.
- First-party browser auth memakai Sanctum session cookie dan CSRF protection.
- Secret tidak boleh memakai prefix `PUBLIC_` atau masuk bundle frontend.
- Client-side route guard bukan authorization; API Policy tetap menentukan akses.
- Console tidak boleh mengakses Docker socket, runtime host, agent token, atau infrastructure secret.
- Error UI tidak boleh menampilkan stack trace atau response internal mentah.

Dependency security diperiksa melalui lockfile review dan automated update tooling repository. Production origin, cookie domain, CORS, dan CSP harus dikonfigurasi pada deployment layer.
