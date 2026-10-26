function chartDimensions(chart){const style=getComputedStyle(chart);return {width:Math.max(80,chart.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)),height:Math.max(40,chart.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom))};}
let metricFitFrame;
function fitMetricValue(){
 cancelAnimationFrame(metricFitFrame);
 metricFitFrame=requestAnimationFrame(()=>{
  for(const root of document.querySelectorAll('#canvas,#expanded-content')){
   const values=[...root.querySelectorAll('.metric-tile strong')];if(!values.length)continue;
   const measure=document.createElement('canvas').getContext('2d');
   let sharedSize=40;
   for(const value of values){
    const tile=value.parentElement,style=getComputedStyle(tile),font=getComputedStyle(value);
    const width=Math.max(1,tile.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-2);
    measure.font=`${font.fontWeight} 40px ${font.fontFamily}`;
    sharedSize=Math.min(sharedSize,40*width/Math.max(1,measure.measureText(value.textContent).width));
   }
   for(const value of values)value.style.fontSize=Math.floor(sharedSize*10)/10+'px';
  }
 });
}
const fittedCharts=new WeakSet();
const chartObserver=new ResizeObserver(entries=>{for(const {target} of entries){if(!target.isConnected)continue;const card=cards.find(c=>c.id===target.closest('.card').dataset.id);if(card){target.innerHTML=plot(card,chartDimensions(target));fitMetricValue(target);}}});
function fitCharts(){document.querySelectorAll('#canvas .chart,#expanded .chart').forEach(chart=>{if(fittedCharts.has(chart))return;fittedCharts.add(chart);chartObserver.observe(chart);fitMetricValue(chart);});}
for(const target of [document.querySelector('#canvas'),document.querySelector('#expanded-content')]){
 if(target)new MutationObserver(fitCharts).observe(target,{childList:true});
}
fitCharts();
