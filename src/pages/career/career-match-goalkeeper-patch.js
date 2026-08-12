import { CareerMatchEngine } from './career-match-engine-v2.js?v=20260811-1';
import { roleFromGamePosition } from './career-match-formation-patch.js?v=20260811-2';

const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,Number(v)||0));
const pick=(arr,rng=Math.random)=>arr[Math.floor(rng()*arr.length)]||arr[0];
const jitter=(rng,amount=1)=>(rng()*2-1)*amount;

const KEEPER_NARRATION={
  danger:['O adversário entra na zona de finalização. O goleiro precisa decidir rápido.','A defesa é quebrada e o atacante fica de frente para o gol.','Perigo real na área! O goleiro organiza os últimos passos.','A jogada atravessa a última linha e agora é duelo com o goleiro.'],
  shot:['Finalização forte buscando o canto!','O atacante ajeita o corpo e bate!','Chute vindo de dentro da área!','A bola sai rápida em direção ao gol!'],
  save:['DEFENDE! Grande intervenção do goleiro!','Que defesa! Reflexo decisivo para impedir o gol.','O goleiro fecha o espaço e salva a equipe!','Espalma para longe! Excelente resposta no lance.','Segura firme! O goleiro transmite segurança.'],
  concede:['A bola passa pelo goleiro e entra.','Dessa vez não deu para chegar: bola na rede.','O atacante encontra o espaço e vence o goleiro.'],
  cross:['Cruzamento fechado entrando na pequena área.','A bola vem alta e perigosa para dentro da área.','Cruzamento com muita gente atacando a zona do goleiro.'],
  claim:['Sai do gol e fica com ela! Boa leitura.','O goleiro domina a área e segura o cruzamento.','Subida segura para tirar a bola do alcance dos atacantes.','Boa saída! O perigo termina nas mãos do goleiro.'],
  punch:['O goleiro soca para longe e limpa a área.','Saída firme para afastar de punho.','Não dá para segurar; ele afasta para uma zona segura.'],
  distribution:['O goleiro olha o campo e prepara a reposição.','Bola nas mãos. É hora de escolher como reiniciar a construção.','A equipe abre o campo para receber a saída do goleiro.'],
  short:['Reposição curta para começar desde trás.','O goleiro encontra o defensor livre e entrega com segurança.','Saída curta e controlada para manter a posse.'],
  long:['Reposição longa tentando ganhar território.','O goleiro acelera e busca o ataque com bola longa.','Lançamento comprido para escapar da primeira pressão.']
};

function keeperFeed(engine,type){engine.feed(pick(KEEPER_NARRATION[type],engine.rng),type==='save'?'shot_saved':type==='concede'?'goal':'play',engine.user);}
function teamStat(engine,team,key,inc=1){engine.stats[team][key]=(engine.stats[team][key]||0)+inc;}
function keeperRating(engine,delta,reason){engine.rating=clamp(Math.round((engine.rating+delta)*10)/10,1,10);engine.ratingLog.push({minute:engine.minute,value:delta,reason,rating:engine.rating});}
function nearestThreat(engine){return engine.away.filter(p=>p.onField&&!p.red&&['st','wing','am'].includes(p.role)).sort((a,b)=>b.ovr-a.ovr)[0]||engine.away.find(p=>p.onField&&!p.red);}
function safeReceiver(engine,long=false){const roles=long?['wing','st','am','cm']:['cb','fb','dm','cm'];return engine.home.filter(p=>p.onField&&!p.red&&!p.isUser&&roles.includes(p.role)).sort((a,b)=>b.ovr-a.ovr)[0]||engine.home.find(p=>p.onField&&!p.red&&!p.isUser);}

function keeperSkill(engine,key){
  const s=engine.userSkills||{};
  if(key==='reaction')return(s.tactical*.38+s.pace*.22+s.physical*.18+s.positioning*.22);
  if(key==='rush')return(s.pace*.28+s.physical*.30+s.positioning*.22+s.tactical*.20);
  if(key==='position')return(s.positioning*.42+s.tactical*.33+s.physical*.15+s.vision*.10);
  if(key==='claim')return(s.heading*.24+s.physical*.31+s.positioning*.30+s.tactical*.15);
  if(key==='short')return(s.shortPass*.62+s.vision*.38);
  if(key==='long')return(s.longPass*.62+s.vision*.38);
  return engine.user?.ovr||60;
}

function keeperContest(engine,skillKey,difficultyBonus=0){
  const skill=keeperSkill(engine,skillKey),prep=Number(engine.userPreparation||70),mental=Number(engine.mentalStability||70),energy=Number(engine.user?.energy||70),threat=Number(engine.goalkeeperThreat?.ovr||nearestThreat(engine)?.ovr||62);
  return skill*.54+prep*.17+mental*.15+energy*.12-threat*.45-difficultyBonus+jitter(engine.rng,7);
}

