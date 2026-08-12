import { CareerMatchEngine, narrate } from './career-match-engine-v2.js?v=20260811-1';
import { applyRoleFormation, resolveFormationKey } from './career-match-engine-v3.js?v=20260811-1';

const POSITION_ROLE={
  GOL:'gk',GK:'gk',GOLEIRO:'gk',
  LD:'fb',LE:'fb',RB:'fb',LB:'fb','LATERAL DIREITO':'fb','LATERAL ESQUERDO':'fb',LATERAL:'fb',
  ZAG:'cb',CB:'cb',ZAGUEIRO:'cb',
  VOL:'dm',CDM:'dm',VOLANTE:'dm',
  MC:'cm',CM:'cm','MEIO-CAMPISTA':'cm','MEIO CAMPISTA':'cm','MEIA CENTRAL':'cm',
  MEI:'am',CAM:'am',MEIA:'am','MEIA ATACANTE':'am',
  MD:'wing',ME:'wing',RW:'wing',LW:'wing',PD:'wing',PE:'wing','PONTA DIREITA':'wing','PONTA ESQUERDA':'wing',PONTA:'wing','MEIA DIREITA':'wing','MEIA ESQUERDA':'wing',
  ATA:'st',ST:'st',CA:'st',CF:'st',ATACANTE:'st',CENTROAVANTE:'st','CENTRO AVANTE':'st','SEGUNDO ATACANTE':'st'
};

export function roleFromGamePosition(position){
  const key=String(position||'').trim().toUpperCase().replace(/\s+/g,' ');
  return POSITION_ROLE[key]||'cm';
}

function normalizeTeamRoles(players=[]){
  for(const player of players)player.role=roleFromGamePosition(player.position);
}

function pieceFromRoster(row,index,team){
  const position=row.position||row.primary_position||'MC';
  return{
    id:row.id||`${team}-${index}`,
    name:row.name||`Jogador ${index+1}`,
    position,
    ovr:Number(row.ovr||60),
    number:row.number||row.squad_number||index+1,
    team,
    role:roleFromGamePosition(position),
    energy:100,
    yellow:false,
    red:false,
    onField:true,
    x:50,y:50,homeX:50,homeY:50,
    isUser:false,
    chemistry:Number(row.chemistry||50),
    relation:Number(row.relation_score||50),
    rivalry:Boolean(row.rivalry)
  };
}

function rebuildStarterHome(engine){
  if(engine.selection!=='starter')return;
  const rows=Array.isArray(engine.context.home?.players)?engine.context.home.players:[];
  if(!rows.length||!engine.context.player)return;

  const userRole=roleFromGamePosition(engine.context.player.position);
  let starters=rows.filter(row=>row.probable_starter===true);
  const bench=rows.filter(row=>row.probable_starter!==true);

  if(starters.length>10){
    const sameRole=starters
      .filter(row=>roleFromGamePosition(row.position||row.primary_position)===userRole)
      .sort((a,b)=>Number(a.ovr||0)-Number(b.ovr||0))[0];
    const drop=sameRole||starters.slice().sort((a,b)=>Number(a.ovr||0)-Number(b.ovr||0))[0];
    starters=starters.filter(row=>row!==drop);
  }

  for(const row of bench){
    if(starters.length>=10)break;
    if(!starters.some(item=>String(item.id)===String(row.id)))starters.push(row);
  }
  starters=starters.slice(0,10);
  if(starters.length<10)return;

  const oldUser=engine.user||{};
  const user={
    ...oldUser,
    id:engine.context.player.id,
    name:engine.context.player.nickname||engine.context.player.name||'Você',
    position:engine.context.player.position,
    ovr:Number(engine.context.player.ovr||oldUser.ovr||60),
    number:engine.context.player.shirt_number||oldUser.number||0,
    team:'home',
    role:userRole,
    isUser:true,
    onField:true,
    yellow:false,
    red:false,
    energy:Number(oldUser.energy||100),
    attributes:engine.context.player.attributes,
    skills:engine.context.player.skills,
    chemistry:Number(oldUser.chemistry||50),
    relation:Number(oldUser.relation||50),
    x:50,y:50,homeX:50,homeY:50
  };

  engine.home=[...starters.map((row,index)=>pieceFromRoster(row,index,'home')),user];
  engine.user=user;
}

