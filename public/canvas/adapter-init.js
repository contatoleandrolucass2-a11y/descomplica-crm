const host=window.parent.CanvasHost;
if(!host)throw new Error('Abra o canvas pela Visão macro ou Campanhas.');
const integration=host.context();
document.querySelector('#period').value='custom';document.querySelector('#start').value=integration.range.start;document.querySelector('#end').value=integration.range.end;
function integratedRows(card){
 const [start,end]=range(card);
 return chartCampaigns(card).flatMap(i=>host.rows(campaigns[i],{start,end}).map(row=>({
  ...row,day:row.date,i,results:row.conversions,
 })));
}
function integratedAggregate(rows,metric){
 return host.aggregate(rows)[metric==='results'?'leads':metric];
}
function integratedRange(card){
 if(card.period==='global')return [integration.range.start,integration.range.end];
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(card.period==='today')return [today,today];
 const end=new Date(today+'T12:00:00Z'),start=new Date(end);
 if(card.period==='week')start.setUTCDate(start.getUTCDate()-((start.getUTCDay()+6)%7));
 if(card.period==='month')start.setUTCDate(1);
 if(['week','month'].includes(card.period))return [start.toISOString().slice(0,10),today];
 return [card.start,card.end];
}
