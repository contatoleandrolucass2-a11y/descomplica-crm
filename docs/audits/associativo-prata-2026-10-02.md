# Associativo: prata e perfil sequencial

Status final: validado e publicado em 02/10/2026. Registro cronologico abaixo.

## Escopo

Pedido de 02/10/2026, dezoito capturas. Branch
`codex/associativo-prata-sequencial`, base `0ef7b2f`.

- Cabecalho compartilhado compacto, D vermelho/branco integrado ao nome,
  sem badge quadrado nem ponto final; navegacao e alvos de toque preservados.
- Associativo escuro: pagina `#001C54`, paineis `#002774`.
- Proxima acao em prata metalizado, faixa de brilho com ciclo de tres segundos
  ate a conclusao. Movimento reduzido mantem o destaque sem animacao.
- Perfil com confirmacao explicita de modalidade entre renda e primeiro imovel.
- Vao central igual ao padding lateral do fluxo; resumo Linear separado dos
  quatro blocos Decrescentes por duas linhas e intervalo vazio.
- Simbolo de remuneracao com 18px, sem borda, junto da ultima data decrescente.

## Marca

Asset: `public/descomplica-symbol.png`. Ferramenta integrada de imagem,
usada apenas para retirar o fundo azul da referencia fornecida, incluindo
o interior do D. Prompt: preservar geometria, proporcoes, vermelho e branco;
nao redesenhar nem adicionar objetos, texto, sombra ou contorno; fundo transparente.
Nao foi versionado o screenshot original do usuario.

## Limites

Sem alteracao de formulas, politica comercial, autenticacao, banco ou n8n.
As paginas externas indicadas anteriormente sao referencias somente leitura.
Dados de QA sinteticos, sem clientes, propostas reais ou estoque bruto nos artefatos.

## Validacao

- Node 24.19.0 / pnpm 11.20.0. Build e typecheck completos aprovados.
- Lint aprovado excluindo apenas `test-results/**`, artefatos locais nao versionados.
  Primeira tentativa coincidiu com remocao de um arquivo temporario de QA e
  terminou com ENOENT; repeticao sem essa corrida aprovada.
- 26 testes focados de marca, geometria/brilho e sequencia do perfil aprovados.
- `pnpm test` e repeticao Vitest com um worker foram interrompidos apos falhas
  POSIX conhecidas e timeouts de DevTools/infraestrutura neste Windows. Nao sao
  prova da suite completa; a CI Linux integral permanece obrigatoria.
- Primeira previsualizacao validou 1 -> 2 -> 3, shimmer e movimento reduzido,
  gap central/laterais de 28px e separacao 8px/0px dos grupos de parcelas.
  Identificou contraste insuficiente do $ no Claro, corrigido com dourado
  escuro nesse tema e no Medio; Escuro conserva o dourado luminoso.
- Pendente: repeticao visual final desktop/mobile, CI Linux integral e revisao
  das capturas afetadas. Publicacao bloqueada ate todos os gates passarem.
- Repeticao encontrou 4,08:1 no simbolo do tema Medio, corrigido com #965A0A.
  No celular, o resumo usava uma consulta de container sem ancestral nomeado;
  results-stack agora define esse container, habilitando o layout responsivo.
  Seis cenarios de orientacao aprovados na preview sintetica 64303: Claro,
  Medio e Escuro em 1440px e 375px. Inspecao das capturas ainda encontrou
  sobreposicao na tabela de aprovacao mobile; cada regra agora ocupa uma linha
  inteira, seguida de tres resultados identificados, sem comprimir textos.
- CI 36967153629: validate e isolated-restore aprovados. Release E2E encontrou
  roteiro desatualizado em proposalAfterConcurrentEdits: renda invalida a
  confirmacao do Ranking, mas o teste tentava abrir a proposta sem reconfirma-la.
  O roteiro agora exige Ranking vazio e proposta desabilitada antes de confirmar
  novamente; as assercoes de isolamento de valores e unidades foram preservadas.
  Nova execucao integral e referencias visuais permanecem pendentes.

### Revalidacao local final

- Cabecalho: 24/24 combinacoes nas quatro rotas compartilhadas, tres temas,
  desktop 1440px e mobile 375px. Alturas 48px/91px; controles, outline de foco
  e dropdowns sem extravasamento. Evidencia local: header-compact-60211/results.json.
