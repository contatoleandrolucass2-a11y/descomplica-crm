const chartTooltip=document.createElement('div');
chartTooltip.className='chart-tooltip';
chartTooltip.setAttribute('role','tooltip');
chartTooltip.hidden=true;
chartTooltip.innerHTML='<strong></strong><div class="tooltip-value"></div><div class="tooltip-date"></div>';
document.body.append(chartTooltip);
function hideChartTooltip(){chartTooltip.hidden=true;}
function showChartTooltip(event){
 const point=event.target.closest('.chart svg *');
 const metadata=point?.querySelector(':scope > desc[data-tip-name]')||point?.closest('text')?.querySelector('desc[data-tip-name]');
 if(!metadata){hideChartTooltip();return;}
 const host=event.target.closest('dialog[open]')||document.body;
 if(chartTooltip.parentElement!==host)host.append(chartTooltip);
 chartTooltip.querySelector('strong').textContent=metadata.dataset.tipName;
 chartTooltip.querySelector('.tooltip-value').textContent=metadata.dataset.tipMetric+': '+metadata.dataset.tipValue;
 chartTooltip.querySelector('.tooltip-date').textContent=metadata.dataset.tipDate;
 chartTooltip.hidden=false;
 const box=chartTooltip.getBoundingClientRect();
 chartTooltip.style.left=Math.max(8,Math.min(event.clientX+16,innerWidth-box.width-8))+'px';
 chartTooltip.style.top=Math.max(8,event.clientY+18+box.height>innerHeight?event.clientY-box.height-14:event.clientY+18)+'px';
}
document.addEventListener('pointermove',showChartTooltip);
document.addEventListener('pointerup',showChartTooltip);
document.addEventListener('scroll',hideChartTooltip,true);
document.addEventListener('pointerdown',hideChartTooltip);
document.addEventListener('keydown',event=>{if(event.key==='Escape')hideChartTooltip();});
window.addEventListener('blur',hideChartTooltip);
document.addEventListener('pointerout',event=>{if(!event.relatedTarget)hideChartTooltip();});
