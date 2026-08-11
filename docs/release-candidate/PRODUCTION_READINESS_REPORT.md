# Relatório de preparação para produção

Data de corte: 2026-08-11.

## Conclusão executiva

O incremento está em preparação local e permanece fail-closed. A base técnica
permite concluir e revisar as lacunas determinísticas, mas ainda não autoriza
merge, migration remota, importação real, cutover ou deploy de produção.

Até este corte houve **zero escrita remota**. A inspeção, o backup e o
inventário do Supabase de produção foram somente de leitura. Supabase, n8n,
Qlik, Salesforce, VPS, DNS, Nginx, containers, dados, grants e flags de produção
não foram alterados.

## Estado por grupo

| Grupo                      | Estado                                            | Entrega comprovada neste corte                                                                                                                                                      | Restante                                                                             |
| -------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Código determinístico      | Implementado localmente, validação final pendente | Breadcrumbs e shell; aprovação Master-only por escopo oficial; metas e pontos em draft/preview/dry-run; ranking fail-closed; estruturas dos cinco simuladores; estados v3 ampliados | Executar suíte integral e corrigir apenas regressões do diff                         |
| Autenticação e autorização | Concluído na base; ampliado localmente            | Supabase SSR, guards, RLS, grants mínimos e navegação filtrada preservados; aprovação não confia na UI                                                                              | Reexecutar nove perfis, 21 rotas e pgTAP no SHA final                                |
| Dados analíticos           | Parcial                                           | v2 preservado; v3 escopado disponível apenas em shadow; estados sem fonte são explícitos                                                                                            | Aprovar mappings, owners, coortes, grants e critério v2/v3                           |
| Configurações comerciais   | Draft seguro                                      | Rascunho versionado, preview e dry-run sem aplicação; auditoria hashes-only                                                                                                         | Políticas, casos de ouro, owner, aprovação, gate, coorte, grant, vigência e rollback |
| Simuladores e ranking      | Visual e fail-closed                              | Cinco jornadas navegáveis; nenhum cálculo, exportação ou persistência oficial; ranking não ativa fórmula não aprovada                                                               | Pacotes oficiais por engine e casos de ouro                                          |
| Relay Qlik                 | Implementado e desligado                          | Caller técnico conhecido; relay autenticado, replay guard, rate limit e papel mínimo preparados                                                                                     | Owner, backup, leitores residuais, HMAC, credencial DB e janelas                     |
| Homologação                | Ambiente existente; atualização pendente          | Ambiente isolado, Basic Auth, contas QA e dados sintéticos preservados conforme evidência do SHA-base                                                                               | Atualizar, executar smoke e recapturar somente após SHA final verde                  |
| Produção                   | Inalterada                                        | Leitura, backup e inventário sanitizado apenas                                                                                                                                      | Toda mudança exige autorização explícita e separada                                  |

## Backup remoto e restore isolado

O backup de 2026-08-11 foi produzido por leitura, criptografado, mantido com
acesso exclusivo de root e teve seus checksums verificados. Nenhum conteúdo,
credencial, caminho privado ou checksum reutilizável foi versionado neste
relatório.

O restore representativo de produção foi executado em alvo descartável e
isolado com `network=none`. O ensaio comprovou:

1. restauração do estado remoto capturado;
2. histórico remoto preservado;
3. aplicação bem-sucedida das dez migrations futuras, incluindo a migration de
   rascunhos deste incremento;
4. tabelas de gates, políticas e drafts sem registros de ativação; os defaults
   de runtime permanecem desligados na configuração versionada da aplicação;
5. fechamento de acesso direto ao Qlik e aos drafts validado no alvo isolado;
6. smoke estrutural e consultas de integridade do restore aprovados; a suíte
   pgTAP integral é comprovada separadamente no ensaio reproduzível local;
7. rollback limpo aprovado.

Após o ensaio, o material plaintext temporário e o container descartável foram
removidos. Permaneceram somente o backup criptografado root-only e registros
sanitizados de integridade. Nenhum dado restaurado foi usado na homologação e
nenhuma conexão remota foi permitida durante o restore.

## Histórico e ordem de migrations

O inventário somente leitura encontrou 17 migrations no histórico remoto. A
última versão remota é `20260809031936`. Antes da migration criada neste
incremento existiam nove migrations locais ainda pendentes de produção; com a
nova migration, o futuro lote ensaiado contém dez.

