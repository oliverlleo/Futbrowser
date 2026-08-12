const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,Number(v)||0));
const pick=(arr,rng=Math.random)=>arr[Math.floor(rng()*arr.length)]||arr[0];
const jitter=(rng,amount=1)=>(rng()*2-1)*amount;
const round1=v=>Math.round(v*10)/10;

export const FORMATIONS={
  '4-3-3':[[7,50],[24,16],[24,38],[24,62],[24,84],[47,25],[45,50],[47,75],[73,18],[78,50],[73,82]],
  '4-2-3-1':[[7,50],[24,16],[24,38],[24,62],[24,84],[43,38],[43,62],[63,20],[61,50],[63,80],[79,50]],
  '4-4-2':[[7,50],[24,16],[24,38],[24,62],[24,84],[50,16],[47,39],[47,61],[50,84],[76,38],[76,62]],
  '4-1-4-1':[[7,50],[24,16],[24,38],[24,62],[24,84],[40,50],[57,15],[55,40],[55,60],[57,85],[79,50]],
  '3-5-2':[[7,50],[25,25],[23,50],[25,75],[49,10],[47,32],[43,50],[47,68],[49,90],[76,38],[76,62]],
  '3-4-3':[[7,50],[24,25],[22,50],[24,75],[48,15],[45,39],[45,61],[48,85],[75,18],[79,50],[75,82]],
  '5-3-2':[[7,50],[25,10],[22,29],[21,50],[22,71],[25,90],[49,28],[46,50],[49,72],[76,38],[76,62]]
};

const POSITION_GROUP={
  GOL:'gk',GK:'gk',LD:'fb',LE:'fb',RB:'fb',LB:'fb',ZAG:'cb',CB:'cb,
  VOL:'dm',CDM:'dm',MC:'cm',CM:'cm',MEI:'am',CAM:'am',MD:'wing',ME:'wing',RW:'wing',LW:'wing',PD:'wing',PE:'wing',ATA:'st',ST:'st',CA:'st',CF:'st'
};

const normalizePosition=p=>String(p||'').trim().toUpperCase();
const roleOf=p=>POSITION_GROUP[normalizePosition(p)]||'cm';

export const NARRATOR_LIBRARY={
  kickoff:[
    'Rola a bola! Começa o jogo.',
    'Apita o árbitro. Está valendo!',
    'Tudo pronto, bola em jogo!',
    'Começa a partida. Noventa minutos pela frente.'
  ],
  possession:[
    '{team} troca passes e tenta encontrar espaço.',
    '{team} trabalha a bola com paciência no campo ofensivo.',
    'A posse é de {team}, que gira de um lado para o outro.',
    '{team} mantém a bola e empurra o adversário para trás.',
    'Circulação rápida de {team} buscando uma brecha.'
  ],
  pressure:[
    'Pressão forte de {team}! A defesa precisa sair jogando sob aperto.',
    '{team} adianta as linhas e encurta o campo.',
    'Marcação alta de {team}; pouco espaço para respirar.',
    'A linha defensiva é pressionada e precisa decidir rápido.'
  ],
  pass:[
    'Passe firme de {from} para {to}.',
    '{from} encontra {to} entre as linhas.',
    '{from} acelera a jogada e serve {to}.',
    'Boa circulação: {from} toca para {to}.',
    '{to} recebe de {from} e já levanta a cabeça.'
  ],
  long_pass:[
    '{from} muda o corredor com uma bola longa.',
    'Inversão de jogo de {from}; a defesa precisa bascular.',
    '{from} procura o espaço nas costas com lançamento comprido.',
    'Bola esticada de {from} para acelerar o ataque.'
  ],
  dribble_success:[
    '{player} parte para cima e passa pelo marcador!',
    'Que mudança de direção de {player}! Marcador ficou para trás.',
    '{player} ganha no um contra um e mantém a jogada viva.',
    '{player} encontra espaço no drible e progride.'
  ],
  dribble_fail:[
    '{player} tenta o drible, mas a marcação leva a melhor.',
    'O marcador lê a intenção de {player} e recupera.',
    '{player} força a jogada individual e perde a bola.',
    'Boa contenção defensiva; o drible de {player} não entra.'
  ],
  shot:[
    '{player} ajeita e bate para o gol!',
    '{player} encontrou espaço para finalizar!',
    'Chute de {player}!',
    '{player} arrisca a conclusão.'
  ],
  shot_saved:[
    'Defende o goleiro! Boa intervenção.',
    'O goleiro cai bem e segura.',
    'Grande defesa! O chute tinha endereço.',
    'O goleiro espalma e evita o gol.'
  ],
  shot_off:[
    'Para fora! A finalização não encontra o alvo.',
    'Passou perto, mas saiu.',
    'A bola sobe demais e vai pela linha de fundo.',
    'Faltou precisão na conclusão.'
  ],
  block:[
    'A zaga trava a finalização no momento certo.',
    'Bloqueio defensivo! O chute não passa.',
    'O defensor se joga na frente e corta o perigo.',
    'A defesa fecha o espaço e bloqueia.'
  ],
  goal:[
    'GOOOOOOL! {player} manda para a rede!',
    'É GOL! {player} vence o goleiro!',
    'Bola na rede! {player} muda o placar!',
    'GOOOOOL! A torcida explode com {player}!'
  ],
  corner:[
    'Desvio na defesa: escanteio para {team}.',
    'A bola sai pela linha de fundo. Vem escanteio.',
    '{team} ganha um tiro de canto.',
    'Pressão termina em escanteio.'
  ],
  foul:[
    'Falta marcada. O árbitro interrompe a jogada.',
    'Chegada atrasada e falta assinalada.',
    'Contato forte; o árbitro apita.',
    'Infração marcada no lance.'
  ],
  yellow:[
    'Cartão amarelo! O árbitro não deixa passar.',
    'Amarelo mostrado após a falta.',
    'Advertência para o jogador; cartão amarelo.'
  ],
  red:[
    'CARTÃO VERMELHO! Está expulso!',
    'Vermelho direto! O time fica com um a menos.',
    'Segundo amarelo e expulsão!' 
  ],
  tackle:[
    'Desarme limpo! A defesa recupera.',
    'Excelente bote defensivo e bola recuperada.',
    'O defensor antecipa e mata a jogada.',
    'Boa leitura defensiva para retomar a posse.'
  ],
  interception:[
    'Interceptação importante no corredor central.',
    'A linha de passe é fechada e a bola muda de dono.',
    'Leitura perfeita para cortar o passe.',
    'Antecipação defensiva e recuperação.'
  ],
  cross:[
    'Cruzamento na área!',
    'Bola levantada buscando os atacantes.',
    'Vem bola pelo alto para a área.',
    'Cruzamento perigoso vindo do lado.'
  ],
  aerial:[
    'Disputa pelo alto na área!',
    'Subida forte para o cabeceio.',
    'Bola aérea e duelo pesado entre os jogadores.',
    'Choque no alto para definir quem fica com a bola.'
  ],
  counter:[
    'Contra-ataque rápido! Campo aberto pela frente.',
    'Transição veloz e a defesa corre para trás.',
    'Recuperação e aceleração imediata no contra-ataque.',
    'O time dispara com espaço após recuperar a bola.'
  ],
  halftime:[
    'Fim do primeiro tempo. As equipes vão para o intervalo.',
    'Intervalo de jogo. Hora de reorganizar as ideias.',
    'Termina a primeira etapa.'
  ],
  restart:[
    'Começa o segundo tempo. Os lados do campo estão invertidos.',
    'Bola rolando novamente para a etapa final.',
    'Recomeça a partida depois do intervalo.'
  ],
  sub:[
    'Mudança na equipe. {out} sai e {in} entra.',
    'O treinador mexe: sai {out}, entra {in}.',
    'Substituição confirmada. {in} vem para o jogo.'
  ],
  injury:[
    '{player} sente o problema e pede atendimento.',
    'Preocupação: {player} cai no gramado sentindo dores.',
    'A equipe médica entra para avaliar {player}.'
  ],
  final:[
    'Fim de jogo! O árbitro encerra a partida.',
    'Apita pela última vez. Partida encerrada.',
    'Não há tempo para mais nada. Fim de jogo!'
  ]
};

