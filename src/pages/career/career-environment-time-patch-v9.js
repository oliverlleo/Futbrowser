const nightOnly=new Set(['early_sleep','night_out']);

function isNight(){
  return String(document.getElementById('periodBadge')?.textContent||'').trim().toLowerCase()==='noite';
}

function alignEnvironment(){
  document.querySelectorAll('#environmentList .environment-item').forEach(item=>{
    const state=item.querySelector('.environment-state');
    const trend=item.querySelector('.environment-trend');
    item.style.display='grid';
    item.style.gridTemplateColumns='minmax(0, 1fr) 86px 18px';
    item.style.columnGap='8px';
    item.style.justifyContent='initial';
    if(state){state.style.minWidth='72px';state.style.textAlign='center';state.style.justifySelf='start';state.style.whiteSpace='nowrap';}
    if(trend){trend.style.marginLeft='0';trend.style.width='18px';trend.style.textAlign='center';trend.style.justifySelf='end';}
  });
}

function hideWrongPeriodActivities(){
  if(isNight())return;
  document.querySelectorAll('#activityGrid [data-activity]').forEach(card=>{
    if(nightOnly.has(card.dataset.activity))card.remove();
  });
}

function sync(){alignEnvironment();hideWrongPeriodActivities();}

document.addEventListener('career:hub-rendered',sync);
document.addEventListener('career:activities-rendered',hideWrongPeriodActivities);
sync();