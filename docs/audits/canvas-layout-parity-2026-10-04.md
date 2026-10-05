# Paridade dos canvases protegidos — publicacao de 04/10/2026

## Escopo

- PR: [#148](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/pull/148).
- Head validado: `08bd0c2184b7df091586ec478bf4bcbce5a1dbd6`.
- Merge e runtime publicado:
  `77a07a73ec1629f1c4d9ae6b2b30d5bab8f79d2f`.
- Destino: `https://crm.descomplicapro.com.br`.
- Publicacao direta em producao autorizada pelo usuario, sem criar ou alterar
  ambiente de homologacao.

O incremento alinha as 22 paginas protegidas aos canvases aprovados e conserva
uma unica navbar global. Dados sem fonte segura permanecem indisponiveis. A
pagina CAIXA pode ser revisada pelo Master, mas CTA, endpoint e motor continuam
fail-closed.

## Gates

- CI do PR: [37241474990](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/37241474990),
  com `validate`, `isolated-restore` e `release-gates` aprovados no head final.
- CI do `main`: [37243547805](https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/37243547805),
  com `validate`, `isolated-restore`, `release-gates` e `promotable-image`
  aprovados.
- O merge por squash manteve a mesma arvore Git do head validado:
  `283f2aafc538e0882d8c6446d3e7b20fe9c7fc0a`.
- Nenhuma migration foi adicionada ou aplicada.

## Imagem imutavel

- Artefato GitHub `11317139909`, nome
  `promotable-image-77a07a73ec1629f1c4d9ae6b2b30d5bab8f79d2f`.
- SHA-256 de `image.tar.gz`:
  `048647453e9e95729d6cc45f496386ba7c196bfd2ca88d320c4e28305343e6b7`.
- Manifesto OCI/local:
  `sha256:7570ac807616d59ceb10131f7bd417f2a70e3fdb8442db6a4c5ae89e687e37e4`.
- Configuracao produzida pela CI:
  `sha256:3f577722473049c038352f52cbaf2569269d2828e8e562eaa0d531f1e19742b3`.
- Revisao OCI igual ao merge SHA, 11 camadas e 11 `diff_ids` verificados.
- `image:prove` aprovou os perfis de homologacao e producao com segredo
  sintetico, sem imprimir valores. Nenhum build foi executado na VPS.

## Backup e rollback

- Versao anterior:
  `f4dec82249c2b3e56beaaea518ec194ced81b480`.
- Imagem anterior preservada:
  `sha256:b8e9d14c02519911cecc70c23236a2fae558f7d0f73e3ef6bd57894c39152df1`.
- Backup root-only:
  `/var/backups/descomplica-crm/releases/77a07a73ec1629f1c4d9ae6b2b30d5bab8f79d2f.HIkO3t`.
- SHA-256 do manifesto `SHA256SUMS`:
  `c098f500cf1aadb16875a45a7fd2f859ebc3745bbef108d98491a7a740b92300`.
- Diretorio `root:root 0700`; arquivos e manifesto `0600`; verificacao de todos
  os checksums aprovada.
- Rollback preparado por CAS reverso para a imagem anterior, seguido pelo mesmo
  wrapper root-only. Nenhuma reversao de banco e necessaria porque o incremento
  nao possui migration.

## Ativacao e smoke

- Container iniciou em `04/10/2026 20:58:43 BRT`.
- Cinco healthchecks consecutivos internos e publicos retornaram `200`,
  `status=ok` e o SHA exato. O monitoramento posterior repetiu o health sem
  divergencia.
- Container `healthy`, zero reinicios, sem OOM e sem padroes criticos nos logs.
- 22/22 rotas protegidas redirecionaram o visitante para o login.
- 5/5 APIs protegidas retornaram `401` sem corpo comercial exposto.
- Seis superficies publicas retornaram `200`; `/unauthorized` retornou `403`.
- CSP, HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy`,
  `Permissions-Policy` e `no-store` presentes; HTTP redireciona para HTTPS.
- Doze healthchecks concorrentes, com concorrencia quatro, retornaram `200` e
  zero HTTP 5xx. Isso e smoke observacional, nao benchmark de capacidade.
- `nginx -t` passou antes e depois. Nginx, DNS e certificados nao foram alterados.

Nenhuma conta produtiva foi usada pelo executor e nenhum dado foi editado. A
matriz autenticada foi comprovada na CI com identidades sinteticas removidas;
a revisao humana autenticada no dominio fica a cargo do usuario.
