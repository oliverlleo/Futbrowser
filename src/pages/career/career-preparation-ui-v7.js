import { supabase } from '../../services/supabase-client.js';

let preparation=null;
let pending=null;

const GUIDANCE={
  rest_home:{tags:['Energia','Recuperação natural'],note:'Recupera bem a disposição e alivia parte da estafa, mas não apaga sozinho a carga muscular de uma semana pesada.'},
  early_sleep:{tags:['Energia amanhã','Recuperação natural'],note:'Encerra o dia mais cedo para recuperar melhor durante a noite. Só fica disponível no período noturno.'},
  mobility:{tags:['Carga muscular','Prevenção'],note:'Recuperação leve e gratuita para diminuir tensão muscular. É útil para manter o corpo controlado sem gastar um período em tratamento mais forte.'},
  sauna:{tags:['Carga muscular','Estafa'],note:'Acelera a regeneração mais do que o descanso comum. Faz mais sentido quando a carga recente ou a estafa já estão subindo.'},
  nutrition_session:{tags:['Preparação','Recuperação'],note:'Melhora a recuperação do dia seguinte e ajuda a baixar carga acumulada. O valor pago compra eficiência quando o calendário está apertado.'},
  physio:{tags:['Carga muscular','Prevenção'],note:'É a opção mais forte para reduzir carga muscular e ainda cria proteção preventiva. Quando existe lesão ou sobrecarga, também ajuda no retorno.'},
  sports_psychologist:{tags:['Mental','Pressão'],note:'Trabalha estabilidade mental e pressão. Isso entra na preparação e influencia a execução das decisões em campo.'},
  family_time:{tags:['Vida pessoal','Mental'],note:'Ajuda a manter equilíbrio fora do futebol e melhora estabilidade mental. Ignorar a vida pessoal por semanas passa a cobrar preço.'},
  gaming_friends:{tags:['Vida pessoal','Pressão'],note:'Tira a cabeça do futebol e reduz pressão, mas perto do jogo à noite pode atrapalhar um pouco a preparação física.'},
  team_hangout:{tags:['Vestiário','Química'],note:'Fortalece o ambiente do elenco. Uma relação melhor com o vestiário melhora combinações como passes, tabelas e criação coletiva.'},
  night_out:{tags:['Moral','Preparação ↓'],note:'Pode aliviar bastante a cabeça, mas cobra energia, estafa e preparação. Por ser uma saída noturna, só aparece à noite.'},
  agent_meeting:{tags:['Empresário','Oportunidades'],note:'Mantém sua carreira ativa com o empresário. Contato recente melhora a chance de aparecerem oportunidades comerciais compatíveis com sua imagem.'},
  media_interview:{tags:['Mídia','Exposição'],note:'Aumenta presença pública e pode ajudar oportunidades comerciais, mas exposição também pode aumentar pressão.'},
  social_media_post:{tags:['Imagem','Exposição'],note:'Mantém sua presença pública ativa. O efeito depende da sua fama e do momento da carreira.'},
  fan_meet:{tags:['Torcida','Imagem'],note:'Aproxima você da torcida e fortalece imagem pública. O impacto cresce quando sua carreira ganha visibilidade.'},
  community_action:{tags:['Imagem','Diretoria'],note:'Fortalece imagem pública, torcida e percepção da diretoria. É uma escolha de carreira, não apenas texto de ambientação.'},
  sponsor_event:{tags:['Dinheiro','Imagem'],note:'Transforma exposição em recompensa financeira e imagem. O perfil da marca define onde o impacto é maior.'},
  watch_match_analysis:{tags:['Tática','Preparação'],note:'Gera desenvolvimento tático real sem acrescentar carga física relevante. É uma alternativa útil quando o corpo precisa de controle.'}
};

const TRAINING_KEYS=new Set(['sprint','strength','endurance','heading_session','defensive_session','teammate_extra','dribble_session','finishing','passing','free_kicks','penalty_practice','tactical_study']);
const ENV_KEYS=['coach','locker_room','fans','media','board','agent','public_image','personal_life'];
const NIGHT_ONLY_KEYS=new Set(['early_sleep','night_out']);