function setBall(engine,player){if(!player)return;engine.ball.ownerId=player.id;engine.ball.x=player.x;engine.ball.y=player.y;}

function keeperSituation(engine){
  const distribution=engine.possession==='home'&&engine.rng()<.46;
  if(distribution){
    setBall(engine,engine.user);
    keeperFeed(engine,'distribution');
    return{
      key:'gk_distribution',
      title:'A bola está com você. Como reiniciar a jogada?',
      options:[
        {key:'gk_short',label:'Sair curto com um defensor',keeperSkill:'short',cost:1},
        {key:'gk_long',label:'Buscar o ataque com reposição longa',keeperSkill:'long',cost:2},
        {key:'gk_hold',label:'Esperar o time abrir e reduzir o risco',keeperSkill:'position',cost:0}
      ]
    };
  }

  engine.possession='away';
  const threat=nearestThreat(engine);engine.goalkeeperThreat=threat;
  if(threat){
    const ownLeft=engine.homeAttacksRight;
    threat.x=ownLeft?18:82;
    threat.y=42+engine.rng()*16;
    setBall(engine,threat);
  }
  const roll=engine.rng();
  if(roll<.30){
    keeperFeed(engine,'cross');
    return{key:'gk_cross',title:'Cruzamento fechado entrando na sua zona',options:[
      {key:'gk_claim',label:'Sair para segurar no alto',keeperSkill:'claim',cost:4},
      {key:'gk_punch',label:'Atacar a bola e socar para longe',keeperSkill:'rush',cost:5},
      {key:'gk_line_cross',label:'Ficar na linha e reagir à finalização',keeperSkill:'reaction',cost:2}
    ]};
  }
  keeperFeed(engine,'danger');
  return{key:'gk_shot',title:'O atacante entra em condição clara de finalizar',options:[
    {key:'gk_set',label:'Manter posição e fechar o ângulo',keeperSkill:'position',cost:3},
    {key:'gk_react',label:'Esperar a batida e confiar no reflexo',keeperSkill:'reaction',cost:3},
    {key:'gk_rush',label:'Sair rápido para abafar',keeperSkill:'rush',cost:6},
    ...(Number(engine.mentalStability||0)>=78?[{key:'gk_read_body',label:'Ler o corpo do atacante e antecipar o canto',keeperSkill:'position',cost:3,special:true}]:[])
  ]};
}

function resolveKeeperChoice(engine,choice,situation){
  engine.playerStats.keeperActions=(engine.playerStats.keeperActions||0)+1;
  engine.playerStats.saves=engine.playerStats.saves||0;
  engine.playerStats.claims=engine.playerStats.claims||0;
  engine.playerStats.keeperErrors=engine.playerStats.keeperErrors||0;
  engine.user.energy=clamp(engine.user.energy-(choice.cost||0));

  if(situation.key==='gk_distribution'){
    if(choice.key==='gk_hold'){
      const leading=engine.score.home>engine.score.away&&engine.minute>70;
      keeperRating(engine,leading?.03:(engine.score.home<engine.score.away&&engine.minute>70?-.04:0),'Controle do ritmo na reposição');
      return{success:true,choice,score:50};
    }
    const long=choice.key==='gk_long',receiver=safeReceiver(engine,long),score=keeperContest(engine,choice.keeperSkill,long?7:-5),success=score>=39;
    teamStat(engine,'home','passesAttempted');engine.playerStats.passesAttempted++;
    keeperFeed(engine,long?'long':'short');
    if(success&&receiver){teamStat(engine,'home','passesCompleted');engine.playerStats.passesCompleted++;engine.possession='home';setBall(engine,receiver);keeperRating(engine,.04,'Boa reposição do goleiro');}
    else{engine.possession='away';const rival=nearestThreat(engine);if(rival)setBall(engine,rival);keeperRating(engine,-.05,'Reposição perdida');}
    return{success,choice,score};
  }

  if(situation.key==='gk_cross'){
    const score=keeperContest(engine,choice.keeperSkill,choice.key==='gk_claim'?2:choice.key==='gk_line_cross'?7:4),success=score>=39;
    if(success){engine.possession='home';setBall(engine,engine.user);if(choice.key==='gk_claim'){engine.playerStats.claims++;keeperFeed(engine,'claim');keeperRating(engine,.16,'Saída segura em cruzamento');}else{keeperFeed(engine,'punch');keeperRating(engine,.10,'Intervenção em bola aérea');}}
    else{
      teamStat(engine,'away','shots');teamStat(engine,'away','shotsOnTarget');
      if(engine.rng()<.46){engine.score.away++;teamStat(engine,'away','goals');keeperFeed(engine,'concede');keeperRating(engine,-.28,'Gol sofrido após cruzamento');engine.possession='home';}
      else{engine.playerStats.saves++;keeperFeed(engine,'save');keeperRating(engine,.13,'Defesa após segunda bola');engine.possession='home';setBall(engine,engine.user);}
    }
    return{success,choice,score};
  }

  teamStat(engine,'away','shots');teamStat(engine,'away','shotsOnTarget');keeperFeed(engine,'shot');
  const bonus=choice.key==='gk_read_body'?-4:choice.key==='gk_rush'?3:0,score=keeperContest(engine,choice.keeperSkill,bonus),success=score>=39;
  if(success){engine.playerStats.saves++;engine.possession='home';setBall(engine,engine.user);keeperFeed(engine,'save');const late=engine.minute>=75&&Math.abs(engine.score.home-engine.score.away)<=1;keeperRating(engine,late?.34:.24,late?'Defesa decisiva':'Defesa importante');}
  else{engine.score.away++;teamStat(engine,'away','goals');engine.possession='home';engine.playerStats.keeperErrors+=(score<28?1:0);keeperFeed(engine,'concede');keeperRating(engine,score<28?-.38:-.22,score<28?'Erro no lance do gol':'Gol sofrido');}
  return{success,choice,score};
}