export function narrate(type,data={},rng=Math.random){
  const raw=pick(NARRATOR_LIBRARY[type]||NARRATOR_LIBRARY.possession,rng);
  return raw.replace(/\{(\w+)\}/g,(_,k)=>data[k]??'');
}

function seeded(seed){
  let h=2166136261;
  for(const c of String(seed||'futbrowser')){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}
  return ()=>{h+=0x6D2B79F5;let t=h;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};
}

function attr(player,key,fallback=50){
  const a=player?.attributes||player?.atributos||{};
  const aliases={
    pace:['Velocidade','velocidade','Pace','pace'],passing:['Passe','passe','Passing','passing'],finishing:['Finalização','Finalizacao','finalizacao','finishing'],
    physical:['Físico','Fisico','fisico','physical'],vision:['Visão','Visao','visao','vision'],marking:['Marcação','Marcacao','marcacao','marking']
  };
  for(const k of aliases[key]||[key]) if(a[k]!=null) return Number(a[k]);
  return Number(player?.ovr||fallback);
}

function specialty(player,key,fallback){
  const s=player?.specialties||player?.skills||{};
  if(Array.isArray(s)){
    const hit=s.find(x=>x.key===key||x.label===key);
    if(hit) return Number(hit.level||hit.value||fallback);
  }else if(s&&s[key]!=null) return Number(s[key]);
  return fallback;
}

function buildSkillset(player){
  const pace=attr(player,'pace'),pass=attr(player,'passing'),fin=attr(player,'finishing'),phy=attr(player,'physical'),vis=attr(player,'vision'),mark=attr(player,'marking');
  return {
    pace,passing:pass,finishing:fin,physical:phy,vision:vis,marking:mark,
    dribble:specialty(player,'dribble',Math.round((pace+pass)/2)),shortPass:specialty(player,'short_pass',pass),longPass:specialty(player,'long_pass',Math.round((pass+vis)/2)),
    crossing:specialty(player,'crossing',pass),sprint:specialty(player,'sprint',pace),endurance:specialty(player,'endurance',phy),strength:specialty(player,'strength',phy),
    heading:specialty(player,'heading',Math.round((phy+fin)/2)),positioning:specialty(player,'positioning',vis),tactical:specialty(player,'tactical_reading',vis),
    penalties:specialty(player,'penalties',fin),freeKicks:specialty(player,'free_kicks',pass)
  };
}

function teamPlayer(ai,index,team){
  return {
    id:ai.id||`${team}-${index}`,name:ai.name||`Jogador ${index+1}`,position:ai.position||ai.primary_position||'MC',ovr:Number(ai.ovr||60),
    number:ai.number||ai.squad_number||index+1,team,role:roleOf(ai.position||ai.primary_position),energy:100,yellow:false,red:false,onField:true,
    x:50,y:50,homeX:50,homeY:50,isUser:false,chemistry:Number(ai.chemistry||50),relation:Number(ai.relation_score||50)
  };
}

