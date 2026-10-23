# Descomplica Ads: integração do dashboard local completo

## Escopo e fonte

A correção solicitada em 23/10/2026 inclui toda a experiência aprovada no protótipo local, além da lateral já publicada pelo PR #313. O CRM mantém navbar, sessão, permissões e consultas somente leitura. A interface está em `public/descomplica-ads-compact`, dentro do iframe existente.

A fonte é exclusivamente `/api/meta-ads/data`, com linhas diárias por anúncio da Meta Marketing API. As agregações ponderam cliques, impressões, resultados e gasto; as séries representam observações diárias, sem distribuição sintética. Erros da fonte interrompem a análise, sem fallback para demonstração. Um recorte válido vazio exibe zero gasto/resultados e razões indefinidas como `—`.

O período personalizado aceita até 366 dias. A consulta pode cobrir até 732 dias quando inclui o anterior equivalente. O cache de origem incorpora conta e intervalo. A comparação inicia desmarcada.

## Experiência

- Visão macro com seis indicadores, funis/matriz, colunas ou barras, circular/rosca somente para métricas aditivas, evolução, dispersão e tabela.
- Layout reorganizável por arraste ou Alt + setas, com indicadores restritos à faixa superior; redefinição junto do PDF.
- Campanha abre os conjuntos reais e os anúncios do conjunto selecionado. Configurações e referências permanecem separadas.
- Expansão de gráficos preserva período e campanhas, limita a área do gráfico e permite recolher com Escape. Nomes completos ficam no tooltip/tabela.
- Ajustes: teto e limite de investimento por conta, campanha, conjunto ou anúncio, sugestão histórica, amostra, persistência e limiares de alertas.
- Alertas registram o horário observado pelo navegador, leitura individual/coletiva, contador de não lidos e histórico. Não há envio em segundo plano ou e-mail conectado.
- PDF com seções selecionáveis, indicadores, tabela paginada, comparação, gráficos, funis, evolução, mapa de referência e guia opcional de métricas. Período, filtros e atualização da origem aparecem no relatório.

Preferências, tetos e alertas ficam no navegador, isolados por ID do usuário autenticado. A navegação conserva filtros na sessão; não são visões salvas nem parâmetros compartilhados entre usuários/dispositivos. Os valores de orçamento são referências de acompanhamento; não alteram anúncios na Meta.

Mapa e Ajustes são painéis do dashboard existente, selecionados por query `panel`, protegidos pela permissão da página raiz. As quatro rotas comerciais existentes preservam seus guards individuais. O proxy cartográfico também exige a permissão Meta Ads.

## Limite real dos dados geográficos

A API atual não fornece endereço, bairro ou coordenadas individuais. Portanto, nenhum lead é distribuído entre localidades por pesos, nome de campanha ou segmentação do anúncio. O mapa mantém ruas, navegação, busca, camadas recolhidas, pontos/calor e expansão, porém os volumes geográficos ficam `—`. Pontos cinza opcionais são referências do catálogo, claramente identificadas.

A malha municipal é geodata-br; o catálogo de bairros é histórico, não oficial, do projeto geoinfo. Não representa garantia de cobertura ou precisão. As ruas usam OpenStreetMap, com atribuição visível, host fixo, coordenadas validadas, autenticação e cache de sete dias. Testes utilizam tiles locais, sem carga automatizada no provedor. O PDF usa somente malha de referência e informa a indisponibilidade da origem.

## Verificação

O harness `scripts/qa/meta-ads-frame.mjs` executa o componente real com os headers de produção e fonte isolada: oito campanhas, outro destino, período anterior, nomes longos, zero registros e falha de fonte. Exercita totais, razões, datas, comparação desmarcada, tipos, expansão, conjunto/anúncio, ajustes, alertas, mapa, PDF e viewport estreito. Testes unitários verificam agregações, ausências, datas inválidas, autorização e proxy sem credenciais.

As capturas e PDFs de QA são artefatos temporários locais, não dados de produção. A aprovação local, merge e publicação serão registrados separadamente após cada etapa concluída.

A CI `39991191321` aprovou `validate`, `isolated-restore` e o harness específico do dashboard, mas encontrou uma expectativa legada em `e2e/release-candidate.spec.ts`: o seletor `#page-title` e os títulos da interface anterior. O teste foi atualizado para validar as quatro rotas atuais, os painéis de mapa e ajustes, a recarga, o atributo de visão e o isolamento `about:srcdoc`. A resposta vazia da fonte é simulada somente nesse cenário de navegação, sem depender de credenciais Meta; os controles de autorização continuam nos demais cenários. O harness local também passou com as seis visões vazias e suas recargas. A suíte autenticada local não pôde iniciar porque este checkout não tem Supabase local ativo; a execução autenticada completa permanece obrigatória na CI.
