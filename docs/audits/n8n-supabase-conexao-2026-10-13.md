# Conexao n8n e Supabase ao CRM

Estado final verificado em 13/10/2026, 07:31 UTC (04:31 de Brasilia).
Conexao e primeira carga real concluidas. Agenda automatica ainda desligada.

## Escopo e autorizacao

Usuario solicitou conectar o novo n8n e Supabase ao CRM, preservando o n8n
antigo. Primeira ingestao real e replay devem preceder qualquer agenda.
Credenciais existentes permanecem privadas; este registro nao contem dados
comerciais brutos, tokens nem dumps. Nenhuma migration remota foi aplicada.

## Artefato e validacao

- PR198 integrado: implementacao52411c1, merge15ddedd5fd491dee527231b2a635d8dcdd6707e2.
- CI do PR38354900341 aprovada. CI push/main38358420498 concluida com sucesso
  nos quatro jobs: validate, release-gates, isolated-restore e promotable-image.
- `pnpm verify`: lint, typecheck, test e build aprovados. Vitest2647/43skips,
  Salesforce138, release113/11skips Linux, n8n23. CI exercitou testes Linux.
- QA sintetico: nove combinacoes de viewport/tema, zoom200%, leitura, ingestao,
  falha/recuperacao, autorizacao, polling e console. Revisao sem P1/P2.
- Formatacao dos arquivos alterados aprovada. Dois artefatos preexistentes
  nao versionados em output impedem formatacao global local; CI verde nao os
  inclui. Nao foram modificados nem adicionados ao Git.
- Artefato baixado da mesma CI, sem rebuild na VPS. SHA256 do arquivo:
  `5c3729a63744b92ee0804ba8e30bd1da8d3edd70a644aa3c923146df95eee34f`.
  Config digest da CI:
  `sha256:1ca34e28ddb7bf06e780fdadef4bb07621f3d0e1b8b34d0d79793e6c87710f4d`.
  Manifest digest no containerd:
  `sha256:e1770f9bcfd5148a56335027f60c209fb47fb86cf6282489531f92d1bb17855a`.
- Identidade comprovada em07:25:22Z: index, manifesto OCI, config e11camadas
  tar tiveram hashes/tamanhos recalculados; manifesto Docker legado,
  rootfs.diff_ids e RootFS.Layers da imagem carregada coincidem. Plataforma
  linux/amd64 e label da release exatas. `image:prove` aprovou os dois perfis
  de runtime no destino, usando a mesma imagem e sem imprimir segredos.

## Preflight observacional

- 07:12Z: GitHub main15ddedd; health publico200/ok ainda7c50f59.
- Ledger: bf212f6d-32ae-450c-868f-5ce080359fe9, sem pendencia;
  SHA7c50f59b61be3c07b2540f517f01660fce3728e3.
- MCP: L90AYSBEat4vYHLz, dcffaf09-354c-4a82-817c-5e6ca9da1dd5,
  cinco nodes, inativo, sem agenda nem gravacao de payloads/execucoes.
- Supabase: uma ingestao anterior concluida em07/08, snapshot global
  gerado2026-08-07T18:03:36.329Z, tres views, 15 metricas, 15 empreendimentos e
  104 participantes. Metas e roleta indisponiveis, sem valores inventados.
- RPC Salesforce security definer: somente service_role entre os papeis
  publicos consultados possui EXECUTE. Anon/authenticated nao possuem.
  Qlik runs/entries mantem RLS e nenhum acesso direto desses tres papeis.

## Exportacao real preparada

- Sessao remota autenticada; exportacao terminou06:58:46Z sem publicar.
- RequestId25ec6322-4a01-4838-9b89-55934a9217fe,
  generatedAt2026-10-13T06:56:43.144Z, referencia13/10/2026.
- Sete fontes: oportunidades19965, agendamentos1091, visitas514, pastas2603,
  vendas766, corretores36 e canalimob7. Payload completo aprovado pelo schema
  Zod da release: tres views, 15 metricas, 15 empreendimentos, 144 participantes.
- Exportacao executada pelo usuario de servico dedicado. Os modulos do coletor
  operacional1a949 foram comparados byte a byte com15ddedd; todos os modulos
  usados pela exportacao coincidem. O checkout novo tem dependencias root600
  hardlinked; nao foram ampliadas permissoes do cache compartilhado.
- Candidato privado na VPS; nao foi enviado ao chat/Git. A mesma identidade
  sera preservada no envio e replay, inclusive diante de resposta ambigua.

## Backup e limites

