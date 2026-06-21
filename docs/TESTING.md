# Testing

## Unit

Gunakan Vitest node untuk utility, parsing, API error mapping, query key, dan logic tanpa browser.

## Component

Gunakan Vitest Browser + Playwright untuk behavior component yang membutuhkan DOM. Jangan menguji detail class visual yang mudah berubah; uji role, label, state, dan interaction.

## End-to-End

Gunakan Playwright untuk user flow bernilai tinggi: login redirect, protected route, create project, deployment progress, dan error recovery. API dapat di-mock pada console test sampai integration environment tersedia.

CI memasang Chromium sekali, lalu menjalankan unit, component, build, dan E2E test.
