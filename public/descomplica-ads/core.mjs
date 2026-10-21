export const currency = n => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);
export const integer = n => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(n || 0);
export const decimal = (n, digits = 2) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n || 0);
export const safeRatio = (a, b) => b > 0 ? a / b : null;
export const isoDate = date => date.toISOString().slice(0, 10);
export function addDays(date, amount) { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + amount); return isoDate(d); }
export function dateRange(start, end) { const out = []; for (let d = start; d <= end; d = addDays(d, 1)) out.push(d); return out; }
export function previousRange(start, end) { const count = Math.round((new Date(end) - new Date(start)) / 86400000) + 1; return { start: addDays(start, -count), end: addDays(start, -1) }; }
export function aggregate(rows) {
  const t = rows.reduce((s, r) => { for (const k of ['spend', 'conversions', 'clicks', 'impressions']) s[k] += r[k] || 0; return s; }, { spend: 0, conversions: 0, clicks: 0, impressions: 0 });
  const optional = ['formOpens','sessions','convertedSessions','waClicks','messageClicks','crmContacts','qualifiedLeads','sales'];
  for (const key of optional) t[key] = rows.length && rows.every(r => Number.isFinite(r[key])) ? rows.reduce((s,r)=>s+r[key],0) : null;
  // Reach is not additive across dates, ads or overlapping audiences.
  t.reach = rows.length === 1 && Number.isFinite(rows[0].reach) ? rows[0].reach : null;
  const mature = rows.filter(r=>r.cohortMature && r.crmDeduplicated && Number.isFinite(r.crmContacts) && Number.isFinite(r.qualifiedLeads));
  t.matureContacts = mature.reduce((s,r)=>s+r.crmContacts,0);
  t.matureQualified = mature.reduce((s,r)=>s+r.qualifiedLeads,0);
  t.matureSpend = mature.reduce((s,r)=>s+r.spend,0);
  t.matureRows = mature.length; t.totalRows = rows.length;
  t.qualityCoverage = safeRatio(mature.length*100, rows.length);
  return { ...t, cpa: safeRatio(t.spend, t.conversions), cpc: safeRatio(t.spend, t.clicks), ctr: safeRatio(t.clicks * 100, t.impressions), cvr: safeRatio(t.conversions * 100, t.clicks), cpm:safeRatio(t.spend*1000,t.impressions), frequency:safeRatio(t.impressions,t.reach), formRate:t.formOpens!==null?safeRatio(t.conversions*100,t.formOpens):null, siteRate:t.sessions!==null&&t.convertedSessions!==null?safeRatio(t.convertedSessions*100,t.sessions):null, waRate:t.waClicks!==null&&t.messageClicks!==null?safeRatio(t.messageClicks*100,t.waClicks):null, qualityRate:t.matureContacts?safeRatio(t.matureQualified*100,t.matureContacts):null, cpql:t.matureRows?safeRatio(t.matureSpend,t.matureQualified):null };
}
export function filterRows(rows, { start, end, account = 'all', status = 'all', query = '', destination = 'all', campaign = 'all', adset = 'all', ad = 'all' }) {
  const q = query.trim().toLocaleLowerCase('pt-BR');
  return rows.filter(r => r.date >= start && r.date <= end && (account === 'all' || r.accountId === account) && (status === 'all' || r.status === status) && (destination === 'all' || r.destination === destination) && (campaign === 'all' || r.campaignId === campaign) && (adset === 'all' || r.adsetId === adset) && (ad === 'all' || r.adId === ad) && (!q || [r.campaign,r.account,r.adset,r.ad,r.project].join(' ').toLocaleLowerCase('pt-BR').includes(q)));
}
export function groupRows(rows, key) {
  const groups = new Map();
  for (const row of rows) { if (!groups.has(row[key])) groups.set(row[key], []); groups.get(row[key]).push(row); }
  return [...groups.values()].map(items => ({ ...items[0], ...aggregate(items), rows: items })).sort((a, b) => b.spend - a.spend);
}
export function dailySeries(rows, start, end) { const groups = new Map(groupRows(rows, 'date').map(r => [r.date, r])); return dateRange(start, end).map(date => ({ date, ...aggregate(groups.get(date)?.rows || []) })); }
export const demoAccounts = [
  { id: 'acc-zl', name: 'Direcional · Zona Leste', short: 'Zona Leste', budget: 14000, initials: 'ZL', color: '#73d8ea' },
  { id: 'acc-zs', name: 'Direcional · Zona Sul', short: 'Zona Sul', budget: 10000, initials: 'ZS', color: '#6595e8' },
  { id: 'acc-zo', name: 'Direcional · Zona Oeste', short: 'Zona Oeste', budget: 8000, initials: 'ZO', color: '#aa9af2' },
  { id: 'acc-zn', name: 'Direcional · Zona Norte', short: 'Zona Norte', budget: 6000, initials: 'ZN', color: '#63c6b0' }
];
export function createDemo() {
  const campaigns = [
    ['cmp-1', 'Itaim Paulista | Seu primeiro apê', 0, 256, 17.2, 'active'],
    ['cmp-2', 'Butantã | More perto de tudo', 2, 205, 15.4, 'active'],
    ['cmp-3', 'Sacomã | Conquista Clube', 1, 228, 16.6, 'active'],
    ['cmp-4', 'Sapopemba | Novas oportunidades', 0, 182, 19.1, 'active'],
    ['cmp-5', 'Raiz Home Clube | 2 dormitórios', 3, 168, 14.7, 'active'],
    ['cmp-6', 'Alto Liviero | Últimas unidades', 1, 138, 24.2, 'active'],
    ['cmp-7', 'Mirante | Remarketing', 2, 98, 28.7, 'paused'],
    ['cmp-8', 'São Miguel | Cadastros qualificados', 0, 107, 18.3, 'active']
  ];
  const rows = [];
  for (let day = 0; day < 62; day++) {
    const date = addDays('2026-08-16', day);
    campaigns.forEach(([id, name, ai, base, cpa, status], ci) => {
      const wave = .84 + Math.sin(day * .72 + ci) * .15 + Math.cos(day * .31 + ci * .4) * .09;
      const recent = date >= '2026-10-01';
      const paused = status === 'paused' && date > '2026-10-10';
      const spend = paused ? 0 : Math.round(base * wave * (recent ? 1.12 : .96) * 100) / 100;
      const conversions = Math.round(spend / (cpa * (recent ? .88 : 1.05)));
      const clicks = Math.round(spend / (1.53 + ci * .06));
      const impressions = clicks ? Math.round(clicks / (.016 + ci * .0012)) : 0;
      const destination = ci===2 || ci===5 ? 'whatsapp' : ci===6 ? 'site' : 'form';
      for (let variant=0;variant<3;variant++) {
        const share=[.45,.35,.2][variant], factor=[.85,1.05,1.55][variant];
        const recentProblem=recent && ci===3 && variant===2 ? 1.8 : 1;
        const adSpend=Math.round(spend*share*100)/100;
        const adClicks=Math.round(clicks*share/(recent && ci===3 && variant===2 ? 1.4 : 1));
        const adConversions=adSpend?Math.max(0,Math.round(conversions*share/factor/recentProblem)):0;
        const adImpressions=Math.round(impressions*share);
        const crmContacts=Math.min(adConversions,Math.round(adConversions*.9));
        const qualifiedLeads=Math.round(crmContacts*(variant===2?.34:.63));
        const adId=`${id}-ad-${variant+1}`,adsetId=`${id}-set-${variant===2?2:1}`;
        rows.push({ rowId:`${date}:${adId}`,date,accountId:demoAccounts[ai].id,account:demoAccounts[ai].name,campaignId:id,campaign:name,adsetId,adset:variant===2?'Público de remarketing':'Público de prospecção',adId,ad:['Vídeo · Conheça seu novo apê','Imagem · Condições de entrada','Carrossel · Plantas e lazer'][variant],project:name.split(' | ')[0],status,spend:adSpend,conversions:adConversions,clicks:adClicks,impressions:adImpressions,destination,event:destination==='whatsapp'?'conversation':'lead',attribution:'Demonstração · mesma janela',reach:Math.round(adImpressions/(recent&&ci===3&&variant===2?3.9:2.3)),formOpens:destination==='form'?Math.max(adConversions,Math.round(adClicks*.63)):null,sessions:destination==='site'?Math.round(adClicks*.86):null,convertedSessions:destination==='site'?Math.min(adConversions,Math.round(adClicks*.86)):null,waClicks:destination==='whatsapp'?adClicks:null,messageClicks:destination==='whatsapp'?Math.min(adConversions,adClicks):null,crmContacts,qualifiedLeads,sales:Math.round(qualifiedLeads*.05),cohortMature:date<='2026-10-02',crmDeduplicated:true,qualityRanking:variant===2?'Abaixo da média':'Na média',engagementRanking:variant===2?'Abaixo da média':'Acima da média',conversionRanking:variant===2?'Abaixo da média':'Na média' });
      }
    });
  }
  return rows;
}
export function parseDelimited(text, delimiter) {
  const rows = []; let row = [], value = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; }
    else if (c === delimiter && !quoted) { row.push(value.trim()); value = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && text[i + 1] === '\n') i++; row.push(value.trim()); if (row.some(Boolean)) rows.push(row); row = []; value = ''; }
    else value += c;
  }
  if (quoted) throw new Error('O CSV contém aspas sem fechamento. Exporte o relatório novamente.');
  row.push(value.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
}
const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const aliases = {
  date: ['date', 'data', 'date_start', 'reporting starts', 'início dos relatórios', 'início do relatório', 'dia'],
  end: ['date_stop', 'reporting ends', 'término dos relatórios', 'fim dos relatórios'],
  account: ['account', 'account_name', 'nome da conta', 'nome da conta de anúncios'],
  campaign: ['campaign', 'campaign_name', 'nome da campanha', 'campanha'],
  accountId: ['account_id', 'id da conta'], campaignId: ['campaign_id', 'id da campanha'],
  spend: ['spend', 'amount spent (BRL)', 'valor usado (BRL)', 'valor gasto (BRL)', 'gasto', 'investimento'],
  conversions: ['conversions', 'conversões', 'leads', 'leads (cadastro)', 'cadastros'],
  clicks: ['link_clicks', 'cliques no link'], impressions: ['impressions', 'impressões'],
  status: ['status','ad delivery','veiculação do anúncio','campaign delivery', 'veiculação da campanha', 'status da campanha'], event: ['event', 'evento', 'conversion_event'],
  destination:['destination','destino','origem'],project:['project','empreendimento','projeto'],attribution:['attribution','attribution_setting','attribution_window','configuração de atribuição','janela de atribuição'],
  adsetId:['adset_id','id do conjunto de anúncios'],adset:['adset_name','nome do conjunto de anúncios','conjunto'],
  adId:['ad_id','id do anúncio'],ad:['ad_name','nome do anúncio','anúncio'],
  reach:['reach','alcance'],formOpens:['form_opens','aberturas do formulário'],sessions:['sessions','sessões'],convertedSessions:['converted_sessions','sessões com cadastro'],
  waClicks:['whatsapp_clicks','cliques para whatsapp'],messageClicks:['message_clicks','cliques que viraram mensagem'],
  crmContacts:['crm_contacts','contatos no crm'],qualifiedLeads:['qualified_leads','leads qualificados'],sales:['sales','vendas'],
  cohortMature:['cohort_mature','coorte madura'],crmDeduplicated:['crm_deduplicated','crm deduplicado'],
  qualityRanking:['quality_ranking','classificação de qualidade'],engagementRanking:['engagement_ranking','engagement_rate_ranking','classificação de engajamento'],conversionRanking:['conversion_ranking','conversion_rate_ranking','classificação de conversão']
};
function parseAmount(raw, isInteger, line, label) {
  let s = String(raw ?? '').replace(/R\$|BRL|\s/g, '');
  if (!s || s === '-' || s === '—') return 0;
  if (!/^[\d.,]+$/.test(s)) throw new Error(`Linha ${line}: ${label} deve conter um número positivo.`);
  if (isInteger && /^\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, '');
  else if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > 1e12 || (isInteger && !Number.isSafeInteger(n))) throw new Error(`Linha ${line}: valor inválido em ${label}. Use um valor positivo de até 1 trilhão.`);
  return n;
}
function parseDate(raw, line) {
  let date = String(raw).trim().slice(0, 10);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) date = date.split('/').reverse().join('-');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(new Date(date).getTime()) || isoDate(new Date(date)) !== date) throw new Error(`Linha ${line}: use datas no formato AAAA-MM-DD ou DD/MM/AAAA.`);
  return date;
}
export function parseReport(text) {
  const candidates = [',', ';', '\t'].map(delimiter => ({ delimiter, table: parseDelimited(text, delimiter) }));
  const { table } = candidates.sort((a, b) => (b.table[0]?.length || 0) - (a.table[0]?.length || 0))[0];
  if (table.length < 2) throw new Error('O arquivo precisa ter um cabeçalho e pelo menos uma linha de dados.');
  const headers = table[0].map(normalize);
  const columns = Object.fromEntries(Object.entries(aliases).map(([key, list]) => [key, headers.findIndex(h => list.map(normalize).includes(h))]));
  const missing = ['date', 'account', 'campaign', 'spend', 'conversions', 'clicks', 'impressions'].filter(k => columns[k] < 0);
  if (missing.length) throw new Error(`Colunas ausentes: ${missing.join(', ')}. Baixe o modelo para consultar os nomes aceitos. Use conversões/leads; a coluna genérica “Resultados” pode misturar eventos.`);
  if (table.length > 50001) throw new Error('O limite por importação é de 50 mil linhas. Divida o relatório em arquivos menores.');
  const seen = new Set(); const events = new Map(); const windows = new Map(); const grains = new Set();
  const rows = table.slice(1).map((cells, index) => {
    const line = index + 2; const get = k => columns[k] >= 0 ? cells[columns[k]] || '' : '';
    if (cells.length !== table[0].length) throw new Error(`Linha ${line}: quantidade de colunas diferente do cabeçalho.`);
    const date = parseDate(get('date'), line);
    if (get('end') && parseDate(get('end'), line) !== date) throw new Error(`Linha ${line}: exporte o relatório com detalhamento diário para gerar a evolução corretamente.`);
    const account = get('account').trim(), campaign = get('campaign').trim();
    if (!account || !campaign) throw new Error(`Linha ${line}: informe a conta e o nome da campanha.`);
    const accountId = get('accountId') || 'csv-' + normalize(account);
    const campaignId = get('campaignId') || accountId + '-' + normalize(campaign);
    const adset=get('adset'),ad=get('ad');
    const adsetId=get('adsetId') || (adset?campaignId+'-set-'+normalize(adset):'');
    const adId=get('adId') || (ad?campaignId+'-'+adsetId+'-ad-'+normalize(ad):'');
    if(adId&&!ad) throw new Error(`Linha ${line}: informe o nome do anúncio junto do ID.`);
    if(adsetId&&!adset) throw new Error(`Linha ${line}: informe o nome do conjunto junto do ID.`);
    let rawDestination=normalize(get('destination'));
    const destination=['form','formulario','instantform','instantaneo','formularioinstantaneo'].includes(rawDestination)?'form':['site','website','formulario no site'].map(normalize).includes(rawDestination)?'site':['whatsapp','wa','mensagens'].includes(rawDestination)?'whatsapp':'unknown';
    const event = get('event').trim().toLowerCase() || (destination==='whatsapp'?'conversation':destination==='unknown'?'conversão informada':'lead');
    const normalizedEvent=['lead','leads','cadastro','cadastros'].includes(normalize(event))?'lead':['conversation','conversationstarted','messagingconversationstarted7d','conversainiciada','conversations'].includes(normalize(event))?'conversation':event;
    const key = [date,accountId,campaignId,adsetId,adId,destination].join('|');
    if (seen.has(key)) throw new Error(`Linha ${line}: registro duplicado na mesma data e nível. Exporte um único nível, sem detalhamento adicional de posicionamento, idade ou gênero.`);
    seen.add(key);
    const rawStatus = normalize(get('status'));
    const status = ['paused', 'pausado', 'pausada', 'inactive', 'inativo', 'inativa', 'notdelivering', 'naoveiculando', 'archived', 'arquivada', 'deleted', 'excluida', 'completed', 'concluida'].includes(rawStatus) ? 'paused' : ['active', 'ativa', 'ativo', 'veiculando', 'delivering'].includes(rawStatus) ? 'active' : 'unknown';
    if(!events.has(destination)) events.set(destination,new Set());events.get(destination).add(normalizedEvent);
    grains.add(adId?'ad':adsetId?'adset':'campaign');
    const attribution=get('attribution')||'Não informada';if(!windows.has(destination))windows.set(destination,new Set());windows.get(destination).add(attribution);
    const row={rowId:key,date,accountId,account,campaignId,campaign,adsetId,adset,adId,ad,project:get('project'),destination,status,event:normalizedEvent,attribution,spend:parseAmount(get('spend'),false,line,'investimento'),conversions:parseAmount(get('conversions'),true,line,'resultados'),clicks:parseAmount(get('clicks'),true,line,'cliques de link'),impressions:parseAmount(get('impressions'),true,line,'impressões')};
    for(const field of ['reach','formOpens','sessions','convertedSessions','waClicks','messageClicks','crmContacts','qualifiedLeads','sales']) row[field]=get(field)&&!['-','—'].includes(get(field))?parseAmount(get(field),true,line,field):null;
    for(const field of ['cohortMature','crmDeduplicated']) row[field]=['true','1','sim','yes'].includes(get(field).toLowerCase());
    for(const field of ['qualityRanking','engagementRanking','conversionRanking'])row[field]=get(field)||null;
    for(const [num,den] of [['reach','impressions'],['convertedSessions','sessions'],['messageClicks','waClicks'],['qualifiedLeads','crmContacts'],['sales','crmContacts']]) if(row[num]!==null&&row[den]!==null&&row[num]>row[den])throw new Error(`Linha ${line}: ${num} não pode ultrapassar ${den}. Confira a origem e a coorte dos dados.`);
    if(destination==='form'&&row.formOpens!==null&&row.conversions>row.formOpens)throw new Error(`Linha ${line}: cadastros não podem ultrapassar as aberturas do formulário.`);
    return row;
  });
  if ([...events.values()].some(e=>e.size>1)) throw new Error('O relatório mistura eventos de conversão no mesmo destino. Use apenas um evento por destino.');
  if([...windows.values()].some(set=>set.size>1))throw new Error('O relatório mistura janelas de atribuição no mesmo destino. Exporte uma única configuração por destino para comparar os resultados.');
  if(grains.size>1)throw new Error('O arquivo mistura totais de campanha, conjuntos e anúncios. Exporte somente um nível para não contar o investimento duas vezes.');
  for(const r of rows){if(r.destination==='whatsapp'&&r.event!=='conversation')throw new Error('WhatsApp deve informar conversas iniciadas, e não cliques ou outro evento. Use event=conversation.');if(['form','site'].includes(r.destination)&&r.event!=='lead')throw new Error('Formulário/site devem informar cadastros enviados. Use event=lead.');}
  // A campanha tem um status único, definido pelo registro mais recente do arquivo.
  const latest = new Map();const entity=r=>r.adId||r.adsetId||r.campaignId;rows.forEach(r => { if (!latest.has(entity(r)) || r.date >= latest.get(entity(r)).date) latest.set(entity(r), r); });
  rows.forEach(r => r.status = latest.get(entity(r)).status);
  return rows;
}
export function csvCell(value) { let s = String(value ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }
export function makeCsv(headers, rows) { return '\uFEFF' + [headers, ...rows].map(r => r.map(csvCell).join(';')).join('\r\n'); }