- Orientacao: 6/6 jornadas, tres temas na mesma pagina em cada viewport.
  Coarse foi conferido separadamente porque screenshots longos alteram a
  emulacao de ponteiro nesta versao do navegador; tres jornadas coarse continuas
  preservaram alvo de 44px, simbolo de 18px e ausencia de colisao.
- Aprovacao mobile final: fonte de 12px, regras identificadas e zero textos
  extravasando. Evidencia local: guidance/55578-375-dark-approval-locator.png.
- Edicao de renda: Ranking vazio e proposta ausente antes da reconfirmacao;
  selecionar gold restaura a proposta habilitada. Evidencia sintetica local:
  guidance/55578-income-edit-ranking.json. Nenhuma proposta foi enviada.
- Nova repeticao dos tres arquivos de regressao: 26/26 testes aprovados.
- Preview local encerrada; nenhuma prova local substitui a CI Linux integral.

### CI e referencias

- Run 36968663861, candidato aef65a0, captura limpa do merge sintetico
  ae5906f24f3b0538121ebb0753f528986cb6b495. Validate, restore isolado, banco e
  E2E autenticado aprovados; concorrencia completa sem erros ou timeouts.
- Gate funcional canonico da matriz aprovado, incluindo navegacao, teclado,
  zoom e 193 auditorias de acessibilidade. Falha restrita a 44 comparacoes
  visuais das quatro rotas que compartilham ArchiveHeader.
- As 44 capturas foram inspecionadas em onze pranchas por viewport/tema.
  Promocao usa as funcoes canonicas extraidas do harness, com hashes da captura
  e baseline conferidos, staging no mesmo filesystem e rollback. As outras
  149 referencias sao preservadas por hash; tolerancia 16 e limiar 1% intactos.
- Artefato de origem: 11211741666. Nova CI sobre as referencias revisadas e
  publicacao continuam pendentes; nenhuma versao foi promovida nesta etapa.

## Publicacao verificada

- PR #129 integrado em 29a487b3ec1d81cf18cef382e48ca067529cbd9a. CI do PR
  36971256999 e CI main 36973571026: todos os gates aplicaveis aprovados.
- A main avancou durante a espera, incluindo o PR independente da calculadora
  de documentacao. A primeira preparacao recusou a revisao antiga antes de
  promover runtime. Reconciliada a main atual, sem reverter trabalho paralelo.
- Publicado 727c8583ab46a51f81fddb7e0c0ec01b4803a531, que inclui integralmente
  o Associativo. CI 36998281910: validate, release-gates, isolated-restore e
  promotable-image aprovados. Versao anterior: 6f2c2aa863a023a32ebffb2c40c228db503f10e6.
- Imagem imutavel da CI, sem rebuild na VPS. SHA-256 do arquivo:
  0225f4544a4748e3dda1f2ffe2ee4c7e3bef0d7b24af489dd2056a99f0b9cbcb.
  Config digest: 6ea8d7707f554662b9ed4a02591896162244d3e05527bd8bdf63a39ae74d7d76.
  Manifest digest local: 3455e0fab74f7a82427f93ac7633c4cc94554dbaab49fa36c8d2fe994f780951.
  Equivalencia comprovada para 11 camadas e os dois perfis de runtime.
- Backup privado: /var/backups/descomplica-crm/releases/
  727c8583ab46a51f81fddb7e0c0ec01b4803a531.oj3u1M. Checksums de Nginx,
  ambiente e referencia da imagem anterior conferidos; nenhum segredo exposto.
  CAS e rollback preparados. Nginx permaneceu inalterado e validado.
- Health local/publico retornou a revisao esperada. Smoke observacional:
  12 requests, concorrencia quatro, zero erros; health 200, inventory e
  snapshot 401 anonimos, todos no-store. Nao e prova de capacidade de producao.
- Conferencia autenticada no Chrome: marca carregada, cabecalho de 48px,
  fundo rgb(0,28,84); renda libera somente modalidade, confirmacao libera
  primeiro imovel. Brilho de 3s migra para a etapa atual e cessa nas concluidas.
  Valor de teste nao persistido e pagina recarregada ao finalizar.
- O fechamento e somente documental: nao exige nova troca de imagem.
