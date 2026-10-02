# Jornada Dourada do Associativo

- Data: 2026-10-01 (America/Sao_Paulo).
- Branch: `codex/associativo-guia-dourado`, base `f57ed36e`.
- Status: publicado e verificado em 2026-10-02 (America/Sao_Paulo).
- Rota: `/app/simulacao/associativo-fluxo-linear`.
- Tarefa: orientar o preenchimento do perfil e da proposta. Os perfis comerciais
  que acessam a rota recebem a mesma orientacao; nenhuma permissao foi alterada.

## Referencias

As nove capturas fornecidas orientam espacamento, selecao e hierarquia.
[Ranking](https://descomplicapro.com.br/ranking) e
[calculadora de documentacao](https://descomplicapro.com.br/simulacao/calcular-documentacao)
foram consultados somente para leitura pelo navegador. Nenhum formulario foi
preenchido ou salvo nessas paginas. O primeiro oferece ouro metalizado; a segunda
destaca o grupo atual, mantendo etapas futuras atenuadas. A implementacao adapta
esses tratamentos aos contornos compactos e aos tres temas existentes no CRM.

## Implementacao

- Card atual com ouro metalizado, contraste escuro e brilho finito; perguntas
  seguintes continuam bloqueadas pelas mesmas regras do simulador.
- `aria-current=step` acompanha a pergunta atual. O fluxo nao destaca
  Financiamento antes de completar o Perfil.
- Destaque da linha dentro de seus limites, sem escala da borda ou faixa
  atravessando campos. Estados invalidos preservam os avisos de erro.
- Renda com padding interno; quantidade e dinheiro com colunas e caixas iguais.
  No mobile/coarse os inputs tem 44px. Quantidade vazia recebe orientacao;
  valores preenchidos invalidos continuam rejeitados sem alterar calculos.
- Indicador renomeado para `% Maximo da renda mensal`, incluindo ajudas e FAQ.
  Nenhum calculo financeiro, limite ou contrato foi alterado.
- Separacao de 8px entre Linear e o bloco de quatro linhas decrescentes.
- Simbolo $ dourado com nome acessivel e tooltip, alvo de toque de 44px e
  posicionamento no fluxo, sem sobrepor os resultados.
- Botoes ampliam ate 4% no hover por propriedade visual, sem reflow.
  Brilho e ampliacao desativados com `prefers-reduced-motion`.

## Validacao

Inspecao local usa componentes e CSS reais, fonte Geist e estoque sintetico;
nao substitui autenticacao, servidor Next ou gates isolados da CI.

- Lint, tipos e build: aprovados com Node 24.19.0 e pnpm 11.20.0.
- Jornada Playwright: 6/6, larguras 1440 e 375, tres temas; ordem de campos,
  contraste minimo 4.5:1, borda interna, alvos mobile, dimensoes da quantidade,
  gap Linear, simbolo $ efetivamente dourado, modal e movimento reduzido.
  Evidencias sinteticas em `test-results/guidance/results.json` e capturas locais.
- Suite Windows: 1008 passaram, 1 skip existente e 7 falhas. Seis dependem de
  modos POSIX/symlinks; a outra foi timeout no teste de notas fallback do Obsidian,
  aprovado na repeticao isolada. Gates nao foram afrouxados; Linux CI obrigatoria.
- Salesforce Node: 8/8. Revisao estatica independente sem achados pendentes.
- A matriz autenticada completa permanece na CI, com a jornada dourada adicionada
  nos dois tamanhos representativos e todos os gates anteriores preservados.
- Nao houve escrita de dados remotos, migracao, dependencia nova ou workflow n8n.
- Publicacao exige PR/CI verdes, imagem imutavel, backup/CAS/rollback e verificacao
  apos deploy, conforme `docs/runbooks/automatic-publication.md`.

## Publicacao e verificacao

- PR #126 integrado em `ef0a2fba878fed9d36d7b8b0f21e40960237f379`.
  CI do PR `36954146586` e da main `36956549122` aprovadas, incluindo testes
  Linux, restore, RLS/API, navegador e matriz visual. Nenhum baseline alterado
  pelo ajuste do Associativo.
- A main avancou pelo PR #125 do Tabelao. Confirmadas ancestralidade e
  preservacao dos componentes do Associativo; o delta CSS adicional era
  exclusivo de `.tabelao-page-shell`. Publicada a versao integrada
  `598e11713d23da1af26365822220fc638623decb`, com CI `36958962302` verde.
- Artefato imutavel: checksum
  `c903dec3ebab5af27f8df5f6dfb691f4d7ba93b300c84a65017a144a235cbb00`.
  Config CI `sha256:d41f3df82ed14a941002068f46be1aaf54bf18355149eb10d9e3f1a295fba1c7`;
  manifesto local `sha256:d9a6876ae0c9d72f910af0f4a59275912b66890f231a4a15a29eb922e017c9e6`.
  Onze camadas equivalentes e dois perfis de runtime verificados; sem rebuild.
- Backup privado:
  `/var/backups/descomplica-crm/releases/598e11713d23da1af26365822220fc638623decb.Gg3f4w`.
  CAS partiu de `f6730acee979cf894f0e0d581c4c5be8a74375b6`; rollback preparado,
  nao acionado. Nginx preservado e validado.
- Smoke limitado: 12 GETs, concorrencia 4, zero erros. Health 200 com SHA exato;
  estoque e snapshot anonimos 401; `no-store` preservado. Nao e teste de capacidade.
- Navegador autenticado: rota carregou o estoque, sem overflow horizontal,
  com token `--associative-gold: #e9bd54` e gradiente metalizado publicados.
  Nenhuma proposta ou dado remoto foi criado durante a conferencia.
- Prova adicional local: mesma pagina em tres temas 3/3; coarse real 375 e
  desktop 1440 2/2, com alvo 44x44, hover 1.04 e reduced motion estavel.
  Evidencias: `62452-same-page.json` e `55666-coarse-desktop-proof.json` em
  `test-results/guidance`. Capturas por painel evitam artefatos de header sticky.
- Este encerramento e somente documental: nao requer nova troca de runtime.
