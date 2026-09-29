# Tabelao: carregamento e acessos simultaneos

Data: 28/09/2026, America/Sao_Paulo.
Branch: codex/tabelao-concorrencia.
Base: 5747512b4b762f44d3a759ac3d06eaa2c3246d71.
Status: validacao local concluida com limitacao POSIX; CI/publicacao pendentes.

## Escopo e evidencia

Usuario relatou lentidao ou erro ao carregar
`https://crm.descomplicapro.com.br/app/simulacao/tabelao`.
Acesso publico pelo navegador redirecionou a /login. Sem sessao autenticada
disponivel nessa inspecao; nenhuma carga sintetica foi enviada a producao.

Revisao do codigo confirmou:

- Fonte viva ja tem cache de trinta segundos e deduplicacao por processo,
  mas novas chamadas apos falhas rapidas voltavam imediatamente a origem.
- Snapshot compartilha leitura fria, mas nao tinha prazo nem intervalo apos
  falha; um arquivo indisponivel provocava repeticao de leitura/validacao.
- Tabelao nao tinha deadline proprio; resposta HTTP ou corpo travado podia
  manter o carregamento. Seu controle active ja descartava respostas de
  efeitos antigos e foi preservado.
- A pagina sempre consultava complemento mesmo com endereco vivo completo.
- Validar somente contagem e array nao impede erro de renderizacao com campos
  opcionais de tipo incorreto, por exemplo streetNumber numerico usado em trim.

## Correcao

Intervalo de cinco segundos apos tentativa compartilhada malsucedida, com
Retry-After e autorizacao individual antes de qualquer cache/erro. Nao devolve
estoque vencido, nao cria cache publico nem compartilha credenciais.
Deadline de vinte segundos para o arquivo no servidor e vinte e cinco no
cliente, incluindo leitura do corpo. Resultado tardio do arquivo nao preenche
cache apos timeout. Cancelamento local permanece independente por pagina.

Contrato do Tabelao verificado antes da renderizacao, sem coercao de dinheiro.
Complemento permanece opcional e posterior a lista viva, sendo omitido quando
nao ha endereco ausente. Filtros, ordenacao, identidade, valores e regras
comerciais permanecem os mesmos. Sem migrations, n8n ou novas dependencias.

## Validacao

- Node 24.19.0 e pnpm 11.20.0; resources:doctor pronto, Docker local indisponivel.
- Lint, typecheck, build e formatacao dos arquivos alterados aprovados.
- Suite integral Windows: 967 aprovados, quatro skips condicionais e seis
  falhas POSIX preexistentes (modos 0600/0700, proprietario e symlinks).
  Nenhuma assercao foi relaxada; CI Linux obrigatoria para esses gates.
- 92 testes de endpoints aprovados, incluindo 20 chamadas concorrentes e
  recuperacao apos falha. Payload cobre trinta consultas concorrentes,
  cancelamento independente e corpo incompleto depois de HTTP 200.
- A primeira execucao integral sofreu pressao de memoria e foi interrompida;
  repeticao com VITEST_MAX_WORKERS=2 terminou com apenas as falhas POSIX acima.
  Scans Gitleaks redigidos passaram sem segredos.
- QA autenticado ampliado usa fixtures sinteticas: cinco payloads malformados,
  recuperacao por nova tentativa, ausencia de complemento desnecessario e duas
  paginas com filtros/ordenacao independentes sob respostas fora de ordem.
  Execucao de navegador permanece para CI; paginas compartilham conta sintetica,
  enquanto testes dos endpoints verificam autorizacao a cada chamada.

## Publicacao e limites

Publicacao depende de PR/CI no SHA candidato, imagem imutavel, backup,
compare-and-swap, rollback e verificacao da versao publicada. Registrar PR,
execucoes e resultado final sem incluir dados de estoque nem credenciais.

Os testes comprovam cenarios controlados, nao capacidade maxima de usuarios.
O cache continua por processo, nao distribuido entre replicas. A latencia e
atualidade da fonte oficial permanecem dependencias externas.