function ensureStyle(){
  if(document.querySelector('link[data-career-preparation-v7]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';link.href='src/pages/career/career-preparation-ui-v7.css?v=20260813-2';link.dataset.careerPreparationV7='1';document.head.appendChild(link);
}

async function loadPreparation(force=false){
  if(preparation&&!force)return preparation;
  if(pending)return pending;
  pending=supabase.rpc('get_career_preparation_status').then(({data,error})=>{if(error)throw error;preparation=data||null;return preparation;}).finally(()=>{pending=null;});
  return pending;
}

function areaLabel(key){return({legs:'pernas',posterior:'posterior',core:'core',upper:'parte superior'})[key]||'corpo';}
function trendGlyph(trend){return trend==='up'?'↑':trend==='down'?'↓':'→';}
function isNightPeriod(){return String(document.getElementById('periodBadge')?.textContent||'').trim().toLowerCase()==='noite';}

function renderPhysical(){
  const p=preparation?.physical;if(!p)return;
  const risk=document.getElementById('injuryRisk');
  const detail=document.getElementById('injuryStatusText');
  if(risk)risk.textContent=p.risk||'Baixo';
  if(detail){
    if(Number(p.injury_days||0)>0)detail.textContent=`${p.injury_label||'Em recuperação'} · ${p.injury_days} dia${Number(p.injury_days)===1?'':'s'}`;
    else if(Number(p.overload_days||0)>0)detail.textContent=`Sobrecarga · ${p.overload_days} dia${Number(p.overload_days)===1?'':'s'} · carga leve liberada`;
    else detail.textContent=`Carga ${String(p.load_label||'leve').toLowerCase()} · ${areaLabel(p.most_loaded_area)} mais exigido`;
  }
  const riskCard=risk?.closest('.condition-card');
  if(riskCard){riskCard.dataset.physicalRisk=String(p.risk||'baixo').toLowerCase().replaceAll(' ','-');riskCard.title=`Carga recente ${p.acute_load}/100. Energia e estafa não contam a história inteira: a carga acumulada também afeta preparação e risco.`;}
}

function renderEnvironment(){
  const env=preparation?.environment||{};
  document.querySelectorAll('#environmentList .environment-item').forEach((item,index)=>{
    const key=ENV_KEYS[index],value=env[key];if(!key||!value)return;
    const strong=item.querySelector('.environment-state');if(!strong)return;
    strong.textContent=value.label||'Estável';
    let trend=item.querySelector('.environment-trend');
    if(!trend){trend=document.createElement('span');trend.className='environment-trend';strong.insertAdjacentElement('afterend',trend);}
    trend.textContent=trendGlyph(value.trend);trend.dataset.trend=value.trend||'stable';
    item.style.display='grid';item.style.gridTemplateColumns='minmax(0, 1fr) 86px 18px';item.style.columnGap='8px';item.style.justifyContent='initial';
    strong.style.minWidth='72px';strong.style.textAlign='center';strong.style.justifySelf='start';
    trend.style.marginLeft='0';trend.style.width='18px';trend.style.textAlign='center';trend.style.justifySelf='end';
    item.dataset.environmentKey=key;item.title=value.hint||'';item.tabIndex=0;
  });
}

function guidanceFor(key,category){
  if(GUIDANCE[key])return GUIDANCE[key];
  if(category==='training')return{tags:['Evolução','Carga física'],note:'Desenvolve habilidades de forma direta, mas acrescenta carga ao corpo. Repetir sessões pesadas sem recuperação aumenta o risco progressivamente.'};
  if(category==='recovery')return{tags:['Recuperação','Condição física'],note:'Ajuda sua condição física. Cada opção atua de forma diferente sobre energia, estafa, carga muscular ou prevenção.'};
  if(category==='social')return{tags:['Relações','Mental'],note:'Afeta relações e equilíbrio mental. Esses estados deixam de ser permanentes e passam a responder ao que você faz nas últimas semanas.'};
  return{tags:['Carreira','Imagem'],note:'Afeta sua carreira fora de campo e pode alterar exposição, relações e oportunidades.'};
}

function decorateActivities(){
  const night=isNightPeriod();
  document.querySelectorAll('#activityGrid [data-activity]').forEach(card=>{
    const key=card.dataset.activity;
    if(NIGHT_ONLY_KEYS.has(key)&&!night){card.remove();return;}
    const category=card.closest('#activityGrid')&&document.querySelector('.activity-tab.active')?.dataset.category||'';
    const guide=guidanceFor(key,category);
    card.querySelector('.activity-impact-chips')?.remove();
    const chips=document.createElement('div');chips.className='activity-impact-chips';chips.innerHTML=guide.tags.slice(0,2).map(tag=>`<span>${tag}</span>`).join('');
    const meta=card.querySelector('.activity-meta');if(meta)meta.insertAdjacentElement('beforebegin',chips);else card.appendChild(chips);
  });
}

function renderEnvironmentHint(item){
  const key=item?.dataset.environmentKey,value=preparation?.environment?.[key];if(!value)return;
  const wasOpen=item.classList.contains('show-environment-hint');
  document.querySelectorAll('.environment-item.show-environment-hint').forEach(node=>{node.classList.remove('show-environment-hint');node.querySelector('.environment-inline-hint')?.remove();});
  if(wasOpen)return;
  const hint=document.createElement('p');hint.className='environment-inline-hint';hint.textContent=value.hint||'';item.appendChild(hint);item.classList.add('show-environment-hint');
}

function applyOverloadRestriction(key){
  const overloaded=Number(preparation?.physical?.overload_days||0)>0;
  if(!overloaded||!TRAINING_KEYS.has(key))return;
  const light=document.querySelector('[data-intensity="light"]');
  document.querySelectorAll('[data-intensity]').forEach(button=>{const allow=button.dataset.intensity==='light';button.disabled=!allow;button.title=allow?'Carga leve liberada durante a sobrecarga.':'Carga normal ou intensa pode agravar a sobrecarga.';});
  if(light&&!light.classList.contains('active'))light.click();
}

function decorateActivityModal(key){
  const modal=document.getElementById('activityModal');if(!modal||modal.classList.contains('hidden'))return;
  modal.querySelector('.activity-impact-modal')?.remove();
  const category=document.querySelector('.activity-tab.active')?.dataset.category||'';
  const guide=guidanceFor(key,category);
  const block=document.createElement('div');block.className='activity-impact-modal';
  const physical=preparation?.physical||{};
  block.innerHTML=`<div><span>IMPACTO PRINCIPAL</span><strong>${guide.tags.join(' · ')}</strong></div><p>${guide.note}</p>${category==='recovery'?`<small>Agora: carga ${String(physical.load_label||'leve').toLowerCase()} · estafa ${physical.fatigue??'—'} · risco ${String(physical.risk||'baixo').toLowerCase()}.</small>`:''}`;
  const desc=modal.querySelector('.modal-description');desc?.insertAdjacentElement('afterend',block);
  applyOverloadRestriction(key);
}

async function sync(force=false){
  try{await loadPreparation(force);renderPhysical();renderEnvironment();decorateActivities();}
  catch(error){console.warn('[Career preparation] contexto indisponível:',error?.message||error);}
}

ensureStyle();sync();
document.addEventListener('career:hub-rendered',()=>sync(true));
document.addEventListener('career:activities-rendered',()=>decorateActivities());
document.addEventListener('click',event=>{
  const env=event.target.closest?.('#environmentList .environment-item');if(env){renderEnvironmentHint(env);return;}
  const card=event.target.closest?.('#activityGrid [data-activity]');if(card)setTimeout(()=>decorateActivityModal(card.dataset.activity),0);
});
document.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.matches?.('#environmentList .environment-item')){event.preventDefault();renderEnvironmentHint(event.target);}});
