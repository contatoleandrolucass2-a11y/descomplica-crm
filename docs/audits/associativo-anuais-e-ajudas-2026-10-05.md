# Associativo: saldo, ajudas e brilho

- Fonte: cinco capturas do usuario em 05/10/2026.
- Branch: `codex/associativo-saldo-anuais`, base `de57b6a`.
- Status: validacao funcional integrada aprovada; referencias revisadas, CI final e publicacao pendentes.

## Causa e contrato financeiro

A linha Saldo parcelado mostrava `balanceBeforeCorrection`, que no archive
representa o Pro-Soluto e ainda inclui anuais. As mensais ja descontavam as
anuais corrigidas em `installmentBalanceBeforeCorrection`; nao havia omissao
desse abatimento no calculo das mensais.

O ledger passa a usar `installmentNominalBalance` e `annualNominalTotal`, em
centavos, para reconciliar os valores digitados. Caso sintetico equivalente:

```text
43.444,22 - 1.500,00 - 0,00 - (3 x 2.450,00) = 34.594,22
```

O campo expositivo nao alimenta o motor. Com data-base 05/10/2026 e entrega
31/12/2029, o motor archive preserva anuais corrigidas de 8419.560293005581,
base mensal de 33524.65970699442 e mensal linear de 544.4850913267475.
As ajudas distinguem valores digitados de base com anuais reajustadas.

O Pro-Soluto comercial continua incluindo mensais e anuais. Comprometimento
usa a maior mensal corrigida; maximo da renda usa mensal + evolucao de obra,
sem somar a anual diretamente. Falta de andamento continua impedindo o maximo
e a aprovacao, sem transformar dado ausente em zero.

Nao unificar silenciosamente archive e WF13 oficial: possuem contratos
distintos, documentados em `docs/simulators-official/WF13_LOOKER_AUDIT.md`.
Nenhuma taxa, limite, politica, fonte de estoque, workflow ou dado remoto mudou.

## Interface

- Retira eyebrow, subtitulo e badge indicados somente no Associativo; props
  opcionais do cabecalho preservam os outros simuladores.
- Simplifica ajudas de perfil, recursos, pagamentos, indicadores, proposta
  pronta e documentacao; mantem formulas, condicoes e ressalvas.
- Brilho documental deve atravessar a passagem entre os dois cards sem pausa
  visivel. Validacao mede pixels pintados, nao apenas delays CSS.

## Evidencias

- 33 testes iniciais de ledger, layout e proposta pronta aprovados.
- Auditoria independente: 364 testes de politica, WF13, Looker, archive,
  matriz e regressoes aprovados em Node 24.19.0 no Windows.
- Lint, typecheck e build aprovados no Windows; oito testes Node aprovados.
- Suite integral Windows: 1997 aprovados, cinco condicionais ignorados, seis
  falhas POSIX e um timeout no teste de conhecimento (22/22 aprovados na repeticao isolada).
  Nao foram alterados assertions, limites ou skips para encobrir essas falhas.
- Preview React real em loopback: nove etapas aprovadas, incluindo anuais,
  indicadores dos dois fluxos, documentacao inalterada e restauracao ao remover
  anuais. Confere tambem dados ausentes, recuperacao e isolamento entre unidades.
- CI Linux, jornada autenticada, baseline revisada e publicacao ainda pendentes.
  Preview de componentes nao comprova autenticacao ou guards.
- Regressao final de ledger, layout, FAQ, ajudas e proposta: 81/81 aprovados.
- Brilho: 13/13 testes; nove combinacoes de viewport/tema, dois ciclos cada,
  intervalo pintado medido de 0 ms. Injetar keyframes antigos reproduz falha
  com 3986.71875 ms de intervalo. Reduced-motion e geometria preservados.
- Matriz sintetica completa definida no repositorio: 7285 casos, 250197
  comparacoes, 4301 calculaveis e 2984 bloqueios justificados; zero divergencias.
  Nao representa todas as combinacoes possiveis nem validacao bancaria.
- Tela React real em 1440px e 375px: passagem documental com 0 ms de pausa.
  A medicao agora congela e restaura animacoes alheias para nao confundir
  pequenos brilhos de outros elementos com o feixe documental. Regressao com
  indicador pulsante e os keyframes antigos preserva a deteccao da pausa;
  nove testes do arquivo de efeitos passaram novamente.
- CI `37352840743` e `37356023067`: validate, banco, restauracao e autorizacao
  passaram; medicao visual bloqueou publicacao. A segunda isolou oito pixels
  constantes no plano mobile, sem relacao com a posicao do feixe. A referencia
  agora usa o inicio fora dos cards, mantendo a camada de pintura intacta, em
  vez de remover o gradiente e mudar sua rasterizacao. Tolerancias inalteradas.
- Repeticao com posicoes fracionarias: nove testes de efeitos aprovados,
  incluindo prova negativa da pausa antiga; roteiro React completo em 375x812,
  lint e typecheck aprovados. Nova CI ainda obrigatoria antes da baseline.