function assignFormation(players,formation,attacksRight=true){
  const coords=FORMATIONS[formation]||FORMATIONS['4-3-3'];
  players.filter(p=>p.onField).slice(0,11).forEach((p,i)=>{
    let [x,y]=coords[i]||coords[coords.length-1];
    if(!attacksRight)x=100-x;
    p.homeX=x;p.homeY=y;p.x=x;p.y=y;
  });
}

function fitUserIntoXI(team,user){
  const desired=roleOf(user.position);
  let idx=team.findIndex(p=>p.role===desired&&p.role!=='gk');
  if(idx<0)idx=team.findIndex(p=>p.role!=='gk');
  if(idx<0)idx=10;
  team[idx]={...team[idx],id:user.id,name:user.name,position:user.position,ovr:user.ovr,number:user.number||team[idx].number,isUser:true,role:desired,attributes:user.attributes,skills:user.skills,energy:100};
  return team[idx];
}

function movementTarget(player,state,teamHasBall){
  const dir=state.homeAttacksRight=== (player.team==='home') ? 1:-1;
  let x=player.homeX,y=player.homeY;
  const ball=state.ball;
  const dist=Math.hypot(ball.x-player.x,ball.y-player.y);
  if(teamHasBall){
    if(['wing','st','am'].includes(player.role))x+=dir*(5+Math.min(8,state.tempo/12));
    if(player.role==='fb'&&ball.x*dir>15)x+=dir*5;
    if(['cm','dm'].includes(player.role)){x+=dir*2;y+=(ball.y-y)*0.18;}
    if(player.role==='cb')x+=dir*1;
  }else{
    if(player.role==='cb')x-=dir*(state.pressure==='high'?4:1);
    if(player.role==='fb'){x-=dir*2;y+=(ball.y-y)*0.12;}
    if(['dm','cm','am'].includes(player.role)){x-=dir*2;y+=(ball.y-y)*0.22;}
    if(player.role==='wing')x-=dir*3;
    if(dist<16&&player.role!=='gk'){x=player.x+(ball.x-player.x)*0.18;y=player.y+(ball.y-player.y)*0.18;}
  }
  return {x:clamp(x,4,96),y:clamp(y,5,95)};
}

function decisionScore(base,difficulty,state,cost=0){
  const readiness=(state.userPreparation||70)/100;
  const energy=(state.user?.energy||70)/100;
  const mental=(state.mentalStability||70)/100;
  const ctx=(readiness*.22+energy*.18+mental*.12);
  const roll=jitter(state.rng,7);
  return base*.58+ctx*100-difficulty*.38-cost*.12+roll;
}

function opponentStrength(state,kind='defense'){
  const avg=state.away.reduce((s,p)=>s+p.ovr,0)/Math.max(1,state.away.length);
  const home=state.home.reduce((s,p)=>s+p.ovr,0)/Math.max(1,state.home.length);
  return state.user?.team==='home'?avg:home;
}

function ratingDelta(state,value,reason){
  state.rating=clamp(round1(state.rating+value),1,10);
  if(reason)state.ratingLog.push({minute:state.minute,value,reason,rating:state.rating});
}

function stat(state,team,key,inc=1){state.stats[team][key]=(state.stats[team][key]||0)+inc;}

function moveBall(state,to,duration=420){
  state.ball.from={x:state.ball.x,y:state.ball.y};state.ball.x=to.x;state.ball.y=to.y;state.ball.ownerId=to.id||null;state.ball.animMs=duration;
}

function chooseReceiver(state,team,from){
  const mates=team.filter(p=>p.onField&&!p.red&&p.id!==from.id);
  const dir=(from.team==='home')===state.homeAttacksRight?1:-1;
  return mates.sort((a,b)=>((b.x-from.x)*dir+state.rng()*8)-((a.x-from.x)*dir+state.rng()*8))[0]||mates[0];
}

function genericPossession(state){
  const teamKey=state.possession;
  const team=teamKey==='home'?state.home:state.away;
  const opp=teamKey==='home'?state.away:state.home;
  const holder=team.find(p=>p.id===state.ball.ownerId&&p.onField)||pick(team.filter(p=>p.onField),state.rng);
  if(!holder)return;
  state.ball.ownerId=holder.id;state.ball.x=holder.x;state.ball.y=holder.y;
  stat(state,teamKey,'possessionTicks');
  const progress=(teamKey==='home')===state.homeAttacksRight?holder.x:100-holder.x;
  const r=state.rng();
  if(progress>70&&r<0.24){
    stat(state,teamKey,'shots');
    state.feed(narrate('shot',{player:holder.name},state.rng),'shot',holder);
    const attack=holder.ovr+state.rng()*18;
    const defend=opp.reduce((s,p)=>s+(p.role==='gk'?p.ovr*1.15:p.ovr*.18),0)/4;
    if(attack-defend>18){stat(state,teamKey,'goals');state.score[teamKey]++;state.feed(narrate('goal',{player:holder.name},state.rng),'goal',holder);}
    else if(r<0.10){stat(state,teamKey,'corners');state.feed(narrate('corner',{team:state.teamNames[teamKey]},state.rng),'corner');}
    else state.feed(narrate(r<0.17?'shot_saved':'shot_off',{},state.rng),'shot');
    state.possession=teamKey==='home'?'away':'home';
    return;
  }
  const receiver=chooseReceiver(state,team,holder);
  if(!receiver)return;
  stat(state,teamKey,'passesAttempted');
  const quality=(holder.ovr*.55+receiver.ovr*.15+state.rng()*35)-(opponentStrength(state)*.25);
  if(quality>35){stat(state,teamKey,'passesCompleted');moveBall(state,receiver);state.feed(narrate(progress<55?'pass':'long_pass',{from:holder.name,to:receiver.name},state.rng),'pass');}
  else{const thief=pick(opp.filter(p=>p.onField),state.rng);state.possession=teamKey==='home'?'away':'home';if(thief)moveBall(state,thief);state.feed(narrate('interception',{},state.rng),'interception',thief);}
}

