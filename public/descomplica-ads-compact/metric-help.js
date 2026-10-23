"use strict";
function metricInfo(key) {
  return `<button type="button" class="info" data-metric-help="${key}" aria-label="Entender ${key === "cap" ? "teto" : metricLabels[key] || key}" title="O que significa, impacto e como investigar melhorias">ⓘ</button>`;
}
function metricGuide(key) {
  const conversation = state.destination === "whatsapp",
    result = conversation ? "conversas iniciadas" : "cadastros";
  const guides = {
    spend: {
      title: "Investimento",
      definition: "Valor gasto na entrega dos anúncios durante o período selecionado.",
      formula: "Soma do gasto das campanhas selecionadas.",
      example: "R$ 100 por dia durante 7 dias = R$ 700 de investimento.",
      impact:
        "É a base do custo por resultado, CPC e CPM. Mais gasto pode ampliar a entrega, mas não garante mais vendas ou eficiência.",
      actions: [
        "Compare o gasto com resultados e qualificação antes de ampliar o orçamento.",
        "Investigue campanhas que consomem verba sem gerar resultados, considerando amostra e tempo para conversão.",
        "Teste alterações de orçamento e acompanhe o custo marginal dos novos resultados.",
      ],
      caution:
        "Gastar menos não é necessariamente melhorar. Avalie o retorno e a capacidade de atendimento.",
    },
    leads: {
      title: conversation ? "Conversas iniciadas" : "Cadastros",
      definition: conversation
        ? "Quantidade de conversas iniciadas atribuídas às campanhas no período."
        : "Quantidade de cadastros atribuídos às campanhas no período.",
      formula:
        "Soma dos resultados do destino selecionado. Cadastros e conversas são contados separadamente.",
      example: conversation
        ? "50 conversas iniciadas não significam 50 pessoas qualificadas ou 50 vendas."
        : "100 cadastros, dos quais 20 qualificados, representam 20% de qualificação.",
      impact:
        "Compõe o custo por resultado e o volume que chega ao atendimento. A qualidade determina quanto desse volume avança.",
      actions: [
        "Compare cliques, aberturas ou visitas, resultados e qualificados para localizar a etapa com maior perda.",
        conversation
          ? "Teste a mensagem de entrada e a clareza do convite para conversar."
          : "Teste clareza da oferta e campos do formulário; valide também a experiência no celular.",
        "Acompanhe qualificação, visitas e vendas após cada teste.",
      ],
      caution:
        "Mais resultados podem vir com menor qualidade. Confira duplicidades, atribuição e atraso de registro antes de concluir.",
    },
    cpl: {
      title: conversation ? "Custo por conversa" : "Custo por cadastro (CPL)",
      definition: "Quanto foi investido, em média, para obter um resultado do destino selecionado.",
      formula: "Investimento ÷ " + result + ". Sem resultados, o custo não é calculável (—).",
      example: "R$ 1.000 de investimento ÷ 50 " + result + " = R$ 20 por resultado.",
      impact:
        "Ajuda a avaliar eficiência e comparar com o teto aplicado. Não mede sozinho custo por venda ou rentabilidade.",
      actions: [
        "Analise CPM, CTR e conversão após o clique para localizar onde o custo pode estar aumentando.",
        "Teste uma hipótese de cada vez: criativo, público, oferta ou etapa de conversão.",
        "Compare o custo por qualificado e por venda antes de priorizar apenas o menor custo.",
      ],
      caution:
        "Acima do teto é um ponto de investigação. CPL alto sozinho não prova qual é a causa.",
    },
    ctr: {
      title: "CTR — taxa de cliques",
      definition:
        "Percentual de impressões que gerou cliques. Ajuda a entender a resposta ao anúncio.",
      formula: "Cliques ÷ impressões × 100.",
      example: "20 cliques ÷ 1.000 impressões × 100 = 2%.",
      impact:
        "Com o mesmo CPM, um CTR maior corresponde a um CPC menor, desde que as métricas usem a mesma definição de clique. Isso não garante mais leads qualificados.",
      actions: [
        "Teste imagem ou vídeo, primeiros segundos, título e chamada para ação.",
        "Verifique se a promessa do anúncio é clara e relevante para o público.",
        "Compare os testes com conversão e qualificação, não apenas com cliques.",
      ],
      caution:
        "CTR alto pode atrair curiosos. Na integração real, diferencie CTR de todos os cliques e CTR de cliques no link; este painel usa cliques no link.",
    },
    cpc: {
      title: "CPC — custo por clique",
      definition: "Valor médio investido para obter um clique.",
      formula: "Investimento ÷ cliques. Sem cliques, exibe —.",
      example: "R$ 100 ÷ 50 cliques = R$ 2 por clique.",
      impact:
        "Afeta o custo de levar pessoas à próxima etapa. Um clique barato só ajuda se o tráfego também converter com qualidade.",
      actions: [
        "Leia CPC junto com CTR e CPM, usando a mesma definição de clique.",
        "Se o CTR cair, teste a clareza e a relevância do criativo.",
        "Se o CPM subir, investigue diferenças de público, posicionamento e período antes de atribuir a causa.",
      ],
      caution:
        "Reduzir CPC não garante reduzir CPL. Cliques baratos com baixa conversão podem sair mais caros por resultado.",
    },
    cpm: {
      title: "CPM — custo por mil impressões",
      definition:
        "Quanto custa, em média, entregar mil exibições do anúncio. Impressões não são pessoas únicas.",
      formula: "Investimento ÷ impressões × 1.000.",
      example: "R$ 200 ÷ 10.000 impressões × 1.000 = R$ 20 de CPM.",
      impact: "Afeta o custo da exposição. Mantido o CTR, um CPM maior corresponde a um CPC maior.",
      actions: [
        "Compare períodos, públicos e posicionamentos equivalentes.",
        "Investigue mudanças de frequência, entrega e diagnósticos de relevância quando esses dados estiverem disponíveis.",
        "Teste alternativas de público, criativo ou posicionamento, acompanhando também qualidade e custo por resultado.",
      ],
      caution:
        "CPM baixo não é um objetivo isolado. Entrega barata para um público pouco interessado pode piorar o resultado final.",
    },
    cap: {
      title: "Teto de custo por resultado",
      definition: "Referência de custo máximo por resultado configurada para a análise.",
      formula:
        "Compare o custo observado com o teto aplicado. A referência mais específica prevalece.",
      example: "Custo de R$ 40 e teto de R$ 30: o custo está 33,3% acima da referência.",
      impact:
        "Orienta a leitura dos gráficos e os alertas, juntamente com as regras de amostra. Não altera orçamento nem pausa anúncios.",
      actions: [
        "Revise o teto com base na qualificação, conversão em vendas e retorno esperado.",
        "Confira a amostra antes de interpretar um alerta.",
        "Altere metas, tetos e regras somente na página Ajustes.",
      ],
      caution:
        "O teto não é uma garantia de desempenho nem uma prova da causa de um custo elevado.",
    },
  };
  return guides[key];
}
document.addEventListener("click", (e) => {
  const button = e.target.closest("[data-metric-help]");
  if (!button) return;
  const guide = metricGuide(button.dataset.metricHelp);
  if (!guide) return;
  const body = document.querySelector("#dialog-body");
  body.replaceChildren();
  const article = document.createElement("article");
  article.className = "metric-guide";
  const title = document.createElement("h2");
  title.textContent = guide.title;
  article.appendChild(title);
  for (const [heading, content] of [
    ["O que é", guide.definition],
    ["Como calcular", guide.formula],
    ["Exemplo", guide.example],
    ["O que afeta", guide.impact],
  ]) {
    const h = document.createElement("h3");
    h.textContent = heading;
    const p = document.createElement("p");
    p.textContent = content;
    article.append(h, p);
  }
  const h = document.createElement("h3");
  h.textContent = "Como investigar melhorias";
  article.appendChild(h);
  const ul = document.createElement("ul");
  guide.actions.forEach((action) => {
    const li = document.createElement("li");
    li.textContent = action;
    ul.appendChild(li);
  });
  article.appendChild(ul);
  const note = document.createElement("p");
  note.className = "metric-caution";
  note.textContent = guide.caution;
  article.appendChild(note);
  const source = document.createElement("a");
  source.href = "https://developers.meta.com/vr/resources/optimize-ad-campaign/";
  source.target = "_blank";
  source.rel = "noopener noreferrer";
  source.textContent = "Referência Meta: leitura de métricas e diagnósticos";
  article.appendChild(source);
  body.appendChild(article);
  document.querySelector("#dialog").showModal();
});