- CI `37359896444` manteve o bloqueio mobile: conservar a camada nao bastou.
  Reproducao local com CSS compilado e fonte Geist identificou 12 pixels nos
  quatro cantos do plano. A mascara retangular incluia antialiasing fora do
  pseudo-elemento arredondado. O QA agora calcula a area pintada com bordas,
  insets e raio reais, excluindo esses cantos, sem aumentar tolerancias.
- Fixture agora usa border-box como a aplicacao, alem de posicoes fracionarias.
  Nove testes passaram, incluindo keyframes antigos rejeitados; roteiro real
  com os estilos compilados em 375x812, lint e tipos tambem passaram.
- Integracao de `origin/main` em `dcb88c9`: preserva o canvas aprovado e a nova
  barra mobile. O cabecalho Associativo mantem somente o titulo; nao restaura
  os atalhos retirados pela outra entrega nem os tres textos removidos aqui.
  Regressao inicial integrada: 83 testes aprovados, tres condicionais ignorados.
- Validacao integrada em `125e396`: lint, typecheck, build e roteiro React mobile
  completos aprovados. Suite Windows: 1998 aprovados, cinco condicionais ignorados,
  seis limitacoes POSIX e um timeout de DevTools; DevTools passou isolado (24/24),
  assim como os oito testes Node. Nenhum gate foi afrouxado.
- CI integrada `37364639266` nao iniciou: `validate` cancelado por falta de runner
  hospedado, demais jobs ignorados. Anotacao: `The job was not acquired by Runner
of type hosted even after multiple attempts`. PR #156 aberto; nao houve deploy.
  Fonte externa em 05/10/2026: https://www.githubstatus.com/incidents/3q1yb5m7ltvb,
  incidente de atribuicao de runners iniciado as 19:11 UTC. Nova tentativa sera
  feita sem alterar runner, permissoes, tolerancias ou gates.
- Retomada: CI `37366812102`, tentativa 2, aprovou validate, banco, restauracao
  e autorizacao. O QA integrado encontrou um contrato antigo de geometria que
  ainda exigia o selo removido pelo pedido. Agora exige ausencia dos tres
  rotulos e do aside vazio, preservando as verificacoes de titulo e estoque.
  O componente nao renderiza aside sem selo ou acoes; outros simuladores
  preservam ambos. Regressao de navegador usa o cabecalho React real e rejeita
  reintroduzir cada elemento. Nova CI completa segue obrigatoria.

## Revisao final em 06/10/2026

- CI `37383133528`, tentativa 2, SHA `4a523345`: validate, restore e todos os
  gates funcionais da matriz autenticada aprovados. A tentativa anterior teve
  contraste transitorio em MKT; repeticao no mesmo codigo passou, sem alterar
  a tela, desabilitar a regra ou mudar tolerancias.
- Captura limpa `b8086bf6b953d908129b0c3b87398f28b764da1f`; artefato `11379134553`,
  SHA-256 do ZIP `5818cd329c5e1fb7b52122eaac056fa5ce5b4b212946935d647075db883e992d`.
  242 capturas, sem falhas de rotas, temas, teclado, zoom, axe ou canvas aprovado.
  As 11 diferencas pertencem somente ao Associativo e a retirada do cabecalho.
  Todas foram inspecionadas; 231 referencias preservadas por hash. Promocao
  transacional canonica, limites de 1% e 16 por canal inalterados.
- Revalidacao local: lint/tipos/build aprovados, 15 testes focados com navegador,
  oito Node e 7285 cenarios/250197 comparacoes sem divergencias. Suite Windows:
  1997 aprovados, seis condicionais, seis limitacoes POSIX e dois timeouts de
  conhecimento; repeticao isolada 22/22 aprovada. CI Linux passou a suite integral.
- Merge, CI da main, imagem imutavel, backup e verificacao de producao pendentes.
- A main avancou para `a22f4dc` (calibracao de temas) antes da publicacao.
  Integracao preserva codigo e baseline completos dessa entrega; as 11 imagens
  promovidas acima ficam no historico. A combinacao precisa de nova CI e captura,
  sem reaproveitar imagens antigas para aprovar cores novas. Motores inalterados.

## Correcao de seguranca em 06/10/2026

- CI `37506185905`, SHA `6e37c58c`, aprovou lint/tipos/testes, mas detectou tres
  alertas altos novos. Demais gates e publicacao foram bloqueados.
- [Sharp GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w):
  atualizado para 0.35.5, com dependencias nativas correspondentes.
- [source-map-js GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q):
  override minimo para 1.2.2 nos consumidores existentes.
- [SDK MCP GHSA-6qxp-vccf-f47h](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-6qxp-vccf-f47h):
  override restrito ao Next DevTools atualizado para 1.31.0.
- Versoes e integridades verificadas no registry; instalacao normal com Node
  24.19.0/pnpm 11.20.0. Nenhuma excecao de auditoria ou politica foi adicionada.
- Auditoria sem vulnerabilidades conhecidas; protocolos Next/Chrome e docs
  locais aprovados, 34 testes focados aprovados. Gates completos em repeticao.

## Captura integrada com seguranca corrigida

