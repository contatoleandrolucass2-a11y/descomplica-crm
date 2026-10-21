import {aggregate, dateRange} from './core.mjs';

export const COMPARISON_METRICS={
  cpa:{label:'CPL / custo por resultado',type:'money'},
  conversions:{label:'Resultados do destino selecionado',type:'integer'},
  spend:{label:'Investimento',type:'money'},
  ctr:{label:'CTR de link · taxa de cliques',type:'percent'},
  cpc:{label:'CPC de link · custo por clique',type:'money'},
  cpm:{label:'CPM · custo por mil impressões',type:'money'},
  cvr:{label:'Índice resultado/clique',type:'percent'},
  impressions:{label:'Impressões',type:'integer'},
  clicks:{label:'Cliques no link',type:'integer'},
  formRate:{label:'Conclusão do formulário',type:'percent',destination:'form'},
  siteRate:{label:'Conversão de sessões do site',type:'percent',destination:'site'},
  waRate:{label:'Clique rastreado → mensagem',type:'percent',destination:'whatsapp'},
  qualityRate:{label:'Qualificação · coortes maduras',type:'percent'},
  cpql:{label:'CPQL · custo por qualificado',type:'money'},
  reach:{label:'Alcance consolidado',type:'integer'},
  frequency:{label:'Frequência',type:'frequency'}
};
export function availableMetrics(destination){return Object.entries(COMPARISON_METRICS).filter(([,m])=>!m.destination||m.destination===destination);}
export function chooseCampaigns(groups,selectedIds,limit=8){
  const sorted=[...groups].sort((a,b)=>b.spend-a.spend||String(a.id).localeCompare(String(b.id)));
  const requested=Array.isArray(selectedIds)?new Set(selectedIds):null;
  const retained=requested?sorted.filter(g=>requested.has(g.id)).slice(0,limit):[];
  return {all:sorted,selected:retained.length?retained:sorted.slice(0,limit),automatic:!requested||retained.length===0,reduced:requested?retained.length!==requested.size:false};
}
export function metricValue(total,key){const value=total?.[key];return Number.isFinite(value)?value:null;}
export function rankComparisons(items,key,order='descending'){
  return [...items].sort((a,b)=>{
    const av=order==='spend'?a.total.spend:order==='deviation'?a.total.cpa===null?(a.total.spend>0?Infinity:null):a.total.cpa/a.goal.limit:metricValue(a.total,key);
    const bv=order==='spend'?b.total.spend:order==='deviation'?b.total.cpa===null?(b.total.spend>0?Infinity:null):b.total.cpa/b.goal.limit:metricValue(b.total,key);
    if(av===null&&bv===null)return a.name.localeCompare(b.name);if(av===null)return 1;if(bv===null)return -1;
    return (order==='ascending'?av-bv:bv-av)||a.name.localeCompare(b.name);
  });
}
export function comparisonSeries(rows,start,end,mode='daily'){
  const dates=dateRange(start,end),byDate=new Map();for(const row of rows){if(!byDate.has(row.date))byDate.set(row.date,[]);byDate.get(row.date).push(row);}
  const size=mode==='weekly'?7:1,out=[];
  for(let i=0;i<dates.length;i+=size){const block=dates.slice(i,i+size),data=block.flatMap(date=>byDate.get(date)||[]);out.push({date:block[0],until:block.at(-1),hasData:data.length>0,...aggregate(data)});}
  return out;
}
export function campaignShares(items){
  const spend=items.reduce((sum,item)=>sum+item.total.spend,0),results=items.reduce((sum,item)=>sum+item.total.conversions,0);
  return items.map(item=>({...item,spendShare:spend>0?item.total.spend/spend*100:0,resultShare:results>0?item.total.conversions/results*100:0,hasSpend:spend>0,hasResults:results>0}));
}
