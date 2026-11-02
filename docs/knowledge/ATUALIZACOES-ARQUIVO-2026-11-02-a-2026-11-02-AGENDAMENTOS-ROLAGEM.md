# 2026-11-02 — Agendamentos: recência e rolagem integral

## Implementação e validação local

RecencyPanel conserva os mesmos dados e faixas, com índice, barra proporcional
aos dias em relação ao maior valor da lista, data sob o responsável e gerente
separado. CSS reaproveita o padrão dos rankings, sem divisórias, com hover,
rolagem e ajuste móvel. Nenhum perfil salvo foi reescrito.

A tabela usa loadAllDetails com all:true, fora dos filtros. O servidor mantém
autorização da página e da view, snapshot e mascaramento, filtra/ordena antes
de retornar todas as linhas com cursores nulos. All com cursor é inválido.
A leitura padrão e o bootstrap continuam limitados a 50; o cliente esconde
resultados parciais até receber a lista completa. Cache separado por modo,
limitado a oito entradas, deduplicado entre cópias. Resposta incompleta é erro
recuperável; mudança de snapshot invalida todas as cópias. CSV preservado.
Sem migration, alteração de ACL/RLS ou escrita em dados comerciais.

Windows/Node 24.19/Next 16.4.1: 20 testes de controller/actions aprovados. Cobrem
123 linhas integrais, 62 filtradas, 123 vencidas, autorização, snapshot,
mascaramento, cursores, concorrência e resposta parcial. ESLint e Prettier
dos seis arquivos delegados aprovados. UI/resumo/SSR:19 casos aprovados na
rodada inicial; o caso existente de 20 mil registros excedeu 5s duas vezes
(5,67/6,42s). Reexecução isolada, com timeout apenas da CLI de 15s, passou em
5,61s. Tipos globais e ESLint focado aprovados. Não houve mudança de timeout,
baseline ou asserts no pipeline; CI Linux
no SHA candidato continua obrigatória. Não inferir latência de produção disso.

Roteiro tests/appointments-detail.browser.mjs aprovado: 136 linhas simultâneas,
sem paginação, scroll até a última, CSV136, filtros rápidos sem resposta antiga,
arraste/redimensionamento/cópia sem novas consultas e snapshot alterado sem
mistura de dados. Evidência: test-results/appointments-detail/result.json.

QA integrado com componentes/CSS reais e transporte sintético: seis cenários
(três temas × 1440/390px), recência 25, detalhes 136, vencidos 73 e cópia 136.
Observador do DOM viu somente 0/136/73, nunca a página parcial de 50. Uma consulta
all por recorte; cópias deduplicadas. Última linha acessível por rolagem,
CSV 136/73/136, sem sobreposição, overflow horizontal, erro JS ou acesso externo.
Capturas e hashes em test-results/appointments-reading-integral. Isso não
substitui CI, saúde, autorização real ou smoke depois da publicação.

Revisão independente do diff não demonstrou quebra de autorização, recorte,
mascaramento ou snapshot. Não repetiu testes nem consultou dados de produção.
O retorno integral cresce conforme o filtro autorizado; não há truncamento
silencioso. Renderização do limite de 20 mil linhas não foi medida no navegador.

## Abertura — 21:50Z

Git comum confirmado, árvore limpa, base8697ade2. PR472 integrado; CI documental
41526888903 aprovada no head68f17e07 e CI41527166188 aprovada no merge8697ade2.
Os jobs pesados foram ignorados pela classificação documental, sem nova imagem.
Health público em2026-11-02T21:50:12.511Z: HTTP200/ok/2556898d; coordenador com
deployment28c48a83 e nenhuma operação pendente. Main documental difere do runtime
como esperado. Fontes: gh PR472, Actions41527166188,
https://crm.descomplicapro.com.br/api/health e release:production status.

Escopo solicitado: recência no padrão visual dos rankings de conversão; tabela
de detalhamento com todos os resultados do filtro em uma lista com rolagem,
sem botões de paginação. Preservar autorização, snapshot, mascaramento,
filtros e exportação. Nenhuma alteração de outra página, dados comerciais,
permissões, n8n ou schema autorizada por contexto. Não repetir migrations já
aplicadas. Implementação, testes e publicação desta nova alteração pendentes.
