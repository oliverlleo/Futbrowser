if(!document.querySelector('link[data-match-gameplay-depth-css]')){const link=document.createElement('link');link.rel='stylesheet';link.href='src/pages/career/career-match-gameplay-depth.css?v=20260812-1';link.dataset.matchGameplayDepthCss='1';document.head.appendChild(link);}
let activeEngine=null;

const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

function intensityCopy(mode){
  if(mode==='light')return'Participa menos, economiza energia e pode recuperar um pouco quando o lance está longe.';
  if(mode==='intense')return'Procura mais ações e rupturas, mas o desgaste por minuto aumenta.';
  return'Ritmo equilibrado entre participação, oportunidades e desgaste.';
}

function mountIntensity(engine){
  activeEngine=engine;
  const rail=document.querySelector('.match-left-rail');if(!rail)return;
  let card=document.getElementById('matchIntensityControl');
  if(!card){
    card=document.createElement('article');card.id='matchIntensityControl';card.className='match-mini-card match-intensity-card';
    card.innerHTML=`<span>INTENSIDADE</span><div class="match-intensity-buttons"><button type="button" data-match-intensity="light">Leve<small>conservar</small></button><button type="button" data-match-intensity="moderate" class="active">Moderada<small>equilíbrio</small></button><button type="button" data-match-intensity="intense">Intensa<small>participar mais</small></button></div><p id="matchIntensityHelp">${intensityCopy('moderate')}</p>`;
    const live=rail.querySelector('.match-player-live');
    if(live)live.insertAdjacentElement('afterend',card);else rail.prepend(card);
    card.addEventListener('click',event=>{const button=event.target.closest?.('[data-match-intensity]');if(!button||!activeEngine)return;activeEngine.setMatchIntensity?.(button.dataset.matchIntensity);updateIntensity(button.dataset.matchIntensity);});
  }
  updateIntensity(engine.matchIntensity||'moderate');
}

function updateIntensity(mode){
  document.querySelectorAll('[data-match-intensity]').forEach(button=>button.classList.toggle('active',button.dataset.matchIntensity===mode));
  const help=document.getElementById('matchIntensityHelp');if(help)help.textContent=intensityCopy(mode);
}

function contextLabel(value,kind){
  const n=Math.round(Number(value)||0);
  if(kind==='pressure')return n>=72?'Alta':n>=45?'Média':'Baixa';
  if(kind==='space')return n>=70?'Muito':n>=42?'Médio':'Pouco';
  return n>=72?'Bom':n>=45?'Razoável':'Ruim';
}

function decorateDecision(payload){
  const panel=document.getElementById('matchDecision');if(!panel)return;
  panel.querySelector('.decision-game-context')?.remove();
  const ctx=payload.gameplayContext||{};
  const grid=panel.querySelector('.match-choice-grid');
  if(grid){
    const bar=document.createElement('div');bar.className='decision-game-context';
    bar.innerHTML=`<span><b>Espaço</b>${contextLabel(ctx.space,'space')} · ${Math.round(ctx.space||0)}%</span><span><b>Pressão</b>${contextLabel(ctx.pressure,'pressure')} · ${Math.round(ctx.pressure||0)}%</span><span><b>Ângulo</b>${contextLabel(ctx.angle,'angle')} · ${Math.round(ctx.angle||0)}%</span>`;
    grid.parentElement.insertBefore(bar,grid);
  }
  for(const option of payload.options||[]){
    const button=panel.querySelector(`[data-match-choice="${CSS.escape(String(option.key))}"]`);if(!button)continue;
    button.querySelector('.choice-meta')?.remove();
    const meta=document.createElement('div');meta.className='choice-meta';
    const chanceClass=option.successChance>=70?'good':option.successChance>=45?'mid':'hard';
    meta.innerHTML=`<span class="choice-chance ${chanceClass}"><b>${esc(option.chanceLabel||'Sucesso')}</b>${Math.round(option.successChance||0)}%</span><span class="choice-energy"><b>Energia</b>−${Math.round(option.energyCost||0)}%</span><span class="choice-skill"><b>${esc(option.skill||'habilidade')}</b>${Math.round(option.skillValue||0)}</span>`;
    button.appendChild(meta);
    button.title=option.description||'';
    if(option.rare){button.classList.add('special','rare-choice');const tag=button.querySelector('em');if(tag)tag.textContent='Oportunidade rara';}
  }
}

window.addEventListener('career:match-engine-ready',event=>{
  const engine=event.detail?.engine;if(!engine)return;mountIntensity(engine);engine.on?.('decision',payload=>requestAnimationFrame(()=>decorateDecision(payload)));engine.on?.('state',()=>updateIntensity(engine.matchIntensity||'moderate'));
});
window.addEventListener('career:match-intensity-changed',event=>updateIntensity(event.detail?.mode||'moderate'));