function instructionForRole(role,style,rng=Math.random){
  const instructions={
    gk:['Saia curto quando houver segurança e organize a última linha.','Atenção às bolas nas costas da defesa e comunicação constante.'],
    cb:['Proteja a área, vença a primeira bola e não quebre a linha sem cobertura.','Se formos pressionados, dê segurança na saída e defenda a profundidade.'],
    fb:['Apoie quando houver espaço, mas recomponha rápido pelo corredor.','Feche por dentro sem a bola e escolha bem o momento de ultrapassar.'],
    dm:['Proteja a frente da zaga, faça a cobertura e acelere o primeiro passe.','Controle o corredor central e seja a referência de equilíbrio do time.'],
    cm:['Dê ritmo à posse, aproxime para tabelas e pressione depois da perda.','Conecte defesa e ataque sem abandonar o equilíbrio do meio.'],
    am:['Receba entre linhas, tente o passe vertical e ataque a entrada da área.','Gire entre os volantes e procure o último passe quando a defesa abrir.'],
    wing:['Ataque o espaço atrás do lateral e volte para recomposição.','Parta para o um contra um quando estiver isolado e escolha bem o cruzamento.'],
    st:['Ataque a última linha, ocupe a área e seja agressivo na finalização.','Prenda os zagueiros, faça movimentos de ruptura e pressione a primeira saída.']
  };
  const options=instructions[role]||instructions.cm;
  const text=options[Math.floor(rng()*options.length)]||options[0];
  return style?`${text} Estilo da equipe: ${style}.`:text;
}

if(!CareerMatchEngine.prototype.__roleFormationPatched){
  const originalStart=CareerMatchEngine.prototype.start;

  CareerMatchEngine.prototype.start=function patchedMatchStart(){
    normalizeTeamRoles(this.home);
    normalizeTeamRoles(this.away);
    if(this.user)this.user.role=roleFromGamePosition(this.context.player?.position||this.user.position);
    rebuildStarterHome(this);
    normalizeTeamRoles(this.home);
    normalizeTeamRoles(this.away);

    this.homeFormation=resolveFormationKey(this.context.home?.formation||this.context.club?.formation);
    this.awayFormation=resolveFormationKey(this.context.away?.formation||this.context.opponent?.formation);
    this.coachInstruction=instructionForRole(
      roleFromGamePosition(this.context.player?.position),
      this.context.club?.play_style,
      this.rng
    );

    applyRoleFormation(this.home,this.homeFormation,true);
    applyRoleFormation(this.away,this.awayFormation,false);
    if(this.user)this.user=this.home.find(player=>player.isUser)||this.user;
    this.directOpponent=this.resolveDirectOpponent();
    return originalStart.call(this);
  };

  CareerMatchEngine.prototype.enterUserFromBench=function patchedBenchEntry(){
    const desiredRole=roleFromGamePosition(this.context.player?.position);
    normalizeTeamRoles(this.home);
    normalizeTeamRoles(this.away);
    const candidate=this.home
      .filter(player=>player.onField&&player.role===desiredRole&&player.role!=='gk')
      .sort((a,b)=>a.ovr-b.ovr)[0]
      ||this.home.filter(player=>player.onField&&player.role!=='gk').sort((a,b)=>a.ovr-b.ovr)[0];
    if(!candidate)return;

    candidate.onField=false;
    const player=this.context.player||{};
    const user={
      id:player.id||'career-user',
      name:player.nickname||player.name||'Você',
      position:player.position,
      ovr:Number(player.ovr||60),
      number:player.shirt_number||0,
      team:'home',
      role:desiredRole,
      energy:Math.max(45,Math.min(95,Number(this.context.state?.energy||80)*.7+22)),
      yellow:false,red:false,onField:true,
      x:candidate.x,y:candidate.y,homeX:candidate.homeX,homeY:candidate.homeY,
      isUser:true,
      chemistry:Number(candidate.chemistry||50),relation:Number(candidate.relation||50),
      attributes:player.attributes,skills:player.skills
    };
    this.home.push(user);
    this.user=user;
    this.selection='bench_entered';
    this.directOpponent=this.resolveDirectOpponent();
    this.coachInstruction=instructionForRole(desiredRole,this.context.club?.play_style,this.rng);
    this.feed(narrate('sub',{out:candidate.name,in:user.name},this.rng),'sub',user);
    this.emit('substitution',{minute:this.minute,out:candidate,in:user,instruction:this.coachInstruction});
    this.paused=true;
  };

  CareerMatchEngine.prototype.startSecondHalf=function patchedSecondHalf(){
    if(this.phase!=='halftime')return;
    normalizeTeamRoles(this.home);
    normalizeTeamRoles(this.away);
    this.homeAttacksRight=!this.homeAttacksRight;
    this.phase='second';
    applyRoleFormation(this.home,this.homeFormation||resolveFormationKey(this.context.home?.formation||this.context.club?.formation),this.homeAttacksRight);
    applyRoleFormation(this.away,this.awayFormation||resolveFormationKey(this.context.away?.formation||this.context.opponent?.formation),!this.homeAttacksRight);
    if(this.user)this.user=this.home.find(player=>player.isUser)||this.user;
    this.minute=45;
    this.second=0;
    this.paused=false;
    this.feed(narrate('restart',{},this.rng),'restart');
    this.emit('sidechange',this.snapshot());
  };

  Object.defineProperty(CareerMatchEngine.prototype,'__roleFormationPatched',{value:true,enumerable:false,configurable:false});
}
