# CAIXA: fronteiras, interface e publicação

## Publicação e validação concluídas — 05/11/2026

- Escopo exclusivo CAIXA; sem mudanças em outras páginas, migrations, coletor ou políticas de ranking. PR #503 integrada em `318b51fae132ea9991c6b21aad524cd17edb5e4e`.
- CI do PR `42081292829` e CI do main `42088655220`: validate, release-gates, promotable-image e isolated-restore aprovados. Gate visual final por impacto: 49 verificações responsivas, 28 de temas, 77 de acessibilidade, 77 comparações e 35 de zoom aprovadas. Fonte: https://github.com/contatoleandrolucass2-a11y/descomplica-crm/actions/runs/42088655220.
- Artefato `13445135749`, SHA-256 ZIP `b5c5d6c64eebf84725fc377e32c0b094af1945b6cdb26475d38b6fc2bcc0ffd2`; checksum interno/revision aprovados. Config CI `sha256:4f6577f6a811271143991ea4e091c60fe396fbc9e3d9920cddb1c8fe0c2f7f7e` e manifesto/carregamento `sha256:63e3067c843d67310461c79ae80203bfde4fdefce1de25224f9acf965cfe3785`, com equivalência das 14 camadas linux/amd64 comprovada. `image:prove`: dois perfis, mesma imagem, sem segredos impressos.
- Backup privado preservado no host, diretório 0700 e arquivos root 0600. Coordenador único com locks/CAS promoveu de `28b4ac35`/deployment `8228d2a6-5ceb-4f13-9263-72f0f1a3644f` para `318b51fa`/deployment `cfc2f192-589c-4276-a6fb-2e9adb4747ce` em **19:58:29.411 UTC / 16:58:29.411 America/Sao_Paulo**. Sem pendência. Não houve rebuild na VPS nem alteração manual do ambiente.
- GET observacional https://crm.descomplicapro.com.br/api/health às 19:59:23 UTC: HTTP 200, status ok, version `318b51fae132ea9991c6b21aad524cd17edb5e4e`.
- Smoke autenticado após reload: São Paulo/SP, renda R$4.000, imóvel R$275.000, nascimento 22/01/1987, PRICE/420 meses, FGTS sim, apartamento 32m², dependentes sim: financiamento R$209.416,34, subsídio R$2.099, entrada complementar R$63.484,66. Nascimento alterado para 22/01/1956 reduziu automaticamente para 117 meses; retorno a 1987 restaurou 420 e os valores anteriores.
- Unidades abriu na própria página; Ouro/primeiro imóvel sim: 348 opções. Filtro Direcional atualizou total e facetas para 258. Clique no texto da linha selecionou a unidade; três anuais válidas de R$2.000 ficaram visíveis para entrega fevereiro/2029, com ambos os fluxos aprovados no caso observado. Modal de 420 parcelas centralizado e botão Imprimir presentes; nenhuma impressão física, proposta enviada ou cliente gravado.
- Contagens do estoque são instantâneas, não promessas para coletas futuras. Matriz financeira final: 151 testes distintos em oito arquivos; inclui 326.592 cenários de fronteiras e 508.032 físicos. Não equivale a testar todas as combinações possíveis diretamente na CAIXA.
- Limites preservados: seguros do produto completo dependem da apólice e diferem da referência rápida; campos de seguro confirmado continuam disponíveis. A regra comercial solicitada pelo usuário permanece identificada na auditoria/impressão e não é a regra oficial do menor valor entre compra e avaliação. Não declarar igualdade universal ou aprovação bancária.
- Encerramento documental, sem novo reinício da aplicação. Registro inicial abaixo preservado integralmente como histórico; seus estados pendentes foram superados pelas evidências acima. Sincronização será conferida no runtime após o commit.

## 2026-11-05 — CAIXA: nova revisão de fronteiras e interface

- Reconsulta 05/11 às 17:43 UTC: origin/main e health público HTTP 200/ok em 28b4ac35; publicação concorrente preservada. CAIXA segue na PR #503, ainda não publicada.
- Abertura: Git comum confirmado, main `5906ca79`, CI42036862400 aprovada;
  health público HTTP200/ok em `e407ecd9`. Fonte Git/GitHub/site em05/11/2026.