- CI `37507557118`, HEAD `651b8438`: validate, banco, restore, autorizacao e
  todos os contratos funcionais da matriz autenticada aprovados. Somente as
  11 referencias antigas do cabecalho Associativo divergiram, como esperado.
- Captura limpa `e0e0ce9a1708e0fbd521342d890318338332bfc9`, artefato
  `11435466969`, ZIP SHA-256
  `78cde38884fed710e13fc07bf9bfa1cdd9d62386d7bfaf659856b3caa647d1e1`.
  Todas as 11 imagens foram revistas em sete larguras e tres temas: titulo
  preservado, sem textos retirados ou aside vazio, filtros e estoque integros.
- Promocao canonica e transacional: 11 referencias atualizadas, 231 preservadas
  por hash; limiares de 1% e 16 por canal inalterados. Nova CI final obrigatoria.
- Revalidacao local com dependencias corrigidas: lint/tipos/build aprovados;
  2008 testes aprovados, seis condicionais e seis limitacoes POSIX no Windows.
  Oito testes Node, 34 focados, protocolo MCP e conversao Sharp PNG/WebP passaram.
  Suite integral Linux aprovada na CI. Sem alteracao de regras financeiras.

## Publicacao em 06/10/2026

- PR #156 integrado em `a89a93c07127b2ff1c5cdd4730a709fb1f973424`.
  CI do PR `37511669464` e CI da main `37515245924` inteiramente aprovadas:
  validate, banco, restore isolado, E2E, matriz autenticada e imagem promotable.
- QA final do PR: captura limpa `da7a86a9681a0c8c7009423d6f5fbe811574b96a`,
  artefato `11437446355`, ZIP SHA-256
  `0a6224a947190b42eeccc35f1815d167e13544ca5df21795dae3b4f453bb7e87`.
  242 capturas aprovadas, zero falhas de imagens, rotas ou temas; navegacao
  archive aprovada. O caso nominal continua em R$ 34.594,22.
- Artefato de imagem `11436493731`; ZIP SHA-256
  `f2decefecd603445ba910c004e82b22bee79ccb205554e3a114032e1ee073955`.
  Arquivo `image.tar.gz` verificado localmente e na VPS:
  `fd625967c78fecc7816eff2a488223e9a03ecc0021f72f39c25bd8e8d5ff5fee`.
- Config digest da CI:
  `sha256:6dcd8884da2cf5252083033d6bdf48b50268f71c69b735968c7e0e421a6135f7`.
  Manifesto carregado:
  `sha256:39e6ea78fbb678fec1192ca546536ee0a7b2a82b9ea52374988056105bf7055a`.
  Cadeia OCI e 11 camadas conferidas; mesma imagem, sem rebuild ou retag.
  Dois perfis de runtime aprovados. Smoke nativo isolado sem rede confirmou
  Sharp 0.35.5/librsvg 2.63.2 e conversao PNG/WebP de 8x8 pixels.
- Antes da troca, SSH e HTTP ficaram temporariamente indisponiveis. A VPS
  apresentou carga 209.82 e pressao de memoria/IO; havia validacao local de
  outro checkout. Nenhum processo alheio foi encerrado. Acesso e health
  recuperaram antes do deploy; health local medido em 0.014 s antes da troca.
- Checkout limpo e separado em `/srv/descomplica-crm-releases/<SHA>`; trabalho
  nao commitado em `/srv/descomplica-crm` preservado. Compose, wrapper e Nginx
  mantidos. Sem migration, alteracao de dados, DNS ou workflows n8n.
- Backup privado e checksums aprovados em
  `/var/backups/descomplica-crm/releases/a89a93c07127b2ff1c5cdd4730a709fb1f973424.ZygxF4`.
  Versao anterior `a22f4dc5580542b5a8e72f6a2b1c450974e45ed6`, imagem
  `sha256:a10e0f8e30a3458b4a5673ff8f251e1d95a674deb5af2b6a90178c311b1c9677`.
  CAS, lock de publicacao e rollback preparado; nenhuma reversao necessaria.
- Pos-publicacao: container healthy, health local/publico no SHA novo;
  estoque/snapshot anonimos 401 e rota protegida 307. Smoke adicional com
  12 requisicoes, concorrencia 4, zero erros e no-store preservado. Nao e
  teste de capacidade da producao.
- Jornada autenticada real concluida depois do login normal do usuario, sem
  contornar guard ou criar conta. Caso pontual com valores ficticios: tres
  anuais de R$ 2.450,00 deduziram R$ 7.350,00 do saldo mensal; retirar as quatro
  linhas (incluindo uma zerada) restaurou o saldo anterior. Pro-Soluto permaneceu
  constante e comprometimento/maximo mensal recalcularam nos dois planos.
- Resumo documental permaneceu calculado. Os dois cards usam a animacao
  `associative-documentation-shine`, ciclo de 9 s e atraso de 0 s; continuidade
  em pixels comprovada na CI. Cabecalho manteve somente o titulo solicitado.
  Nenhuma proposta foi gravada, enviada ou impressa. A aba foi recarregada e
  ficou aberta no estado inicial, sem valores temporarios do teste.