Essa comprovação resolve o risco técnico do ensaio, mas não concede autoridade
para executar `db push`, `--include-all` ou qualquer migration remota. A ordem
exata deve permanecer a do manifesto versionado e ser novamente comparada ao
histórico remoto imediatamente antes de uma janela aprovada.

## Qlik, mappings e ownership

O caller técnico do caminho Qlik permanece identificado como o workflow n8n
`r4DyPyOTDtoROXq0`. A inspeção somente leitura encontrou 40 requisições `GET`
residuais que ainda precisam ser atribuídas a consumidores e planos de
migração. Não existe owner operacional formal nem substituto aprovado para o
workflow.

O relay, a importação dry-run e a reconciliação podem ser testados localmente,
mas continuam desligados. Não houve alteração do workflow, provisionamento de
HMAC, conexão DB do relay, importação de mapping real ou associação aproximada
por nome.

Gates restantes:

- owner operacional e backup com aceite;
- inventário e decisão para os 40 leitores `GET` residuais;
- manifesto oficial de organizações, equipes, carteiras e responsáveis;
- HMAC e credencial DB mínima provisionados por canal privado;
- coortes, grants e janelas de shadow, canário, cutover e rollback aprovados.

## Código concluído, parcial e bloqueado

### Concluído ou implementado localmente

- autenticação, Supabase SSR, guards, RLS, grants mínimos, CSP e controle de
  navegação preservados;
- catálogo das 21 rotas e navegação hierárquica;
- aprovação Master-only usando somente papel e escopos oficiais existentes;
- drafts versionados de metas e pontos, preview e dry-run sem apply;
- histórico sanitizado por hashes, sem segredo ou payload comercial em logs;
- ranking fechado quando a política oficial não está disponível;
- composição visual dos cinco simuladores sem motor comercial;
- relay e runtime comercial desligados por padrão;
- backup criptografado e restore isolado com rollback limpo.

O status “implementado localmente” não equivale a “validado no SHA final”.
Format, lint, typecheck, testes, build, pgTAP, Playwright, matriz visual,
segurança e CI devem ser registrados após a estabilização do diff.

### Parcial

- dashboard e cinco etapas continuam canônicos em v2; v3 segue em shadow;
- filtros dimensionais dependem de grants e cutover aprovados para produção;
- ranking e Canal de Parcerias possuem composição segura, mas não semântica
  comercial oficial completa;
- evidências visuais atuais correspondem ao SHA-base;
- homologação ainda não executa o SHA final deste incremento;
- manifesto final do merge train e equivalência do SHA ainda devem ser
  produzidos após a suíte verde.

### Bloqueado externamente

- políticas e casos de ouro dos 14 motores;
- fonte oficial de estoque e semânticas de metas, produtividade, pontos, bônus,
  arredondamento, desempate, roleta, SLA, campanhas e premiações;
- owners e backups de datasets e integrações;
- mappings reais e grants por coorte;
- HMAC e credencial DB mínima do relay;
- decisão sobre os 40 leitores Qlik `GET` residuais;
- janelas, aprovadores e responsáveis por canário, cutover e rollback;
- autorizações independentes para migration, merge e deploy de produção.

## Homologação e evidência final

A homologação deve ser atualizada somente depois de um SHA final estável e da
suíte local aplicável. Antes e depois da atualização devem ser repetidos o
health check de produção, a identificação do SHA, o smoke HTTPS, o login da
conta Master/QA dedicada, as 21 rotas, os três temas, acessibilidade,
responsividade e zoom.

As evidências atualmente versionadas continuam úteis como baseline do SHA-base,
mas não comprovam este incremento. Capturas, relatórios e comparação visual
estão **a regenerar no SHA final**. A atualização da homologação não autoriza
produção nem permite usar dados reais, conta pessoal ou integração externa de
escrita.

## Gates para declarar prontidão de release

1. worktree limpa e SHA final publicado em PR draft;
2. suíte integral e CI verdes no mesmo SHA;
3. matriz de rastreabilidade sem evidência pendente para requisitos locais;
4. homologação atualizada e comprovada no SHA final;
5. pacote único de decisões preenchido por autoridades competentes;
6. histórico remoto reconfirmado somente por leitura;
7. autorização separada para cada migration, provisionamento, shadow, canário,
   cutover, hardening, merge e deploy.

Até todos os gates aplicáveis estarem fechados, o estado correto é:
**release candidate local/homologável, não pronto para produção**.