- Pedido restrito à CAIXA: confrontar São Paulo nas fronteiras de renda/imóvel,
  idades,1–3 proponentes,15–70m² e dependentes; anuais e aprovação por um fluxo;
  corrigir seleção/filtros, efeitos e formulário. Regra comercial anterior
  permanece distinta da regra oficial; equivalência depende de evidência.
- Implementado:formulário em grupos,facetas/seleção/efeitos e anuais visíveis;
  prazo corrigido por prova oficial119meses.105testesfinanceiros,14form/15estoque
  aprovados. [Fontes, matriz e limites](../simulators/CAIXA-FRONTEIRAS-2026-11-05.md).
- Sessão completa aberta pelo usuário confirmou diferença real de subsídio:
  corrigidos fator renda, piso após redutores e truncamento; amostras no relatório.
  Seguro completo difere da referência rápida; não se declara igualdade
  universal nem aprovação bancária. CI/merge/deploy pendentes nesta etapa.

## Histórico CAIXA anterior preservado

## 2026-11-05 — CAIXA: PR495 publicado e validado

- Status: implementado, integrado, CI aprovada e publicado; encerramento
  exclusivamente documental, sem novo deploy. Fonte: PR495/GitHub,
  CI41976197227 (PR50993c01) e CI41981829345 (push/mainb1544dd1), quatro jobs
  obrigatórios aprovados. Main e candidato têm árvore272c37a5 idêntica.
- Produção anterior02fcbc06/deployment327a3db2, publicada pelo responsável
  concorrente06:38:07UTC. Sua entrega foi preservada; confirmou inexistência de
  teste ativo bloqueando a janela e manteve o registro498 em rascunho.
  A pergunta de prioridade ficou sem objeto após essa confirmação, sem interrupção
  de teste ativo. Nenhuma mudança própria em Agendamentos ou infraestrutura.
- Artefato13393699737, ZIPsha256:6c558f507788344e9cbeb0169f3e03b6f279645692de30d06b70f2e9e243478a.
  Configuração CI29731726465fb911a259acc5d5ac7a8bac43102f0201e15c3f253aa445de7da8;
  manifesto/ID carregado7f4ad9a8e701be07dcb9256296833aed910c1ded609f23f72cfce77a11a0d482.
  14camadas linux/amd64 verificadas; image:prove confirmou a mesma imagem em dois
  perfis sem imprimir segredos. Backup privado de env/ledger comparado; imagem
  anterior mantida. Sem rebuild ou testes pesados na VPS.
- Coordenador release:production, sob lock/CAS/consulta ao vivo, publicou
  b1544dd13aacb12690fa75e60e43e9881e1627ff em2026-11-05T07:47:19.438Z
  (04:47:19America/Sao_Paulo), deploymentf834574b-d487-49fd-b7f8-b145be55fd4a.
  Ledger sem pendência; GET público /api/health com nonce/no-cache200/ok/versão
  exata e GET anônimo da CAIXA307/login. Fontes conferidas após publicação.
- Smoke Chrome4 autenticado com dados fictícios:1280 e390 sem overflow;
  19campos/bordas completas em duas linhas desktop; botão expande a página sem
  diálogo; ranking antes do estoque,1516aprovadas de3494; seleção apresenta
  descrição, composição, aprovação,84mensais/anuais, documentação e6ações.
  Desconto10000 recalculou compra247790→237790 e crédito198232→190232 (80%).
  Revogar autorização bloqueou aprovação/cronograma/proposta; zerar restaurou.
  Renda4000/imóvel275000/área50/apartamento/1pessoa/sem dependentes/sem36mesesFGTS
  gerou subsídio1091,41 e prazo420 automaticamente. Não representa aprovação
  bancária individual nem novo confronto exaustivo com proposta oficial.
- Evidências locais: caixa-formulario-publicado-b1544dd1.png e
  caixa-inline-publicado-b1544dd1.png no diretório de visualizações desta demanda.
  Captura full-page teve timeout; capturas de viewport e leituras DOM confirmadas.
  Perfil fictício limpo e viewport restaurado. Sem exportar estoque bruto,
  dados de clientes, salvar/enviar proposta ou imprimir fisicamente.
- Janela liberada ao responsável concorrente após smoke. Registro final no Git
  e Obsidian não reinicia a aplicação e não exige ciclo recursivo de documentação.