const ZONES={defensive:[0,35],middle:[30,70],attacking:[65,100],box:[82,100],wide:[0,100]};
function userProgress(state){return state.user.team==='home'===state.homeAttacksRight?state.user.x:100-state.user.x;}

function userSituation(state){
  const u=state.user;if(!u||!u.onField||u.red)return null;
  const hasBall=state.ball.ownerId===u.id;
  const teamHas=state.possession===u.team;
  const progress=userProgress(state);
  const role=u.role;
  if(hasBall&&progress>78)return {key:'box_ball',title:'Você recebeu dentro/na entrada da área',withBall:true};
  if(hasBall&&['wing','fb'].includes(role)&&Math.abs(u.y-50)>18&&progress>55)return {key:'wide_ball',title:'Você recebe aberto, com espaço para atacar o corredor',withBall:true};
  if(hasBall&&progress<42)return {key:'build_under_pressure',title:'Você recebe no campo defensivo sob pressão',withBall:true};
  if(hasBall)return {key:'central_ball',title:'Você recebe e precisa decidir o ritmo da jogada',withBall:true};
  if(teamHas&&['st','wing','am'].includes(role)&&progress>45)return {key:'off_ball_attack',title:'Seu companheiro levanta a cabeça e você pode atacar o espaço',withBall:false};
  if(!teamHas&&['cb','fb','dm','cm'].includes(role))return {key:'defensive_read',title:'O adversário progride pelo seu setor',withBall:false};
  if(!teamHas&&['wing','am','st'].includes(role))return {key:'recovery_choice',title:'Seu time perdeu a bola e o contra-ataque começa',withBall:false};
  return {key:'support_move',title:'A jogada passa pelo seu setor',withBall:false};
}

function optionsFor(state,sit){
  const s=state.userSkills;const role=state.user.role;const p=userProgress(state);const opts=[];
  const add=(key,label,skill,difficulty,cost=2,tags=[])=>opts.push({key,label,skill,difficulty,cost,tags});
  if(sit.key==='box_ball'){
    add('shoot','Finalizar para o gol','finishing',opponentStrength(state)+6,6,['shot']);
    add('square','Tocar para um companheiro melhor posicionado','shortPass',opponentStrength(state)-3,3,['pass']);
    add('cut_inside','Cortar o marcador antes de bater','dribble',opponentStrength(state)+10,8,['dribble']);
    if(s.vision>=72)add('special_cutback','Enxergar o passe para trás que a defesa não percebe','vision',opponentStrength(state)-5,4,['special','pass']);
  }else if(sit.key==='wide_ball'){
    add('take_on','Partir para cima do lateral','dribble',opponentStrength(state)+4,7,['dribble']);
    add('cross','Cruzar buscando a área','crossing',opponentStrength(state),5,['cross']);
    add('inside_pass','Tocar por dentro e continuar a movimentação','shortPass',opponentStrength(state)-8,3,['pass']);
    if(s.sprint>=74)add('burst_line','Explodir nas costas do lateral','sprint',opponentStrength(state)+5,9,['special','sprint']);
  }else if(sit.key==='build_under_pressure'){
    add('safe_pass','Jogar simples no apoio','shortPass',opponentStrength(state)-10,2,['pass']);
    add('turn','Girar sobre o marcador e conduzir','dribble',opponentStrength(state)+8,7,['dribble']);
    add('long_release','Quebrar a pressão com lançamento','longPass',opponentStrength(state)+2,4,['pass']);
    if(s.strength>=72)add('shield','Proteger com o corpo e esperar apoio','strength',opponentStrength(state)-2,5,['special','duel']);
  }else if(sit.key==='central_ball'){
    add('progress_pass','Passe vertical quebrando linha','shortPass',opponentStrength(state)+1,3,['pass']);
    add('carry','Conduzir atacando o espaço','dribble',opponentStrength(state)+4,6,['dribble']);
    add('switch','Virar o jogo para o lado oposto','longPass',opponentStrength(state)+3,4,['pass']);
    add('retain','Segurar e circular a posse','shortPass',opponentStrength(state)-12,1,['pass']);
    if(s.vision>=75)add('killer_pass','Tentar o passe que deixa companheiro na cara do gol','vision',opponentStrength(state)+12,5,['special','chance']);
  }else if(sit.key==='off_ball_attack'){
    add('run_depth','Atacar a profundidade nas costas da zaga','positioning',opponentStrength(state)+3,7,['run']);
    add('come_short','Vir buscar e oferecer apoio','tactical',opponentStrength(state)-7,3,['support']);
    add('wide_run','Abrir o campo e arrastar o marcador','positioning',opponentStrength(state)-2,4,['run']);
    if(s.positioning>=74)add('blindside','Atacar o ponto cego do zagueiro','positioning',opponentStrength(state)+1,5,['special','run']);
  }else if(sit.key==='defensive_read'){
    add('press','Pressionar imediatamente o portador','marking',opponentStrength(state)+5,7,['press']);
    add('contain','Conter e fechar progressão','tactical',opponentStrength(state)-5,3,['defend']);
    add('lane','Fechar a linha de passe mais perigosa','tactical',opponentStrength(state)-2,2,['interception']);
    add('tackle','Dar o bote para roubar','marking',opponentStrength(state)+8,6,['tackle']);
    if(s.tactical>=76)add('anticipate','Antecipar a jogada antes do passe sair','tactical',opponentStrength(state)-4,3,['special','interception']);
  }else if(sit.key==='recovery_choice'){
    add('sprint_back','Correr para recompor até sua linha','endurance',opponentStrength(state),9,['sprint','defend']);
    add('inside_lane','Fechar o passe central e orientar para fora','tactical',opponentStrength(state)-3,4,['defend']);
    add('stay_high','Ficar alto para ser opção de contra-ataque','positioning',opponentStrength(state)+4,1,['risk']);
    add('tactical_foul','Parar a transição com falta tática','marking',opponentStrength(state)-6,5,['foul']);
  }else{
    add('support','Aproximar para dar linha de passe','positioning',opponentStrength(state)-8,2,['support']);
    add('space','Atacar um espaço livre à frente','positioning',opponentStrength(state),5,['run']);
    add('balance','Manter posição e equilíbrio tático','tactical',opponentStrength(state)-10,1,['defend']);
  }
  return opts.slice(0,5);
}

