# Evidências dos estados finais

Capturas reproduzíveis do gate visual em `1440×900`, geradas por:

```sh
QA_CAPTURE_STATE_EVIDENCE=true pnpm qa:e2e:release
```

As superfícies de `login`, `logout`, `403` e `404` são capturadas no fluxo real do navegador
com contas QA sintéticas. As superfícies de `500`, `loading`, `empty`, `stale` e `error` usam os
componentes e estilos compilados da aplicação dentro do mesmo runtime isolado; os testes unitários
continuam validando o contrato React original. Nenhuma credencial é gravada.

- `login.png`
- `logout.png`
- `403.png`
- `404.png`
- `500.png`
- `loading.png`
- `empty.png`
- `stale.png`
- `error.png`
- `results.json`: SHA, data, viewport e método de captura sanitizados.
