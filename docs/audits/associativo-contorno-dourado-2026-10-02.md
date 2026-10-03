# Associativo: dourado fechado e contorno na edicao

## Escopo

- Pedido posterior em duas capturas, branch codex/associativo-contorno-dourado,
  base 3960724. Restrito ao Associativo; Tabelao e tokens comuns intocados.
- Estoque: gradiente metalico antigo #c4a255 / #b99545 / #a98032 / #d5b96f,
  com texto #171209. Tom mais fechado sem amarelo claro/branco no reflexo.
- Etapas, ledger e Ranking: superficie normal, contorno #9f7628, linha
  dourada de 2px junto a borda a cada 3s enquanto a acao estiver pendente.
- Inputs transparentes em vazio, foco e preenchidos. Preserva erros, sequencia
  1-2-3, alvos mobile, geometria e reduced motion. Sem alteracao financeira.

## Validacao Local

- Node 24.19.x e pnpm 11.20.x; lint, typecheck e build aprovados.
- 28 testes focados aprovados; 8 testes Node aprovados.
- Suite Windows: 1410 aprovados, 1 ignorado e 6 falhas de permissao/symlink
  POSIX conhecidas. CI Linux continua obrigatoria, sem skips adicionais.
- Matriz navegador: 6/6 jornadas, temas claro/medio/escuro em 1440x900 e
  375x812. Dados sinteticos, requisicoes externas e escritas bloqueadas.
- Conferidos: fundo transparente antes/depois de preencher, contraste >=4.5,
  borda contida, faixa dourada de 2px, duracao exata de 3s e deslocamento,
  interrupcao ao concluir/reduced motion, sequencia e geometria existentes.
- Capturas locais revisadas: estoque selecionado, perfil desktop/celular,
  financiamento pendente e fluxo preenchido. Sem caixa escura nos valores.
- QA inicial detectou fundo global no Ranking em temas medio/escuro; corrigida
  a precedencia local e repetida a matriz completa com sucesso.

## Publicacao

- PR #138 aprovado e integrado. CI PR 37082276489 e main 37084410555
  integralmente verdes. Baselines, mascaras e tolerancias visuais intocados.
- Runtime: 506b9e3a98f27f246c278287d0486a2e51e8a993.
- Anterior: 150b77129723db56c09e896a42a4703f0df0fbfe.
- SHA-256 do arquivo: 0486220cf66173524f6a0785d65b886e5927b478fd520665879b2be0fe27ffaa.
- Config CI: sha256:5d93f5d6065a2cebf6ec2b66a03bd84acda8e8e58c2c9422962f91196ca40bb9.
- Manifesto carregado: sha256:b8ca4df15442c152d15469a922722a5ed74d04f59a304e51d6928e1242b85352.
- Equivalencia comprovada em 11 camadas, dois perfis de runtime na mesma
  imagem, sem rebuild na VPS.
- Backup privado: /var/backups/descomplica-crm/releases/506b9e3a98f27f246c278287d0486a2e51e8a993.SHlnxv.
  Checksums de ambiente, Nginx e imagem anterior conferidos. CAS concluido,
  rollback preparado, Nginx preservado/valido. Sem mutacao de dados remotos.
- Health local/publico com versao exata e status ok. Smoke observacional:
  12 requisicoes, concorrencia 4, zero erro; health 200 e inventario/snapshot
  401 sem autenticacao. Nao constitui teste de capacidade em producao.
- Navegador autenticado: token de estoque #b99545; card corrente #0a2b47,
  sem gradiente de fundo; borda #9f7628 e associative-edge-shine de 3s com
  background-size 280% 2px. Campo transparente vazio e apos valor sintetico;
  etapa 2 ativa depois da renda. Sessao de teste descartada por reload.
- Nenhuma proposta ou dado pessoal salvo. Tabelao e paleta-base intocados.
- Fechamento documental pelo Git e sincronizacao local, sem novo restart.
