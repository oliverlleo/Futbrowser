const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,Number(value)||0));
const active=list=>(list||[]).filter(player=>player?.probable_starter!==false);
const lower=value=>String(value||'').toLowerCase();

function average(players,filter=()=>true,fallback=60){
  const values=active(players).filter(filter).map(player=>Number(player.ovr||0)).filter(Number.isFinite);
  return values.length?values.reduce((sum,value)=>sum+value,0)/values.length:fallback;
}
function roleOf(player){
  const position=lower(player?.position||player?.primary_position);
  if(position.includes('ponta')||position.includes('wing')||position==='pd'||position==='pe'||position==='rw'||position==='lw')return'wide';
  if(position.includes('atac')||position.includes('striker')||position==='ata'||position==='st')return'forward';
  if(position.includes('zague')||position.includes('center back')||position==='zag'||position==='cb')return'central';
  if(position.includes('lateral')||position==='ld'||position==='le'||position==='rb'||position==='lb')return'fullback';
  if(position.includes('volante')||position==='vol'||position==='dm'||position==='cdm')return'midfield';
  return'midfield';
}
function inferPlan(style,formation){
  const text=`${lower(style)} ${lower(formation)}`;
  if(/press|pressão|pressao|intens/.test(text))return'high_press';
  if(/contra|transi|diret|vertical/.test(text))return'direct_transition';
  if(/posse|constru|cadenc/.test(text))return'possession_control';
  if(/bloco|reativ|defens|compact/.test(text))return'low_block';
  if(/3-4-3|3-5-2|4-3-3/.test(text))return'wide_attack';
  return'balanced';
}
const PLAN_COPY={
  high_press:{label:'Pressão alta',summary:'O rival tenta recuperar a bola ainda no seu campo.',risk:'Deixa espaço às costas da primeira pressão.',exploit:'Saia com um toque, use apoio curto e ataque o espaço que aparece depois do primeiro marcador.',tempo:76,line:5,pressure:'high'},
  direct_transition:{label:'Transição direta',summary:'O rival acelera assim que recupera e procura a última linha.',risk:'Pode ficar previsível quando não encontra espaço para correr.',exploit:'Feche o centro na perda e ataque o lado oposto antes de a defesa recompor.',tempo:66,line:3,pressure:'medium'},
  possession_control:{label:'Controle da posse',summary:'O rival tenta circular até deslocar seu bloco.',risk:'A circulação perde velocidade quando é obrigada a jogar por fora.',exploit:'Mantenha as linhas compactas e pressione o passe de retorno.',tempo:48,line:0,pressure:'medium'},
  low_block:{label:'Bloco baixo',summary:'O rival protege a área e aceita que você tenha a bola.',risk:'Cede pouco espaço por dentro, mas pode sofrer com inversões e segunda bola.',exploit:'Mude o corredor, ataque a linha de fundo e tenha paciência na entrada da área.',tempo:36,line:-5,pressure:'normal'},
  wide_attack:{label:'Ataque pelos lados',summary:'O rival procura amplitude e cruzamentos para empurrar sua defesa.',risk:'Abre espaço entre lateral e volante quando o corredor é fechado.',exploit:'Proteja o lado da bola e acelere por dentro após recuperar.',tempo:58,line:2,pressure:'medium'},
  balanced:{label:'Plano equilibrado',summary:'O rival alterna construção, pressão e ataque direto conforme o placar.',risk:'Ainda não mostrou uma vulnerabilidade dominante.',exploit:'Leia o primeiro quarto de jogo antes de escolher onde concentrar o esforço.',tempo:52,line:0,pressure:'normal'}
};

export function deriveOpponentIdentity(context={}){
  const away=context.away||context.opponent||{},players=away.players||[],planKey=inferPlan(away.play_style,away.formation),copy=PLAN_COPY[planKey]||PLAN_COPY.balanced;
  const wide=average(players,player=>['wide','fullback'].includes(roleOf(player))),central=average(players,player=>['central','midfield'].includes(roleOf(player))),forward=average(players,player=>roleOf(player)==='forward');
  const strengths=[{label:'corredores',value:wide},{label:'centro',value:central},{label:'finalização',value:forward}].sort((a,b)=>b.value-a.value);
  const weakness=[...strengths].sort((a,b)=>a.value-b.value)[0];
  return{
    key:planKey,
    label:copy.label,
    summary:copy.summary,
    risk:copy.risk,
    exploit:copy.exploit,
    tempo:copy.tempo,
    line:copy.line,
    pressure:copy.pressure,
    formation:away.formation||'4-3-3',
    strengths:strengths.slice(0,2).map(item=>({label:item.label,value:Math.round(item.value)})),
    weakness:{label:weakness.label,value:Math.round(weakness.value)},
    scoutingNote:`Força: ${strengths[0].label} (${Math.round(strengths[0].value)}). Ponto de ataque: ${weakness.label} (${Math.round(weakness.value)}).`
  };
}

export function applyOpponentPlan(engine){
  const identity=engine.opponentIdentity;if(!identity||!engine.teamTactics)return;
  engine.teamTactics.away={tempo:identity.tempo,line:identity.line,pressure:identity.pressure};
  engine.opponentPlanApplied=identity.key;
}

export const OPPONENT_PLAN_KEYS=['high_press','direct_transition','possession_control','low_block','wide_attack','balanced'];
