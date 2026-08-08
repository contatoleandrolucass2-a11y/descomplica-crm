# QA visual — login com cérebro mecânico

Data: 2026-08-07
Branch: `codex/login-visual-refresh`

## Ambiente isolado

- Build Next.js de produção executado localmente com Chromium 139 e Playwright
  1.54.2 temporário, sem adicionar dependências ao projeto.
- `NEXT_PUBLIC_SUPABASE_URL` apontou para `127.0.0.1:59999`, sem serviço ativo,
  e a publishable key usada foi um valor local descartável.
- Nenhuma conexão com produção, Supabase remoto, API, middleware ou serviço
  externo foi realizada.
- A mensagem genérica de falha foi validada contra o destino local inacessível;
  os valores fictícios foram apagados antes da captura.

## Resultado

Os 56 checks passaram. O resultado estruturado completo está em
[`results.json`](./results.json).

- Desktop `1440×900`, notebook `1280×720`, tablet `768×1024` e celular touch
  `390×844`: sem overflow horizontal; campos, labels e botão visíveis.
- Zoom de 200%: viewport CSS equivalente a `720×450`, densidade 2× e captura
  física de `1440×900`; conteúdo completo acessível apenas com rolagem vertical.
- Movimento: inclinação observada de `2,46°`, limite de `4°`, engrenagens em
  sentidos alternados e retorno a `0°`; scrollWidth permaneceu estável.
- Touch e `prefers-reduced-motion`: cabeça e engrenagens permaneceram estáticas.
- Teclado: ordem `email`, `password`, botão `submit`, link `/register`.
- Autofill: `email`, `current-password` e `type="password"` preservados; o
  preenchimento do navegador não é interceptado nem reescrito.
- Mensagem de erro: permaneceu dentro da coluna, sem overflow ou quebra dos
  controles.
- Temas claro, equilibrado e escuro: menor contraste medido de `4,55:1`.
- Imagem atrasada artificialmente em 900 ms: deslocamento do formulário `0 px`
  e layout shift acumulado `0`.
- Console e erros de página: nenhum achado na execução final.

## Correções decorrentes do QA

- Máscara gradual no rodapé da ilustração removeu a borda reta do recorte sem
  alterar o asset ou a animação.
- Placeholder ganhou contraste mínimo e os inputs mantêm superfície clara no
  tema escuro, evitando a combinação cinza de baixo contraste.

## Capturas

- [`desktop-1440x900-light.png`](./desktop-1440x900-light.png)
- [`desktop-1440x900-balanced.png`](./desktop-1440x900-balanced.png)
- [`desktop-1440x900-dark.png`](./desktop-1440x900-dark.png)
- [`notebook-1280x720.png`](./notebook-1280x720.png)
- [`tablet-768x1024.png`](./tablet-768x1024.png)
- [`mobile-390x844-touch.png`](./mobile-390x844-touch.png)
- [`zoom-200-percent.png`](./zoom-200-percent.png)
- [`desktop-1440x900-reduced-motion.png`](./desktop-1440x900-reduced-motion.png)
- [`notebook-1280x720-error.png`](./notebook-1280x720-error.png)

Todas as capturas foram feitas com os campos vazios e não contêm credenciais.