- Banco: restore isolado com65contagens. Novo n8n: restore isolado148tabelas.
  Ambos criptografados, enviados ao bucket privado e recuperados com hash exato.
- Chave privada permanece fora da VPS e Supabase; segunda copia independente
  recomendada. Sem pendrive, perda do PC ainda representa risco de recuperacao.
- Storage esta no mesmo projeto Supabase: nao protege contra exclusao de toda
  a conta/projeto. Nao foi comprovado boot completo das aplicacoes restauradas.
- N8n antigo nao foi acessado nem alterado nesta etapa.
- O monitor independente confirma a sessao, mas nao recebe os recibos desta
  carga unica. A tabela operacional do coletor ainda pode exibir "Sem dados"
  ou "Sem publicacao confirmada"; isso nao e o estado do banco. O cartao n8n
  usa o recibo duravel do Supabase. Nao foi criado heartbeat artificial.

## Publicacao protegida

- Release `15ddedd5fd491dee527231b2a635d8dcdd6707e2` publicada em
  `2026-10-13T07:27:06.373Z` pelo coordenador, com as tres travas e CAS.
- DeploymentId: `54fc028d-2a07-4b82-9605-7c42421c5a72`. Sem pendencia de
  recuperacao. Imagem e os dois digests comprovados estao acima.
- Opcao `--salesforce-ingestion enable`: backup integral privado do ambiente
  anterior, arquivo root:root 0600 vinculado ao deploymentId. Os quatro
  valores efetivos foram conferidos sem imprimir credenciais.
- Health publico 200/ok no SHA exato; ingestao habilitada, refresh desligado.
  POST sem credencial ao CRM retornou 401; refresh desabilitado retornou 404.

## Fluxo publicado e recibos

- MCP publicou e releu o workflow `L90AYSBEat4vYHLz`, versao
  `dcffaf09-354c-4a82-817c-5e6ca9da1dd5`, ativo e igual ao draft.
- Nome atual: **CRM VPS - Salesforce - Ingestao CRM**. A atualizacao somente
  de nome/descricao passou por validate_workflow, update_workflow e releitura
  via MCP. Nodes, conexoes, credenciais, settings e versionId permaneceram
  identicos. O aviso do SDK sobre nova credencial era do template; nenhuma
  credencial foi criada ou substituida. Update sem warnings.
- Webhook sem autorizacao retornou 403. Payloads, progresso e execucoes de
  sucesso/erro continuam sem salvamento. Nao foi adicionado Schedule Trigger.
- Envio real pela VPS ao HTTPS do novo n8n: HTTP 201 em07:28:32Z,
  `idempotent: false`, mesmo requestId da exportacao validada.
- Replay do mesmo arquivo: HTTP 200 em07:29:19Z, `idempotent: true`.
  O recibo n8n nao inclui recordCount; o numero foi conferido diretamente
  no Supabase, sem inferir que null significava zero.
- Run no banco: `d5b24cc6-561a-4eef-a427-97086d60c9ec`,
  workflow `salesforce_n8n_v1`, status `succeeded`, record_count 159,
  finished_at `2026-10-13T07:28:32.735277Z`.
- Reconciliacao depois do replay: uma unica run para o requestId e um unico
  evento `crm.ingestion.succeeded`; horario e contagens preservados.
- Snapshot global substituido: referencia13/10, generatedAt exato da coleta,
  3 views, 15 metricas, 15 empreendimentos e 144 participantes. Metas/roleta
  continuam marcadas como indisponiveis. A troca usa a RPC atomica existente.

## Conferencia visual e proximo passo

- Navegador autenticado do usuario, pagina Integrações, apos reload e
  Verificar conexao: Salesforce **Conectado**, n8n **Ingestao confirmada**
  (04:28 de Brasilia), Supabase **Leitura confirmada** (04:29).
- Screenshot inspecionado no navegador: os tres cartoes ficaram legiveis,
  sem sobreposicao. A data do recibo nao afirma disponibilidade continua.
- Em07:31Z: browser, gateway, monitor e VNC remotos ativos. Nenhum timer
  Salesforce nem processo run-every-30-minutes em execucao. O monitor atual
  e explicitamente sem exportacao. Publisher foi habilitado somente nos dois
  processos pontuais de envio, nao em configuracao persistente.
- Proxima etapa: versionar e validar a implantacao do agendador de30min,
  recebimento das contagens/recibos pelo monitor e alerta de reautenticacao.
  Nao confundir o webhook ativo com exportacao recorrente ja operacional.
