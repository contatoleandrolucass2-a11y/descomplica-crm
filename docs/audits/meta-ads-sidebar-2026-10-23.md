# Navegação lateral do Meta Ads

A lateral adapta o padrão aprovado na prévia local às páginas reais do CRM: Visão geral, Campanhas, Contas de anúncios e Relatórios. Os destinos vêm de `getAuthorizedNavigation`; não são criadas novas páginas, permissões ou concessões. O destino ativo usa `aria-current="page"`. Em telas de até 900 px, os links formam uma faixa horizontal rolável, sem ocultar seus nomes.

O dashboard continua consultando `/api/meta-ads/data`, autenticado no servidor, com credenciais exclusivamente no runtime. Uma falha da fonte mantém o estado explícito de indisponibilidade. O mapa e os números demonstrativos da prévia não fazem parte desta entrega.

A alteração não modifica campanhas, orçamento ou anúncios na Meta. Os testes verificam a renderização de cada rota e a ausência de links sem autorização; a prova de navegador exercita as visões, temas e alertas com dados sintéticos identificados como fixture. A disponibilidade real da API é verificada separadamente.
