import { CareerMatchEngine } from './career-match-engine-v2.js?v=20260811-1';

const PASS_VARIANTS=[
  ({from,to})=>`${from} toca por dentro e encontra ${to}.`,
  ({from,to})=>`${to} se apresenta no apoio e recebe de ${from}.`,
  ({from,to})=>`${from} joga simples com ${to} e mantém a posse viva.`,
  ({from,to})=>`Passe de ${from} para ${to}, que já orienta o corpo para o próximo lance.`,
  ({from,to})=>`${from} acelera a circulação e conecta com ${to}.`,
  ({from,to})=>`${to} aparece no espaço e ${from} coloca a bola no seu pé.`,
  ({from,to})=>`${from} atrai a marcação antes de soltar para ${to}.`,
  ({from,to})=>`Boa aproximação: ${from} encontra ${to} no setor seguinte.`,
  ({from,to})=>`${from} devolve o jogo para ${to} e o time continua se movimentando.`,
  ({from,to})=>`${to} recebe de ${from} com uma linha de passe limpa.`
];

const PHASE_LABELS={
  buildup:'Saída de bola',
  build:'Construção',
  midfield:'Disputa e circulação no meio',
  progression:'Progressão ao último terço',
  final:'Ataque no último terço',
  counter:'Contra-ataque'
};

function currentReceiver(engine){
  return [...engine.home,...engine.away].find(player=>player.id===engine.ball.ownerId&&player.onField)||null;
}

function variedPass(engine,actor){
  if(!actor)return null;
  const receiver=currentReceiver(engine);
  if(!receiver||receiver.id===actor.id)return null;
  engine.__passVariantHistory ||= [];
  const history=engine.__passVariantHistory;
  const available=PASS_VARIANTS.map((fn,index)=>({fn,index})).filter(item=>!history.slice(-4).includes(item.index));
  const pool=available.length?available:PASS_VARIANTS.map((fn,index)=>({fn,index}));
  const chosen=pool[Math.floor(engine.rng()*pool.length)]||pool[0];
  history.push(chosen.index);
  while(history.length>6)history.shift();
  return chosen.fn({from:actor.name,to:receiver.name});
}

function updateFlowUi(payload){
  if(typeof document==='undefined'||!payload?.flow)return;
  const node=document.getElementById('matchTacticalState');
  if(!node)return;
  const flow=payload.flow;
  const extra=flow.transition?' · transição em velocidade':flow.passCount>=4?' · posse já amadurecida':'';
  node.textContent=`${flow.label}${extra}.`;
  node.dataset.flowPhase=flow.phase;
}

if(!CareerMatchEngine.prototype.__flowUiPatched){
  const previousFeed=CareerMatchEngine.prototype.feed;
  const previousSnapshot=CareerMatchEngine.prototype.snapshot;
  const previousEmit=CareerMatchEngine.prototype.emit;

  CareerMatchEngine.prototype.feed=function variedFootballFeed(text,type='play',actor=null){
    let nextText=text;
    if(type==='pass'&&actor&&/encontra .*jogada continua|encontra .*setor seguinte/i.test(String(text))){
      nextText=variedPass(this,actor)||text;
    }
    return previousFeed.call(this,nextText,type,actor);
  };

  CareerMatchEngine.prototype.snapshot=function flowSnapshot(){
    const base=previousSnapshot.call(this);
    const flow=this.matchFlow||{};
    base.flow={
      phase:flow.phase||'buildup',
      label:PHASE_LABELS[flow.phase]||'Jogo em andamento',
      passCount:Number(flow.passCount||0),
      sequenceId:Number(flow.sequenceId||0),
      transition:Boolean(flow.phase==='counter'&&this.minute<=Number(flow.transitionUntil||-1)),
      recentEvents:[...(flow.recentEvents||[])].slice(-5)
    };
    return base;
  };

  CareerMatchEngine.prototype.emit=function flowAwareEmit(name,payload){
    if(name==='frame'||name==='state'||name==='sidechange')updateFlowUi(payload);
    return previousEmit.call(this,name,payload);
  };

  Object.defineProperty(CareerMatchEngine.prototype,'__flowUiPatched',{value:true,enumerable:false,configurable:false});
}