function resolveUserChoice(state,choice,sit){
  const u=state.user;const skill=state.userSkills[choice.skill]??u.ovr;const score=decisionScore(skill,choice.difficulty,state,choice.cost);const success=score>=47;u.energy=clamp(u.energy-choice.cost,0,100);
  const team=u.team,opp=team==='home'?'away':'home';
  const result={success,score,choice,followUp:null};
  if(choice.tags.includes('foul')){
    stat(state,team,'fouls');state.feed(narrate('foul',{},state.rng),'foul',u);ratingDelta(state,-0.1,'Falta tática');
    if(state.rng()<0.62){u.yellow=true;stat(state,team,'yellow');state.feed(narrate('yellow',{},state.rng),'yellow',u);ratingDelta(state,-0.15,'Cartão amarelo');}
    state.possession=opp;return result;
  }
  if(choice.tags.includes('shot')){
    stat(state,team,'shots');state.feed(narrate('shot',{player:u.name},state.rng),'shot',u);
    if(success&&score>61){state.score[team]++;stat(state,team,'goals');state.playerStats.goals++;state.feed(narrate('goal',{player:u.name},state.rng),'goal',u);ratingDelta(state,1.25,'Gol');state.possession=opp;}
    else if(success){stat(state,team,'shotsOnTarget');state.feed(narrate('shot_saved',{},state.rng),'shot',u);ratingDelta(state,0.08,'Finalização no alvo');}
    else{state.feed(narrate('shot_off',{},state.rng),'shot',u);ratingDelta(state,-0.12,'Finalização desperdiçada');}
    return result;
  }
  if(choice.tags.includes('cross')){
    state.playerStats.crosses++;stat(state,team,'passesAttempted');state.feed(narrate('cross',{},state.rng),'cross',u);
    if(success){stat(state,team,'passesCompleted');ratingDelta(state,0.08,'Cruzamento perigoso');result.followUp={title:'A bola chega na área',options:[{key:'attack_second','Atacar a segunda bola',skill:'positioning',difficulty:choice.difficulty+2,cost:4,tags:['chance']},{key:'hold_edge','Ficar na entrada para o rebote',skill:'tactical',difficulty:choice.difficulty-5,cost:2,tags:['support']}]};}
    else if(state.rng()<0.28){stat(state,team,'corners');state.feed(narrate('corner',{team:state.teamNames[team]},state.rng),'corner');}
    return result;
  }
  if(choice.tags.includes('dribble')){
    state.playerStats.dribblesAttempted++;
    if(success){state.playerStats.dribblesCompleted++;state.feed(narrate('dribble_success',{player:u.name},state.rng),'dribble',u);ratingDelta(state,0.12,'Drible útil');u.x=clamp(u.x+(((u.team==='home')===state.homeAttacksRight)?7:-7),4,96);state.ball.x=u.x;state.ball.y=u.y;if(userProgress(state)>76)result.followUp={title:'Você venceu o primeiro marcador e entra na zona de decisão',options:optionsFor(state,{key:'box_ball'})};}
    else{state.feed(narrate('dribble_fail',{player:u.name},state.rng),'dribble',u);ratingDelta(state,-0.16,'Perda no drible');state.possession=opp;const thief=pick((opp==='home'?state.home:state.away).filter(p=>p.onField),state.rng);if(thief)moveBall(state,thief);}
    return result;
  }
  if(choice.tags.includes('pass')||choice.tags.includes('chance')){
    stat(state,team,'passesAttempted');state.playerStats.passesAttempted++;
    if(success){stat(state,team,'passesCompleted');state.playerStats.passesCompleted++;const receiver=chooseReceiver(state,team==='home'?state.home:state.away,u);if(receiver){moveBall(state,receiver);state.feed(narrate(choice.key==='switch'?'long_pass':'pass',{from:u.name,to:receiver.name},state.rng),'pass',u);}ratingDelta(state,choice.tags.includes('chance')?0.18:0.05,choice.tags.includes('chance')?'Passe decisivo':'Passe certo');if(choice.tags.includes('chance')){stat(state,team,'shots');if(state.rng()<0.38){state.score[team]++;stat(state,team,'goals');state.playerStats.assists++;ratingDelta(state,0.75,'Assistência');state.feed(narrate('goal',{player:receiver?.name||'companheiro'},state.rng),'goal',receiver);state.possession=opp;}}}
    else{state.possession=opp;ratingDelta(state,-0.08,'Passe perdido');const thief=pick((opp==='home'?state.home:state.away).filter(p=>p.onField),state.rng);if(thief)moveBall(state,thief);state.feed(narrate('interception',{},state.rng),'interception',thief);}
    return result;
  }
  if(choice.tags.includes('tackle')||choice.tags.includes('interception')||choice.tags.includes('defend')||choice.tags.includes('press')){
    if(success){state.playerStats.duelsWon++;state.possession=team;state.ball.ownerId=u.id;state.ball.x=u.x;state.ball.y=u.y;state.feed(narrate(choice.tags.includes('interception')?'interception':'tackle',{},state.rng),choice.tags.includes('interception')?'interception':'tackle',u);ratingDelta(state,0.12,'Ação defensiva positiva');}
    else{state.playerStats.duelsLost++;ratingDelta(state,-0.08,'Ação defensiva vencida pelo rival');if(choice.tags.includes('tackle')&&state.rng()<0.22){stat(state,team,'fouls');state.feed(narrate('foul',{},state.rng),'foul',u);if(state.rng()<0.35){u.yellow=true;stat(state,team,'yellow');state.feed(narrate('yellow',{},state.rng),'yellow',u);}}}
    return result;
  }
  if(choice.tags.includes('run')||choice.tags.includes('sprint')||choice.tags.includes('support')){
    const dir=(u.team==='home')===state.homeAttacksRight?1:-1;
    u.x=clamp(u.x+dir*(success?8:4),4,96);if(choice.key==='wide_run')u.y=clamp(u.y+(u.y<50?-8:8),5,95);
    if(success){ratingDelta(state,0.07,'Movimentação correta');if(state.rng()<0.52&&state.possession===team){state.ball.ownerId=u.id;state.ball.x=u.x;state.ball.y=u.y;result.followUp={title:'A movimentação funciona e a bola chega até você',options:optionsFor(state,userSituation(state)||{key:'central_ball'})};}}
    else ratingDelta(state,-0.03,'Movimentação sem impacto');
    return result;
  }
  if(choice.tags.includes('risk')){
    if(state.coachInstruction?.includes('recomposição'))ratingDelta(state,-0.12,'Desobedeceu a recomposição');
    else ratingDelta(state,0.01,'Manteve-se alto');
  }
  return result;
}

