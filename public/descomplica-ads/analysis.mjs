import { addDays, aggregate } from "./core.mjs";

// These are editable operating rules, not real-estate market benchmarks.
export const DEFAULT_RULES = Object.freeze({
  mode: 'auto', initialTarget: 20, manualMax: null, historyDays: 28,
  improvementPct: 10, minResults: 30, minDays: 7, minClicks: 50,
  minImpressions: 1000, warningPct: 90, zeroMultiple: 2, driftPct: 15,
  mediaCostPerSale: null, saleRatePct: null, plannedSpend: null, overrides: {}
});
export const DESTINATIONS = {
  form: { label: 'Formulário instantâneo', result: 'Cadastros enviados', unit: 'CPL', cost: 'Custo por lead', event: 'lead' },
  site: { label: 'Formulário no site', result: 'Cadastros no site', unit: 'CPL', cost: 'Custo por lead', event: 'lead' },
  whatsapp: { label: 'WhatsApp', result: 'Conversas iniciadas', unit: 'Custo/conversa', cost: 'Custo por conversa', event: 'conversation' },
  unknown: { label: 'Destino não informado', result: 'Resultados informados', unit: 'Custo/resultado', cost: 'Custo por resultado', event: 'unknown' }
};
const historyCache=new WeakMap();
export function validatedRules(input = {}) {
  const out = { ...DEFAULT_RULES, ...input, overrides: {} };
  const bounds = { initialTarget:[.01,1e7], manualMax:[.01,1e7], historyDays:[7,180], improvementPct:[0,50], minResults:[5,10000], minDays:[3,60], minClicks:[10,100000], minImpressions:[100,1e8], warningPct:[1,100], zeroMultiple:[.5,20], driftPct:[5,100], mediaCostPerSale:[.01,1e9], saleRatePct:[.001,100], plannedSpend:[.01,1e10] };
  for (const [key,[min,max]] of Object.entries(bounds)) {
    if (input[key] === undefined) continue;
    const nullable = ['manualMax','mediaCostPerSale','saleRatePct','plannedSpend'].includes(key);
    if ((input[key] === null || input[key] === '') && nullable) { out[key] = null; continue; }
    const n = Number(input[key]);
    if (!Number.isFinite(n) || n < min || n > max) throw new Error(`Valor inválido em ${key}. Use um valor entre ${min} e ${max}.`);
    if(['historyDays','minResults','minDays','minClicks','minImpressions'].includes(key)&&!Number.isInteger(n))throw new Error(`Use um número inteiro em ${key}.`);
    out[key] = n;
  }
  if (!['auto','manual'].includes(out.mode)) throw new Error('Escolha o modo automático ou manual.');
  if (out.mode === 'manual' && !out.manualMax) throw new Error('Informe um teto máximo para usar o modo manual.');
  if(out.minDays>out.historyDays)throw new Error('O mínimo de dias não pode ultrapassar a janela histórica.');
  if (!!out.mediaCostPerSale !== !!out.saleRatePct) throw new Error('Para calcular o teto econômico, informe o teto de mídia por venda e a taxa de lead para venda.');
  for (const [key,value] of Object.entries(input.overrides || {})) {
    if (!Number.isFinite(Number(value)) || Number(value) <= 0 || Number(value) > 1e7) continue;
    out.overrides[key] = Number(value);
  }
  return out;
}
export function scopeKey(level, id, destination) { return `${level}:${id}:${destination}`; }
function sameValue(rows, key) { const values = [...new Set(rows.map(r => r[key] || ''))]; return values.length === 1 ? values[0] : null; }
export function historicalRows(allRows, current, start, rules) {
  if (!current.length) return { rows:[], level:'sem dados', eligible:false };
  const end = addDays(start,-1), beginning = addDays(start,-rules.historyDays);
  const destination = sameValue(current,'destination'), event = sameValue(current,'event');
  if (!destination || !event) return { rows:[], level:'eventos diferentes', eligible:false };
  const selectedProject=sameValue(current,'project');
  const attribution=sameValue(current,'attribution');
  let cache=historyCache.get(allRows);if(!cache){cache=new Map();historyCache.set(allRows,cache);}
  const cacheKey=JSON.stringify([beginning,end,destination,event,selectedProject,attribution]);
  let base=cache.get(cacheKey);
  if(!base){base=allRows.filter(r => r.date >= beginning && r.date <= end && r.destination === destination && r.event === event && (!selectedProject || r.project===selectedProject) && (r.attribution||'')===(attribution||''));if(cache.size>=80)cache.clear();cache.set(cacheKey,base);}
  const hierarchy = [];
  for (const [key,label] of [['adId','mesmo anúncio'],['adsetId','mesmo conjunto'],['campaignId','mesma campanha']]) {
    const value = sameValue(current,key); if (value) hierarchy.push([label, r => r[key] === value]);
  }
  const project = sameValue(current,'project'), account = sameValue(current,'accountId');
  if (project && account) hierarchy.push(['mesmo empreendimento e conta',r => r.project === project && r.accountId === account]);
  // No cross-project fallback: a missing project can only use the same campaign/ad.
  if (project) hierarchy.push(['mesmo empreendimento',r => r.project === project]);
  let best = {rows:[],level:'sem histórico comparável',eligible:false};
  for (const [level,test] of hierarchy) {
    const selected = base.filter(test); const t = aggregate(selected); const days = new Set(selected.map(r=>r.date)).size;
    const eligible = days >= rules.minDays && t.conversions >= rules.minResults;
    if (eligible) return { rows:selected,level,eligible,days,start:beginning,end };
    if (t.conversions > aggregate(best.rows).conversions) best = { rows:selected,level,eligible:false,days,start:beginning,end };
  }
  return best;
}
function singleGoal(allRows, current, start, rules) {
  const h = historicalRows(allRows,current,start,rules), history = aggregate(h.rows);
  const historicalTarget = h.eligible && history.cpa !== null ? history.cpa * (1-rules.improvementPct/100) : null;
  const economic = rules.mediaCostPerSale && rules.saleRatePct ? rules.mediaCostPerSale * rules.saleRatePct / 100 : null;
  const suggested = historicalTarget !== null && economic !== null ? Math.min(historicalTarget,economic) : historicalTarget ?? economic;
  let manual = null, origin = '';
  if (rules.mode === 'manual') { manual = rules.manualMax; origin = 'Teto manual geral'; }
  const destination = sameValue(current,'destination');
  for (const [level,key] of [['account','accountId'],['campaign','campaignId'],['adset','adsetId'],['ad','adId']]) {
    const id = sameValue(current,key); const value = id && rules.overrides[scopeKey(level,id,destination)];
    if (value > 0) { manual=value; origin=`Teto manual por ${ {account:'conta',campaign:'campanha',adset:'conjunto',ad:'anúncio'}[level] }`; }
  }
  const limit = manual ?? suggested ?? rules.initialTarget;
  return { limit,suggested,historicalTarget,economic,manual,origin:origin || (suggested !== null ? (historicalTarget !== null ? 'Meta sugerida pelo histórico' : 'Teto econômico informado') : 'Meta inicial configurável'),history,historical:h,confidence:h.eligible?'base suficiente':'base limitada',manualAboveEconomic:manual !== null && economic !== null && manual > economic };
}
export function goalForRows(allRows,current,start,rules = DEFAULT_RULES) {
  const groups=new Map();
  for(const row of current){const id=row.adId||row.adsetId||row.campaignId;if(!groups.has(id))groups.set(id,[]);groups.get(id).push(row);}
  const units=[...groups.entries()].map(([id,items])=>({id,rows:items,...aggregate(items)}));
  if (units.length <= 1) return singleGoal(allRows,current,start,rules);
  // Calculate targets for each campaign and budget allocation. The blended target
  // is harmonic/spend-weighted so sum(spend/target) reconciles across the hierarchy.
  const goals = units.map(c=>({ ...singleGoal(allRows,c.rows,start,rules),spend:c.spend,entityId:c.id }));
  const total = aggregate(current).spend;
  const blended = field => {
    if (!goals.every(g=>g[field] > 0)) return null;
    if (!total) return goals.reduce((s,g)=>s+g[field],0)/goals.length;
    const expected=goals.reduce((s,g)=>s+g.spend/g[field],0); return expected > 0 ? total/expected : null;
  };
  const allManual = goals.every(g=>g.manual !== null), sameLimit=goals.every(g=>Math.abs(g.limit-goals[0].limit)<1e-8);
  return {limit:blended('limit') || rules.initialTarget,suggested:blended('suggested'),historicalTarget:blended('historicalTarget'),economic:goals[0]?.economic ?? null,manual:allManual && sameLimit ? goals[0].manual : null,origin:sameLimit && allManual ? goals[0].origin : 'Meta combinada do recorte',history:aggregate([...new Set(goals.flatMap(g=>g.historical.rows))]),historical:{eligible:goals.every(g=>g.historical.eligible),level:'mesmos anúncios/campanhas e empreendimentos',rows:[],days:Math.min(...goals.map(g=>g.historical.days||0))},confidence:goals.every(g=>g.historical.eligible)?'base suficiente':'base parcial ou inicial',manualAboveEconomic:goals.some(g=>g.manualAboveEconomic),components:goals};
}
export function costState(t,limit,rules = DEFAULT_RULES) {
  if (!t.spend) return {level:'neutral',label:'Sem investimento',ratio:null};
  if (!t.conversions) return t.spend >= limit*rules.zeroMultiple ? {level:'danger',label:'Gasto sem resultado',ratio:null} : {level:'collecting',label:'Em coleta · sem resultado',ratio:null};
  const ratio=t.cpa/limit;
  if (ratio>1+1e-10) return {level:'danger',label:'Acima do teto',ratio};
  if (ratio>=rules.warningPct/100) return {level:'warning',label:'Próximo do teto',ratio};
  return {level:'good',label:'Dentro da meta',ratio};
}
export function proportionalPlan(t,limit,budget=null) {
  return {expectedResults:t.spend > 0 ? Math.ceil(t.spend/limit-1e-10) : 0,missingResults:Math.max(0,Math.ceil(t.spend/limit-1e-10)-t.conversions),allowedSpend:t.conversions*limit,excessSpend:Math.max(0,t.spend-t.conversions*limit),plannedResults:budget > 0 ? Math.ceil(budget/limit-1e-10) : null,neededCpc:t.cvr !== null ? limit*t.cvr/100 : null,neededCvr:t.cpc !== null ? t.cpc/limit*100 : null,neededCtr:t.cpm !== null && t.cvr > 0 ? t.cpm/(10*limit*(t.cvr/100)) : null};
}
export function diagnose(t,history,goal,rules = DEFAULT_RULES) {
  const output=[],status=costState(t,goal.limit,rules),minCurrent=t.impressions>=rules.minImpressions && t.clicks>=rules.minClicks;
  const ready=goal.historical.eligible && minCurrent && history.impressions>=rules.minImpressions && history.clicks>=rules.minClicks;
  const delta=(a,b)=>a!==null && b>0 ? a/b-1 : null;
  const ratios={cpm:delta(t.cpm,history.cpm),ctr:delta(t.ctr,history.ctr),cvr:delta(t.cvr,history.cvr),cpc:delta(t.cpc,history.cpc),cpl:delta(t.cpa,history.cpa)};
  const drift=rules.driftPct/100;
  if (ready) {
    if (ratios.cpm>drift) output.push({stage:'Entrega',key:'cpm',title:'A entrega ficou mais cara',evidence:'O CPM subiu em relação ao histórico comparável.',action:'Compare público, posicionamentos, distribuição e período do leilão.',impact:Math.log(t.cpm/history.cpm),level:'warning'});
    if (ratios.ctr < -drift) output.push({stage:'Criativo e oferta',key:'ctr',title:'O anúncio está gerando menos interesse',evidence:'O CTR de link caiu em relação ao histórico comparável.',action:'Teste imagem, vídeo, chamada, oferta e aderência da mensagem ao público.',impact:-Math.log(t.ctr/history.ctr),level:'warning'});
    if (ratios.cvr < -drift) output.push({stage:'Após o clique',key:'cvr',title:'Menos resultados por clique',evidence:'O índice de resultado por clique caiu. Ele não comprova uma conversão rastreada.',action:'Confira abertura e envio do formulário, carregamento do site ou mensagem efetiva no WhatsApp. Revise também o rastreamento.',impact:t.cvr>0?-Math.log(t.cvr/history.cvr):10,level:'warning'});
    if (t.frequency>0 && history.frequency>0 && t.frequency/history.frequency>1+drift && ratios.ctr < -drift && ratios.cpl>drift) output.push({stage:'Público',key:'frequency',title:'Possível desgaste ou saturação',evidence:'Frequência maior, CTR menor e custo por resultado maior no mesmo recorte.',action:'Teste renovação do criativo e distribuição do público. Compare períodos de mesma duração.',impact:.5,level:'warning'});
    if (t.matureContacts>=rules.minResults && history.matureContacts>=rules.minResults && t.qualityRate!==null && history.qualityRate>0 && t.qualityRate/history.qualityRate<1-drift) output.push({stage:'Qualidade no CRM',key:'qualityRate',title:'A qualificação caiu',evidence:'A taxa de qualificação de coortes maduras caiu frente ao histórico.',action:'Revise a promessa do anúncio, critérios de qualificação e retorno do atendimento.',impact:1,level:'warning'});
  }
  output.sort((a,b)=>b.impact-a.impact);
  if (!ready) output.unshift({stage:'Base de análise',key:'sample',title:'Amostra ainda limitada',evidence:`O diagnóstico exige ${rules.minResults} resultados e ${rules.minDays} dias de histórico, além de ${rules.minClicks} cliques e ${rules.minImpressions} impressões no recorte.`,action:'Use o teto como controle de gasto e acumule dados antes de concluir a causa.',level:'neutral',impact:0});
  if (status.level==='danger' && !output.some(d=>d.key!=='sample')) output.push({stage:'Custo e rastreamento',key:'cost',title:'Custo acima do controle configurado',evidence:t.conversions?'O custo ultrapassou o teto, sem um fator isolado confirmado pelos dados.':'Há investimento sem resultados informados no recorte.',action:'Confira rastreamento, maturação dos resultados e se a meta é compatível com o empreendimento e o destino.',level:'danger',impact:0});
  if (ready && output.length===0) output.push({stage:'Estabilidade',key:'stable',title:'Sem desvio relevante nos fatores medidos',evidence:'CPM, CTR e índice de resultado por clique não atingiram o desvio configurado.',action:'Acompanhe volume e qualidade no CRM. A estabilidade não garante rentabilidade.',level:'good',impact:0});
  return {items:output,ready,status,ratios};
}