function renderKeeperLiveStats(engine){
  if(typeof document==='undefined'||roleFromGamePosition(engine.context.player?.position)!=='gk')return;
  const target=document.getElementById('matchPlayerStats');if(!target)return;
  const p=engine.playerStats,rate=p.passesAttempted?Math.round(p.passesCompleted/p.passesAttempted*100):0;
  target.innerHTML=`<div><span>Defesas</span><b>${p.saves||0}</b></div><div><span>Saídas altas</span><b>${p.claims||0}</b></div><div><span>Ações</span><b>${p.keeperActions||0}</b></div><div><span>Passes</span><b>${p.passesCompleted}/${p.passesAttempted}</b></div><div><span>Precisão</span><b>${rate}%</b></div><div><span>Erros graves</span><b>${p.keeperErrors||0}</b></div>`;
}

if(!CareerMatchEngine.prototype.__goalkeeperGameplayPatched){
  const originalStart=CareerMatchEngine.prototype.start;
  const originalOpenMoment=CareerMatchEngine.prototype.openUserMoment;
  const originalChoose=CareerMatchEngine.prototype.choose;

  CareerMatchEngine.prototype.start=function goalkeeperAwareStart(){
    const result=originalStart.call(this);
    if(this.user?.role==='gk'||roleFromGamePosition(this.context.player?.position)==='gk'){
      this.playerStats.saves=0;this.playerStats.claims=0;this.playerStats.keeperActions=0;this.playerStats.keeperErrors=0;
      this.on('frame',()=>renderKeeperLiveStats(this));this.on('state',()=>renderKeeperLiveStats(this));
      this.on('final',()=>{if(typeof document==='undefined')return;setTimeout(()=>{const cards=[...document.querySelectorAll('.postgame-grid article')];if(cards[1])cards[1].innerHTML=`<span>NO GOL</span><strong>${this.playerStats.saves||0} defesas</strong><p>${this.playerStats.claims||0} saídas altas · ${this.playerStats.keeperErrors||0} erro(s) grave(s)</p>`;if(cards[2])cards[2].innerHTML=`<span>JOGO COM OS PÉS</span><strong>${this.playerStats.passesCompleted}/${this.playerStats.passesAttempted} passes</strong><p>${this.playerStats.keeperActions||0} ações específicas de goleiro</p>`;},0);});
    }
    return result;
  };

  CareerMatchEngine.prototype.openUserMoment=function goalkeeperMoment(){
    if(this.user?.role!=='gk')return originalOpenMoment.call(this);
    this.userMoments++;this.nextUserMoment=this.minute+4+Math.floor(this.rng()*6);
    const situation=keeperSituation(this);this.pendingDecision={situation,options:situation.options,chain:0,goalkeeper:true};this.paused=true;this.awaitingDecision=true;
    this.emit('decision',{minute:this.minute,title:situation.title,options:situation.options.map(item=>({...item,tags:item.special?['special']:[]})),energy:this.user.energy,rating:this.rating,instruction:this.coachInstruction,directOpponent:this.goalkeeperThreat?{name:this.goalkeeperThreat.name,position:this.goalkeeperThreat.position,ovr:this.goalkeeperThreat.ovr}:null});
  };

  CareerMatchEngine.prototype.choose=function goalkeeperChoice(key){
    if(!this.pendingDecision?.goalkeeper||this.user?.role!=='gk')return originalChoose.call(this,key);
    if(!this.awaitingDecision)return null;
    const choice=this.pendingDecision.options.find(item=>item.key===key);if(!choice)return null;
    const result=resolveKeeperChoice(this,choice,this.pendingDecision.situation);
    this.emit('choice',{...result,minute:this.minute,rating:this.rating,energy:this.user.energy});
    this.pendingDecision=null;this.awaitingDecision=false;this.paused=false;this.emit('state',this.snapshot());return result;
  };

  Object.defineProperty(CareerMatchEngine.prototype,'__goalkeeperGameplayPatched',{value:true,enumerable:false,configurable:false});
}
