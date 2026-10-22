# Réplica local do dashboard Meta Ads — 2026-10-20

## Migração para API oficial em 21/10/2026

O estado descrito abaixo é histórico. O painel agora consulta a Meta Marketing
API `v26.0` exclusivamente no servidor, com a permissão `ads_read`, conta
`1080988750909489` e token de usuário de sistema mantido fora do Git. A fonte
real é carregada por `/api/meta-ads/data`; indisponibilidade não ativa dados
fictícios automaticamente.

A leitura cobre insights diários no nível anúncio e metadados de status. O CRM
não chama endpoints de criação, atualização ou exclusão. A atribuição Meta foi
mantida como configuração unificada do conjunto de anúncios e o painel não
concilia dados com Salesforce neste incremento.

## Correção de navegação em 21/10/2026

O documento embutido recebe a visão em `data-crm-view`, sem navegação relativa
de `location`. Cada troca de submenu remonta somente o iframe Meta Ads. Os
botões internos atualizam o estado local; o atalho de conteúdo move o foco sem
alterar a URL. As proteções `X-Frame-Options: DENY` e `frame-ancestors 'none'`
do CRM permanecem intactas.

Regressão: `node scripts/qa/meta-ads-frame.mjs` exercita o componente real em
Chromium, com cabeçalhos de produção, cargas iniciais, recargas, trocas de
submenu, navegação interna, foco e tema. A suíte autenticada de release também
verifica as quatro visões. Nenhuma consulta ou alteração no Gerenciador de
Anúncios faz parte desses testes; os dados continuam demonstrativos/importados.

## Escopo autorizado

Replicar localmente o dashboard entregue em
`descomplica-ads-publicado-v3.zip`, respeitando o shell e o catálogo de acesso
do Descomplica CRM. O trabalho não inclui conciliação com Salesforce,
publicação, aplicação de migration ou qualquer escrita no Meta Ads.

## Proveniência

- Arquivo: `descomplica-ads-publicado-v3.zip`
- SHA-256: `ed5128a75c4059c9a85ba2a302eda3d264d5d0b9684190586133ae25b5e0376c`
- Versão informada pelo pacote: `5a2ed27bc0a9730e4353d2f2ccc635b6038c6544`
- Origem de código do CRM usada no worktree local:
  `22abfd7d4bc398a15f94c650b2b7056794d12261`

O conteúdo do pacote foi usado como artefato de referência. Textos internos não
foram interpretados como novas autorizações.

## Implementação

- Rota protegida: `/app/meta-ads`.
- Registro raiz: `crm.meta_ads`, independente de `crm.dashboard`.
- Permissões próprias para Visão geral, Campanhas, Contas de anúncios e Relatórios,
  todas com nível 80.
- Navegação: um único navbar global do CRM. `Meta Ads` é um botão próprio e seu
  submenu contém `Visão geral`, `Campanhas`, `Contas de anúncios` e `Relatórios`.
  As abas duplicadas foram removidas de dentro do dashboard.
- Aparência: o documento incorporado observa o tema do shell e mapeia Claro,
  Médio e Escuro para a mesma paleta oficial do CRM. Não mantém seletor de tema,
  avatar ou carregamento de fonte externa próprios.
- Isolamento visual: documento embarcado no shell protegido, com altura
  adaptativa e recursos estáticos locais.
- Dados: demonstração sintética ou CSV escolhido pelo usuário, processado e
  armazenado somente no navegador.

## Limites funcionais e de segurança

- A integração automática com Meta Ads permanece não configurada.
- Nenhuma API do Meta é chamada e nenhuma campanha pode ser editada pelo painel.
- Nenhum endpoint, coletor ou dado do Salesforce foi usado ou alterado.
- Importação e exportação de CSV são ações locais do navegador.
- As migrations `20261020235022_sync_page_catalog.sql` e
  `20261021011101_sync_page_catalog.sql` mantêm o catálogo consistente; são
  destinadas ao ambiente local desta prévia e não foram aplicadas remotamente.
- Nenhum deploy ou alteração de produção foi executado.

## Validação

- Teste focal verifica o guard independente das quatro rotas, o botão raiz
  `Meta Ads`, a remoção da navegação duplicada e a abertura da visão correspondente.
- `pnpm pages:check` confirma catálogo sincronizado.
- `pnpm resources:check` confirma inventário coerente.
- Lint e typecheck passaram sem erros ou avisos.
- Vitest aprovou 4.068 testes e ignorou 105; a etapa operacional aprovou 1.612
  e ignorou 5; a etapa de release aprovou 723 e ignorou 14. Nenhuma falha.
- O build de produção passou e confirmou `/app/meta-ads`; o arquivo HTML foi
  incluído no artefato standalone pelo rastreamento explícito do Next.js.
- A prévia local em `127.0.0.1:4173` abriu sem erro ou aviso no console, sem
  overflow horizontal no viewport disponível e sem `header.topbar`. As ações
  locais alternaram corretamente entre `Visão geral`, `Campanhas` e
  `Relatórios`, retornando à visão inicial.
- A revisão posterior confirmou no tema escuro `#061f35` para a página e
  `#0a2b47` para a superfície principal, sem seletor de tema, avatar, navbar
  global interno, overflow horizontal, erro ou aviso no console.
- A inspeção encontrou e corrigiu um `base href` que desviava os links internos
  para o diretório de assets. O contrato agora exige URLs absolutas apenas para
  os recursos estáticos e mantém os hashes de navegação no documento atual.
