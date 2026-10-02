# Associativo: azul noturno e dourado metalico

## Escopo

- Fonte: pedido e captura do usuario de 02/10/2026, posteriores a entrega prata.
- Branch: codex/associativo-azul-noturno-dourado; base d7c06b6.
- Fundo escuro #040d19, painel #091a2c, campos #050f1d e bordas #526b84.
- Dourado #e9bd54 com gradiente metalico e texto #2e230c nas selecoes,
  perfil atual, campo financeiro pendente, orientacao e seletor de ranking.
- Preserva layout, marca, claro/medio, sequencia renda/modalidade/primeiro imovel,
  brilho recorrente de tres segundos e preferencia de movimento reduzido.
- Nenhuma alteracao em regras financeiras, dados, n8n ou outras tabelas.

## Verificacao

- 28 testes focados aprovados: cores/contraste, geometria e sequencia.
- Navegador local sintetico: 6/6 em 1440x900 e 375x812 nos tres temas,
  sequencia completa, contraste >=4.5:1, brilho/repouso e geometria preservados.
- Fundo/painel renderizados conferidos em RGB(4,13,25)/RGB(9,26,44), estoque
  inicial sem rolagem global no desktop testado; hover/foco dourados aprovados.
- Lint, typecheck e build aprovados. Windows: 1366 testes aprovados, um skip,
  seis falhas de permissao POSIX/symlink; sem skips ou enfraquecimento de gates.
- CI Linux 37030093010: 1369 testes Vitest aprovados, quatro skips existentes,
  oito testes Node aprovados, lint/tipos/build, banco, restore e E2E verdes.
- Matriz funcional: 140 verificacoes responsivas, 80 de temas, 193 de
  acessibilidade e 40 de navegacao aprovadas, incluindo a jornada dourada.
- Candidato 36e87a7f72a3b70a14919134930a4ebd449a9ebe: somente duas diferencas
  visuais, Associativo dark desktop 1440x900 e mobile 390x844. Inspecao visual
  confirmou a nova paleta, sem regressao de geometria. Demais 191 preservadas.
- Promocao pelo gate canonico, proveniencia/hashes conferidos e troca atomica;
  limiar de 1% e tolerancia 16 mantidos. CI 37034089884 totalmente aprovada.
- Gate visual deve revisar somente diferencas do Associativo, preservando
  referencias de outras rotas e tolerancias existentes.

## Publicacao

Publicado em 02/10/2026 pelo PR #134. CI main 37037035430 totalmente aprovada.

- Runtime: d79bf8c508b1e47873853822dabca17e8ca6ede9.
- Anterior: d7c06b6ffe2114a4ce3e996ceb20873335a3286d.
- Arquivo SHA-256: 8657f402376805670c7d6ce32ceb6d927706451f6d94f4c2d1dd883c4c281692.
- Config CI: sha256:2c64f6523ef09934f2744314d7883fadf7a018f393bde7f87a4978e8c2b499f5.
- Manifesto local: sha256:e170a28ab47de00b27ac34dce49d5a4ca683ce795e16d92a60c300a220c6208e.
- Onze camadas e dois perfis sobre a mesma imagem; sem recompilar no VPS.
- Backup: /var/backups/descomplica-crm/releases/d79bf8c508b1e47873853822dabca17e8ca6ede9.me8N6J.
- Checksums de nginx.conf, production.env e previous-image.txt aprovados,
  sem imprimir segredos. Compare-and-swap e rollback preparados; Nginx inalterado.
- Doze GETs observacionais, concorrencia quatro: health 200/versao correta,
  estoque/snapshot 401 e no-store, zero erros. Nao representa prova de carga.
- Navegador autenticado: fundo RGB(4,13,25), painel RGB(9,26,44), linha e card
  com gradiente dourado e brilho de 3s. Selecao descartada por reload, sem
  proposta salva. Pagina deixada no tema escuro, pronta para uso.
- Espaco livre apos publicacao: 5,3 GB; sem limpeza destrutiva de imagens/dados.
- Fechamento apenas documental; nao reiniciar a aplicacao para este registro.
