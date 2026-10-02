# Jornada Dourada do Associativo

- Data: 2026-10-01 (America/Sao_Paulo).
- Branch: `codex/associativo-guia-dourado`, base `f57ed36e`.
- Status: validacao local concluida com limites Windows; CI e publicacao pendentes.
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