function instructionFor(role,style,rng){
  const map={
    gk:['Saia curto quando houver segurança.','Atenção às bolas nas costas da defesa.'],
    cb:['Quero você protegendo a área e vencendo a primeira bola.','Não quebre a linha sem necessidade.'],
    fb:['Apoie quando houver espaço, mas recomponha rápido.','Feche por dentro quando a bola estiver no lado oposto.'],
    dm:['Proteja a frente da zaga e acelere o primeiro passe.','Controle o corredor central e faça a cobertura.'],
    cm:['Dê ritmo à posse e apareça para receber entre linhas.','Quero intensidade para pressionar e apoiar.'],
    am:['Receba entre linhas e tente o passe vertical.','Aproxime dos atacantes e ataque a entrada da área.'],
    wing:['Ataque o espaço atrás do lateral e volte para recomposição.','Parta para o um contra um quando estiver isolado.'],
    st:['Ataque a última linha e ocupe a área.','Prenda os zagueiros e seja agressivo na finalização.']
  };
  const base=pick(map[role]||map.cm,rng);return style?`${base} Estilo da equipe: ${style}.`:base;
}

export class CareerMatchEngine{
  constructor(context={}){
    this.context=context;this.rng=seeded(`${context.matchDate||Date.now()}-${context.player?.id||'player'}-${context.opponent?.name||'opponent'}`);
    this.minute=0;this.second=0;this.phase='pre';this.homeAttacksRight=true;this.tempo=50;this.pressure='normal';this.paused=true;this.awaitingDecision=false;this.listeners=new Map();
    this.teamNames={home:context.home?.name||context.club?.name||'Seu time',away:context.away?.name||context.opponent?.name||'Adversário'};
    this.home=(context.home?.players||context.team?.roster||[]).slice(0,11).map((p,i)=>teamPlayer(p,i,'home'));
    this.away=(context.away?.players||context.opponent?.players||Array.from({length:11},(_,i)=>({name:`Adversário ${i+1}`,ovr:context.opponent?.ovr||60,position:['GOL','LD','ZAG','ZAG','LE','VOL','MC','MEI','PD','ATA','PE'][i]}))).slice(0,11).map((p,i)=>teamPlayer(p,i,'away'));
    while(this.home.length<11)this.home.push(teamPlayer({name:`Companheiro ${this.home.length+1}`,ovr:60,primary_position:'MC'},this.home.length,'home'));
    while(this.away.length<11)this.away.push(teamPlayer({name:`Adversário ${this.away.length+1}`,ovr:60,primary_position:'MC'},this.away.length,'away'));
    this.user=null;
    const selection=context.selection?.status||context.playerProjection?.status||'starter';
    if(selection==='starter')this.user=fitUserIntoXI(this.home,{...context.player,team:'home'});
    this.benchUser=selection==='bench';this.selection=selection;
    assignFormation(this.home,context.home?.formation||context.club?.formation||'4-3-3',true);assignFormation(this.away,context.away?.formation||context.opponent?.formation||'4-3-3',false);
    if(this.user){const placed=this.home.find(p=>p.isUser);this.user=placed;}
    const prep=context.performance?.preparation_score||context.player?.preparation_score||context.state?.readiness||75;
    const startEnergy=clamp((context.state?.energy??80)*.62+(100-(context.state?.fatigue??20))*.38,45,100);
    if(this.user)this.user.energy=startEnergy;
    this.userPreparation=prep;this.mentalStability=context.performance?.mental_stability||context.player?.mental_stability||72;
    this.userSkills=buildSkillset(context.player||{});
    this.coachInstruction=instructionFor(roleOf(context.player?.position),context.club?.play_style,this.rng);
    this.score={home:0,away:0};this.rating=6.0;this.ratingLog=[];this.playerStats={goals:0,assists:0,passesAttempted:0,passesCompleted:0,dribblesAttempted:0,dribblesCompleted:0,crosses:0,duelsWon:0,duelsLost:0,minutes:0,shots:0};
    this.stats={home:{goals:0,passesAttempted:0,passesCompleted:0,shots:0,shotsOnTarget:0,corners:0,fouls:0,yellow:0,red:0,possessionTicks:0},away:{goals:0,passesAttempted:0,passesCompleted:0,shots:0,shotsOnTarget:0,corners:0,fouls:0,yellow:0,red:0,possessionTicks:0}};
    this.possession=this.rng()<.5?'home':'away';const starter=pick((this.possession==='home'?this.home:this.away).filter(p=>p.role==='cm'||p.role==='dm'),this.rng)||pick(this.possession==='home'?this.home:this.away,this.rng);this.ball={x:starter?.x||50,y:starter?.y||50,ownerId:starter?.id||null,from:null,animMs:0};
    this.commentary=[];this.nextUserMoment=4+Math.floor(this.rng()*5);this.userMoments=0;this.maxUserMoments=10+Math.floor(this.rng()*7);this.pendingDecision=null;this.lastGenericMinute=-1;this.subMinute=selection==='bench'?55+Math.floor(this.rng()*22):null;this.injuryRisk=Number(context.performance?.injury_risk_multiplier||1);
  }
  on(name,fn){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn);return()=>this.listeners.get(name)?.delete(fn);}
  emit(name,payload){this.listeners.get(name)?.forEach(fn=>fn(payload));}
  feed(text,type='play',actor=null){const item={minute:this.minute,text,type,actorId:actor?.id||null};this.commentary.push(item);if(this.commentary.length>80)this.commentary.shift();this.emit('commentary',item);}
  start(){if(this.phase!=='pre')return;this.phase='first';this.paused=false;this.feed(narrate('kickoff',{},this.rng),'kickoff');this.emit('state',this.snapshot());}
  resume(){this.paused=false;this.awaitingDecision=false;this.emit('state',this.snapshot());}
  pause(){this.paused=true;this.emit('state',this.snapshot());}
  tick(dt=1){
    if(this.paused||this.phase==='final')return;
    this.second+=dt*12;
    if(this.second>=60){this.minute++;this.second=0;this.onMinute();}
    this.animatePlayers();this.emit('frame',this.snapshot());
  }
  onMinute(){
    if(this.minute===45&&this.phase==='first'){this.phase='halftime';this.paused=true;this.feed(narrate('halftime',{},this.rng),'halftime');this.emit('halftime',this.snapshot());return;}
    if(this.minute===46&&this.phase==='second'&&this.lastGenericMinute!==46)this.feed(narrate('restart',{},this.rng),'restart');
    if(this.minute>=90){this.finish();return;}
    if(this.selection==='bench'&&!this.user&&this.minute>=this.subMinute){this.enterUserFromBench();return;}
    if(this.user?.onField)this.playerStats.minutes++;
    if(this.user?.onField&&this.user.energy>0)this.user.energy=clamp(this.user.energy-(.22+(this.tempo/100)*.22),0,100);
    if(this.shouldUserMoment()){this.openUserMoment();return;}
    genericPossession(this);
    this.maybeContextualIncident();
    this.emit('state',this.snapshot());
  }
  startSecondHalf(){if(this.phase!=='halftime')return;this.homeAttacksRight=!this.homeAttacksRight;this.phase='second';assignFormation(this.home,this.context.home?.formation||this.context.club?.formation||'4-3-3',this.homeAttacksRight);assignFormation(this.away,this.context.away?.formation||this.context.opponent?.formation||'4-3-3',!this.homeAttacksRight);this.minute=45;this.second=0;this.paused=false;this.feed(narrate('restart',{},this.rng),'restart');this.emit('sidechange',this.snapshot());}
  shouldUserMoment(){if(!this.user?.onField||this.awaitingDecision||this.userMoments>=this.maxUserMoments)return false;if(this.minute<this.nextUserMoment)return false;const roleFactor=['wing','am','st'].includes(this.user.role)?.82:['cb','dm','fb'].includes(this.user.role)?.72:.76;return this.rng()<roleFactor;}
  openUserMoment(){
    this.userMoments++;this.nextUserMoment=this.minute+3+Math.floor(this.rng()*6);
    if(this.rng()<.58){this.possession=this.user.team;if(this.rng()<.56){this.ball.ownerId=this.user.id;this.ball.x=this.user.x;this.ball.y=this.user.y;}}
    const sit=userSituation(this);if(!sit)return;const options=optionsFor(this,sit);this.pendingDecision={situation:sit,options,chain:0};this.paused=true;this.awaitingDecision=true;this.emit('decision',{minute:this.minute,title:sit.title,options,energy:this.user.energy,rating:this.rating,instruction:this.coachInstruction});
  }
  choose(key){
    if(!this.pendingDecision||!this.awaitingDecision)return null;const choice=this.pendingDecision.options.find(o=>o.key===key);if(!choice)return null;
    const result=resolveUserChoice(this,choice,this.pendingDecision.situation);this.emit('choice',{...result,minute:this.minute,rating:this.rating,energy:this.user?.energy});
    if(result.followUp&&this.pendingDecision.chain<2){this.pendingDecision={situation:{key:'chain',title:result.followUp.title},options:result.followUp.options,chain:this.pendingDecision.chain+1};this.emit('decision',{minute:this.minute,title:result.followUp.title,options:result.followUp.options,energy:this.user.energy,rating:this.rating,instruction:this.coachInstruction,chain:true});return result;}
    this.pendingDecision=null;this.awaitingDecision=false;this.paused=false;this.emit('state',this.snapshot());return result;
  }
  animatePlayers(){
    for(const p of [...this.home,...this.away]){if(!p.onField)continue;const target=movementTarget(p,this,this.possession===p.team);const speed=p.isUser?0.10:0.07;p.x+=(target.x-p.x)*speed;p.y+=(target.y-p.y)*speed;}
    const owner=[...this.home,...this.away].find(p=>p.id===this.ball.ownerId&&p.onField);if(owner){this.ball.x+=(owner.x-this.ball.x)*.22;this.ball.y+=(owner.y-this.ball.y)*.22;}
  }
  maybeContextualIncident(){
    const r=this.rng();
    if(r<.035){const team=this.possession;stat(this,team,'fouls');this.feed(narrate('foul',{},this.rng),'foul');if(this.rng()<.18){stat(this,team,'yellow');this.feed(narrate('yellow',{},this.rng),'yellow');}}
    if(this.user?.onField&&this.injuryRisk>1&&this.user.energy<45&&r>.96){this.feed(narrate('injury',{player:this.user.name},this.rng),'injury',this.user);if(this.rng()<Math.min(.42,(this.injuryRisk-1)*.18)){this.user.onField=false;this.playerStats.minutes=Math.max(this.playerStats.minutes,this.minute);ratingDelta(this,-.05,'Saiu lesionado');this.emit('injury',{minute:this.minute,player:this.user.name});}}
  }
  enterUserFromBench(){
    const candidate=this.home.filter(p=>p.onField&&p.role===roleOf(this.context.player?.position)&&p.role!=='gk').sort((a,b)=>a.ovr-b.ovr)[0]||this.home.filter(p=>p.onField&&p.role!=='gk').sort((a,b)=>a.ovr-b.ovr)[0];if(!candidate)return;
    candidate.onField=false;const u=teamPlayer({...this.context.player,name:this.context.player?.nickname||this.context.player?.name||'Você',position:this.context.player?.position,ovr:this.context.player?.ovr,number:this.context.player?.shirt_number},99,'home');u.isUser=true;u.role=roleOf(this.context.player?.position);u.energy=clamp((this.context.state?.energy??80)*.7+22,45,95);u.x=candidate.x;u.y=candidate.y;u.homeX=candidate.homeX;u.homeY=candidate.homeY;this.home.push(u);this.user=u;this.selection='bench_entered';this.feed(narrate('sub',{out:candidate.name,in:u.name},this.rng),'sub',u);this.emit('substitution',{minute:this.minute,out:candidate,in:u,instruction:this.coachInstruction});this.paused=true;
  }
  finish(){if(this.phase==='final')return;this.phase='final';this.paused=true;this.feed(narrate('final',{},this.rng),'final');const appeared=Boolean(this.user);if(appeared&&this.user?.onField)this.playerStats.minutes=Math.max(this.playerStats.minutes,this.minute);this.emit('final',this.result());}
  result(){const totalPoss=this.stats.home.possessionTicks+this.stats.away.possessionTicks||1;return {score:{...this.score},stats:structuredClone(this.stats),playerStats:{...this.playerStats},rating:round1(this.rating),selection:this.selection,started:this.context.selection?.status==='starter',appeared:Boolean(this.user),minute:this.minute,commentary:[...this.commentary],possession:{home:Math.round(this.stats.home.possessionTicks/totalPoss*100),away:Math.round(this.stats.away.possessionTicks/totalPoss*100)}};}
  snapshot(){const totalPoss=this.stats.home.possessionTicks+this.stats.away.possessionTicks||1;return {minute:this.minute,second:this.second,phase:this.phase,paused:this.paused,homeAttacksRight:this.homeAttacksRight,home:this.home.map(p=>({...p})),away:this.away.map(p=>({...p})),ball:{...this.ball},score:{...this.score},stats:structuredClone(this.stats),possession:{home:Math.round(this.stats.home.possessionTicks/totalPoss*100),away:Math.round(this.stats.away.possessionTicks/totalPoss*100)},rating:this.rating,userEnergy:this.user?.energy??null,selection:this.selection,teamNames:this.teamNames,instruction:this.coachInstruction};}
}
