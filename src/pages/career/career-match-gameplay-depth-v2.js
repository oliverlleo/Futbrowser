import { CareerMatchEngine } from './career-match-engine-v2.js?v=20260811-1';

const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,Number(v)||0));
const pick=(list,rng)=>list?.length?list[Math.floor(rng()*list.length)]:null;
const active=list=>(list||[]).filter(player=>player.onField&&!player.red);
const opponentTeam=team=>team==='home'?'away':'home';
const attacksRight=(engine,team)=>team==='home'?engine.homeAttacksRight:!engine.homeAttacksRight;
const progressOf=(engine,team,x)=>attacksRight(engine,team)?x:100-x;
const teamPlayers=(engine,team)=>team==='home'?engine.home:engine.away;

const INTENSITY={
  light:{label:'Leve',momentGate:.84,gapMin:5,gapMax:8,overflowGate:.25,minuteRefund:.58,idleRecovery:.18,extraDrain:0,forcedBallDelta:-.05},
  moderate:{label:'Moderada',momentGate:1,gapMin:3,gapMax:6,overflowGate:.35,minuteRefund:.08,idleRecovery:0,extraDrain:0,forcedBallDelta:0},
  intense:{label:'Intensa',momentGate:1,gapMin:2,gapMax:5,overflowGate:.55,minuteRefund:0,idleRecovery:0,extraDrain:.18,forcedBallDelta:.07}
};

const TITLES={
  penalty_pressure:['A responsabilidade é sua na marca da cal','Pênalti: goleiro e batedor frente a frente','Momento de pressão máxima dentro da área'],
  free_kick:['Falta frontal em zona de finalização','Bola parada perto da área','A barreira se forma e você assume a cobrança'],
  box_ball:['Você domina dentro da área com pouco espaço','A bola sobra viva entre os defensores','Você recebe de costas para o gol na área','Passe para trás encontra você chegando de frente','Você recebe no meio-espaço, já perto do gol','A defesa fecha rápido depois do domínio'],
  wide_ball:['Você recebe isolado contra o lateral','Bola no corredor com campo para acelerar','Você chega perto da linha de fundo','O lateral fecha por fora e deixa o corredor interno','Você recebe aberto com um companheiro passando','A defesa dobra a marcação no lado do campo'],
  build_under_pressure:['Você recebe de costas sob pressão alta','A saída fica apertada perto da lateral','Você recebe entre zagueiro e volante marcado de perto','O rival salta para pressionar e fecha o passe curto'],
  central_ball:['Você recebe entre as linhas e pode acelerar','A bola chega no meio com marcação aproximando','Transição aberta pelo corredor central','Você tem tempo para levantar a cabeça','O volante rival fecha a frente da área','Você recebe no meio-espaço com opções dos dois lados'],
  off_ball_attack:['Um cruzamento começa a viajar na sua direção','O passe pode entrar nas costas da última linha','A bola vai para o lado e você ataca a segunda trave','Seu companheiro chega ao fundo e procura quem vem de trás','A defesa olha para a bola e perde sua movimentação','A segunda bola pode cair na entrada da área'],
  defensive_read:['O adversário vem no um contra um pelo seu setor','Um atacante tenta atacar o espaço às suas costas','A bola aérea cai na sua zona de marcação','O passe vertical ameaça romper sua linha','O rival recebe entre linhas e você precisa reagir','Sua equipe tenta montar uma armadilha de pressão'],
  recovery_choice:['Seu time perde a bola e nasce um contra-ataque','Um corredor ficou aberto na transição defensiva','Um adversário dispara sem bola pelo centro','A perda acontece com sua equipe desorganizada'],
  support_move:['A segunda bola fica viva perto de você','Seu companheiro procura uma linha curta de apoio','A jogada pede uma infiltração tardia','Você pode arrastar o marcador para abrir espaço','O ataque precisa de alguém para equilibrar a posse']
};

const CATALOG={
  penalty_pressure:[
    ['pen_place','Colocar no canto com precisão','penalties',3,3,['shot','penalty'],'Precisão acima de força.'],
    ['pen_power','Bater firme no alto','finishing',7,4,['shot','penalty'],'Mais potência, menor margem de erro.'],
    ['pen_wait','Esperar o goleiro definir o lado','penalties',1,3,['shot','penalty'],'Exige calma e leitura.'],
    ['pen_low','Bater rasteiro junto à trave','penalties',4,2,['shot','penalty'],'Menos esforço e alvo pequeno.']
  ],
  free_kick:[
    ['fk_curve','Buscar o ângulo com curva','freeKicks',8,4,['shot','free_kick'],'Técnica e precisão.'],
    ['fk_power','Bater forte por cima da barreira','freeKicks',11,5,['shot','free_kick'],'Potência aumenta a exigência.'],
    ['fk_cross','Levantar com força na pequena área','crossing',1,3,['cross'],'Cria disputa aérea.'],
    ['fk_short','Tocar curto e continuar a jogada','shortPass',-8,1,['pass','support'],'Conserva energia e mantém a posse.']
  ],
  box_ball:[
    ['box_finish','Finalizar no primeiro espaço','finishing',5,4,['shot'],'Rápido, antes do bloqueio.'],
    ['box_set','Ajeitar o corpo e escolher o canto','finishing',3,3,['shot'],'Ganha precisão, mas dá tempo à marcação.'],
    ['box_feint','Fingir o chute e cortar o marcador','dribble',7,6,['dribble'],'Pode limpar o caminho para a próxima ação.'],
    ['box_layoff','Escorar para quem chega de frente','shortPass',-5,2,['pass','support'],'Baixo desgaste e boa segurança.'],
    ['box_open','Conduzir de lado para abrir o ângulo','dribble',4,5,['dribble'],'Troca energia por espaço.'],
    ['box_square','Rolar para o companheiro livre','vision',-2,2,['pass','chance'],'Procura uma chance melhor para o time.'],
    ['box_low_cross','Cruzar rasteiro atravessando a pequena área','crossing',1,4,['cross'],'Força a defesa a correr para o próprio gol.']
  ],
  wide_ball:[
    ['wide_line','Atacar a linha de fundo no drible','dribble',5,7,['dribble'],'Muito esforço, pode eliminar o lateral.'],
    ['wide_inside','Cortar para dentro conduzindo','dribble',4,6,['dribble'],'Tenta ganhar ângulo para passe ou chute.'],
    ['wide_early_cross','Cruzar antes da dobra chegar','crossing',1,4,['cross'],'Menos desgaste e menos preparação.'],
    ['wide_low_cross','Acelerar e cruzar rasteiro','crossing',4,6,['cross','run'],'Mais perigoso, custa mais energia.'],
    ['wide_wall','Tocar por dentro e passar para receber','shortPass',-4,3,['pass','run'],'Usa combinação em vez do duelo.'],
    ['wide_recycle','Voltar a bola e guardar posição','shortPass',-10,1,['pass','support'],'Reduz risco e ajuda a conservar energia.'],
    ['wide_burst','Explodir nas costas do lateral','sprint',6,9,['sprint','run'],'Cria profundidade com grande custo físico.']
  ],
  build_under_pressure:[
    ['build_one_touch','Tocar de primeira no apoio','shortPass',-9,1,['pass','support'],'Saída simples e econômica.'],
    ['build_turn','Girar sobre o marcador','dribble',8,7,['dribble'],'Se funcionar, quebra a primeira pressão.'],
    ['build_shield','Proteger a bola e esperar apoio','strength',-1,4,['duel','support'],'Usa físico para ganhar tempo.'],
    ['build_diagonal','Virar o jogo com passe longo','longPass',3,4,['pass'],'Tenta escapar da pressão pelo lado oposto.'],
    ['build_draw','Atrair o marcador e soltar no último instante','vision',2,3,['pass','chance'],'Arriscado, mas pode eliminar a pressão.'],
    ['build_clear','Afastar para longe da zona de risco','longPass',-4,2,['pass'],'Prioriza segurança.']
  ],
  central_ball:[
    ['central_vertical','Passe vertical entre as linhas','shortPass',1,3,['pass'],'Progride com risco controlado.'],
    ['central_carry','Conduzir atacando o espaço','dribble',4,6,['dribble'],'Gasta energia para ganhar metros.'],
    ['central_switch','Inverter para o lado oposto','longPass',3,4,['pass'],'Explora o lado menos congestionado.'],
    ['central_wall','Tabela curta para ultrapassar a marcação','shortPass',0,3,['pass','run'],'Combinação rápida.'],
    ['central_killer','Enfiar a bola nas costas da zaga','vision',11,5,['pass','chance'],'Chance de criar oportunidade clara.'],
    ['central_hold','Cadenciar e tocar para trás','shortPass',-11,1,['pass','support'],'Conserva energia e reorganiza o ataque.'],
    ['central_shot','Arriscar de média distância','finishing',13,3,['shot'],'Pouco desgaste, mas finalização difícil.']
  ],
  off_ball_attack:[
    ['off_near','Atacar a primeira trave','positioning',2,6,['run','aerial'],'Movimento curto e agressivo.'],
    ['off_far','Escapar para a segunda trave','positioning',1,5,['run','aerial'],'Busca espaço fora do foco da defesa.'],
    ['off_cutback','Frear e aparecer para o passe para trás','positioning',-1,4,['run','chance'],'Tenta receber de frente para o gol.'],
    ['off_depth','Disparar nas costas da última linha','positioning',4,8,['run','sprint'],'Grande esforço para atacar profundidade.'],
    ['off_short','Vir buscar apoio entre linhas','tactical',-7,2,['support'],'Menos perigoso, mais econômico.'],
    ['off_blind','Atacar o ponto cego do zagueiro','positioning',1,5,['run'],'Movimento baseado em leitura.'],
    ['off_edge','Ficar na entrada esperando a segunda bola','tactical',-4,2,['support','chance'],'Pouco desgaste e possibilidade de rebote.']
  ],
  defensive_read:[
    ['def_contain','Conter e obrigar o rival a ir para fora','tactical',-5,3,['defend'],'Controle em vez de bote.'],
    ['def_tackle','Atacar a bola no bote','marking',8,6,['tackle'],'Pode recuperar imediatamente ou cometer falta.'],
    ['def_lane','Fechar a linha de passe perigosa','tactical',-2,2,['interception'],'Leitura e posicionamento.'],
    ['def_press','Apertar o portador sem dar espaço','marking',5,7,['press'],'Alto desgaste para acelerar o erro.'],
    ['def_track','Acompanhar a corrida sem abandonar a linha','endurance',0,5,['defend','run'],'Evita espaço nas costas.'],
    ['def_aerial','Atacar a bola pelo alto','heading',3,5,['aerial','defend'],'Disputa física no tempo da bola.']
  ],
  recovery_choice:[
    ['rec_sprint','Recompor em velocidade máxima','endurance',0,9,['sprint','defend'],'Fecha espaço rápido com grande custo.'],
    ['rec_center','Correr por dentro e fechar o corredor central','tactical',-3,5,['defend','run'],'Protege a zona mais perigosa.'],
    ['rec_track','Acompanhar o jogador que passa sem bola','marking',1,6,['defend','run'],'Evita uma opção livre.'],
    ['rec_lane','Fechar a linha de passe e desacelerar','tactical',-4,3,['interception','defend'],'Economiza energia e ganha tempo.'],
    ['rec_high','Ficar alto para o contra-ataque','positioning',5,1,['risk'],'Conserva energia, mas deixa o time com menos um atrás.'],
    ['rec_foul','Parar a transição com falta tática','marking',-6,4,['foul'],'Resolve a jogada com risco disciplinar.']
  ],
  support_move:[
    ['sup_short','Aproximar para oferecer passe curto','positioning',-8,2,['support'],'Ajuda a equipe sem grande esforço.'],
    ['sup_late','Entrar na área vindo de trás','positioning',1,6,['run','chance'],'Chegada surpresa com custo físico.'],
    ['sup_width','Abrir o campo e prender o lateral','tactical',-4,3,['support','run'],'Cria espaço para os outros.'],
    ['sup_second','Atacar a segunda bola','positioning',2,5,['run','chance'],'Procura a sobra do lance.'],
    ['sup_drag','Levar o marcador para longe da bola','tactical',-2,4,['run','support'],'Movimento útil mesmo sem receber.'],
    ['sup_balance','Manter posição e recuperar fôlego','tactical',-10,1,['support','defend'],'Pouco envolvimento e baixo desgaste.']
  ]
};

const SPECIALS={
  penalty_pressure:[['sp_panenka','Cavar uma Panenka','penalties',11,3,['shot','penalty','special'],'Execução rara e extremamente técnica.']],
  free_kick:[['sp_knuckle','Bater folha seca sem rotação','freeKicks',14,6,['shot','free_kick','special'],'Trajetória imprevisível.'],['sp_underwall','Bater por baixo da barreira no salto','freeKicks',8,4,['shot','free_kick','special'],'Só existe se a leitura do momento permitir.']],
  box_ball:[['sp_bicycle','Tentar uma bicicleta','finishing',18,10,['shot','aerial','special'],'Acrobática, rara e muito exigente.'],['sp_volley','Emendar um voleio de primeira','finishing',12,7,['shot','aerial','special'],'Finalização sem deixar a bola cair.'],['sp_chip','Cavar por cima do goleiro','finishing',10,4,['shot','special'],'Depende de leitura e toque fino.'],['sp_heel_finish','Desviar de calcanhar','finishing',15,5,['shot','special'],'Surpresa de curtíssimo tempo.'],['sp_trivela_finish','Finalizar de trivela','finishing',13,6,['shot','special'],'Busca curva sem abrir o corpo.']],
  wide_ball:[['sp_elastico','Aplicar um elástico e acelerar','dribble',14,9,['dribble','sprint','special'],'Drible explosivo e raro.'],['sp_nutmeg','Tentar uma caneta no lateral','dribble',11,6,['dribble','special'],'Se passar, abre o corredor imediatamente.'],['sp_rabona_cross','Cruzar de rabona','crossing',15,7,['cross','special'],'Cruzamento técnico em posição incomum.'],['sp_trivela_cross','Cruzar de trivela','crossing',11,5,['cross','special'],'Curva para fugir da linha defensiva.']],
  build_under_pressure:[['sp_sombrero','Dar um chapéu para escapar da pressão','dribble',16,9,['dribble','special'],'Muito risco em zona sensível.'],['sp_roulette','Girar em roleta entre dois marcadores','dribble',14,8,['dribble','special'],'Exige controle e equilíbrio.'],['sp_heel_escape','Tocar de calcanhar para escapar da pressão','shortPass',10,4,['pass','special'],'Passe surpresa sem virar o corpo.']],
  central_ball:[['sp_no_look','Dar um passe sem olhar quebrando a linha','vision',13,5,['pass','chance','special'],'Engana a leitura defensiva.'],['sp_trivela_pass','Enfiar passe de trivela','longPass',12,5,['pass','chance','special'],'Curva por fora do pé.'],['sp_roulette_mid','Passar pela pressão com uma roleta','dribble',13,8,['dribble','special'],'Controle em espaço curto.'],['sp_long_knuckle','Arriscar uma pancada sem rotação de longe','finishing',18,5,['shot','special'],'Baixa frequência, alto impacto.']],
  off_ball_attack:[['sp_bicycle_cross','Atacar o cruzamento de bicicleta','finishing',19,11,['shot','aerial','special'],'Acrobacia rara em bola aérea.'],['sp_scissor','Finalizar de voleio lateral','finishing',14,8,['shot','aerial','special'],'Golpe de primeira no ar.'],['sp_diving_header','Mergulhar de peixinho','heading',12,8,['shot','aerial','special'],'Chega antes do marcador com o corpo inteiro.'],['sp_chest_volley','Dominar no peito e bater antes de cair','finishing',15,9,['shot','aerial','special'],'Dois gestos técnicos em sequência.']],
  defensive_read:[['sp_slide_hook','Dar um carrinho de recuperação no limite','marking',13,9,['tackle','special'],'Precisa chegar exatamente na bola.'],['sp_aerial_bicycle_clear','Afastar de bicicleta dentro da área','heading',16,9,['defend','aerial','special'],'Recurso acrobático de emergência.']],
  recovery_choice:[['sp_intercept_launch','Antecipar e já lançar o contra-ataque de primeira','tactical',12,7,['interception','chance','special'],'Leitura defensiva vira ataque num toque.']],
  support_move:[['sp_backheel_link','Dar assistência de calcanhar se a bola chegar','vision',12,5,['pass','chance','special'],'Toque surpresa para acelerar a combinação.'],['sp_first_time_volley','Atacar a sobra com voleio de primeira','finishing',15,8,['shot','special'],'Finalização imediata na segunda bola.']]
};

function skillValue(engine,key){return Number(engine.userSkills?.[key]??engine.user?.ovr??50);}
function opponentBase(engine){const rivals=active(teamPlayers(engine,opponentTeam(engine.user?.team||'home')));return Number(engine.directOpponent?.ovr||(rivals.reduce((s,p)=>s+Number(p.ovr||60),0)/Math.max(1,rivals.length))||60);}
function makeChoice(engine,row){const[key,label,skill,offset,cost,tags,description]=row;return{key,label,skill,difficulty:opponentBase(engine)+offset,cost,tags:[...tags],description};}
function randomInt(rng,min,max){return min+Math.floor(rng()*(max-min+1));}
function primaryType(tags=[]){for(const key of['shot','dribble','cross','chance','pass','sprint','run','tackle','interception','press','defend','support','risk','foul'])if(tags.includes(key))return key;return'other';}
function weightedPick(items,weightFn,rng){if(!items.length)return null;const weighted=items.map(item=>({item,w:Math.max(.001,Number(weightFn(item))||0)}));const total=weighted.reduce((sum,x)=>sum+x.w,0);let cursor=rng()*total;for(const entry of weighted){cursor-=entry.w;if(cursor<=0)return entry.item;}return weighted.at(-1).item;}

function contextFor(engine){
  const user=engine.user;if(!user)return{pressure:50,space:50,angle:50,markers:1,progress:50};
  const opponents=active(teamPlayers(engine,opponentTeam(user.team)));const distances=opponents.map(player=>Math.hypot(player.x-user.x,player.y-user.y)).sort((a,b)=>a-b);const nearest=distances[0]??18;const markers=distances.filter(distance=>distance<13).length;
  const pressure=clamp(78-nearest*4.2+markers*7+(engine.playState?.pressureBias||0),5,96);const progress=progressOf(engine,user.team,user.x);const angle=clamp(100-Math.abs(user.y-50)*1.45-(progress<70?(70-progress)*.35:0),8,100);
  return{pressure,space:clamp(100-pressure+(engine.playState?.advantage||0)*.7,4,98),angle,markers,progress};
}

function scoreContext(engine,choice){const team=engine.user?.team||'home',opp=opponentTeam(team),diff=engine.score[team]-engine.score[opp];if(engine.minute>=72){if(diff<0&&['shot','chance','run','sprint','press'].some(tag=>choice.tags?.includes(tag)))return 4;if(diff>0&&['pass','support','defend','interception'].some(tag=>choice.tags?.includes(tag)))return 4;if(diff>0&&choice.tags?.includes('risk'))return-5;}return 0;}
function instructionContext(engine,choice){const i=String(engine.coachInstruction||'').toLowerCase();let mod=0;if(i.includes('recompon')&&['defend','press','sprint'].some(tag=>choice.tags?.includes(tag)))mod+=3;if(i.includes('um contra um')&&choice.tags?.includes('dribble'))mod+=3;if(i.includes('passe vertical')&&choice.tags?.includes('chance'))mod+=3;if(i.includes('prote')&&['defend','interception'].some(tag=>choice.tags?.includes(tag)))mod+=2;if(i.includes('área')&&['shot','run','aerial'].some(tag=>choice.tags?.includes(tag)))mod+=2;return mod;}

function contextualize(engine,choice,ctx){
  const c={...choice,tags:[...(choice.tags||[])]};let difficulty=Number(c.difficulty||opponentBase(engine));const advantage=Number(engine.playState?.advantage||0);
  if(c.tags.includes('shot')){difficulty+=ctx.pressure*.10+ctx.markers*2.2+(100-ctx.angle)*.045;if(ctx.progress>86)difficulty-=Math.min(6,(ctx.progress-86)*.45);}
  else if(c.tags.includes('dribble'))difficulty+=ctx.pressure*.055+ctx.markers*1.5;
  else if(c.tags.includes('pass')||c.tags.includes('chance'))difficulty+=ctx.pressure*.035+ctx.markers*.8;
  else if(c.tags.includes('cross'))difficulty+=ctx.pressure*.03;
  else if(c.tags.includes('run')||c.tags.includes('sprint'))difficulty+=ctx.pressure*.025;
  if(['shot','dribble','pass','chance','cross','run','sprint'].some(tag=>c.tags.includes(tag)))difficulty-=advantage*.28;
  c.difficulty=difficulty;c.context=ctx;c.skillValue=Math.round(skillValue(engine,c.skill));
  const readiness=(engine.userPreparation||70)/100,energy=(engine.user?.energy||70)/100,mental=(engine.mentalStability||70)/100;const chemistry=c.tags.includes('pass')?Number(engine.user?.chemistry||0)*.04:0;
  const deterministic=c.skillValue*.58+(readiness*.22+energy*.18+mental*.12)*100-difficulty*.38-Number(c.cost||0)*.12+scoreContext(engine,c)+instructionContext(engine,c)+chemistry;const threshold=c.tags.includes('shot')?(c.tags.includes('penalty')?55:c.tags.includes('free_kick')?62:61):47;
  c.successChance=Math.round(clamp(((deterministic+6.5-threshold)/13)*100,1,99));c.chanceLabel=c.tags.includes('shot')?'Gol':'Sucesso';c.energyCost=Math.max(0,Number(c.cost||0));c.riskLabel=c.successChance>=72?'Favorável':c.successChance>=48?'Equilibrada':c.successChance>=28?'Difícil':'Muito difícil';return c;
}

function situationKey(engine){
  const pending=engine.pendingDecision?.situation?.key;
  if(pending==='penalty_pressure'||pending==='free_kick')return pending;
  const last=engine.playState?.lastChoice;
  if(engine.pendingDecision?.chain>0){if(last?.tags?.includes('cross'))return'off_ball_attack';if(last?.tags?.includes('dribble')||last?.tags?.includes('shot')||last?.tags?.includes('run'))return'box_ball';}
  const user=engine.user;if(!user)return pending&&pending!=='chain'?pending:'support_move';
  const ctx=contextFor(engine),hasBall=engine.ball?.ownerId===user.id,teamHas=engine.possession===user.team,role=user.role;
  if(hasBall){
    if(ctx.progress>80)return'box_ball';
    if(ctx.progress<42)return'build_under_pressure';
    if(Math.abs(user.y-50)>18&&ctx.progress>50)return'wide_ball';
    return'central_ball';
  }
  if(teamHas){if(['st','wing','am'].includes(role)&&ctx.progress>43)return'off_ball_attack';return'support_move';}
  if(['cb','fb','dm','cm'].includes(role))return'defensive_read';
  return'recovery_choice';
}

function rareChance(engine,key){const ovr=Number(engine.user?.ovr||engine.context?.player?.ovr||50);const relevant=key==='box_ball'||key==='off_ball_attack'?skillValue(engine,'finishing'):key==='wide_ball'?skillValue(engine,'dribble'):key==='defensive_read'?skillValue(engine,'marking'):skillValue(engine,'vision');return clamp(.022+Math.max(0,ovr-55)*.0018+Math.max(0,relevant-70)*.0007,.015,.11);}

function actionWeight(engine,row,ctx,selected){
  const[key,,,,cost,tags]=row,recent=(engine.offeredActionHistory||[]).flat(),last3=recent.slice(-9),last1=recent.slice(-3);let weight=1;
  if(last1.includes(key))weight*=.20;else if(last3.includes(key))weight*=.52;
  const kind=primaryType(tags);if(selected.some(item=>primaryType(item[5])===kind))weight*=.58;
  if(tags.includes('dribble')&&ctx.markers>=1&&ctx.markers<=2&&ctx.space>=12&&ctx.space<=72)weight*=1.28;
  if(tags.includes('shot')&&ctx.progress>=73)weight*=1.18;
  if((tags.includes('run')||tags.includes('sprint'))&&ctx.space>=45)weight*=1.14;
  if(tags.includes('support')&&Number(engine.user?.energy||0)<38)weight*=1.32;
  if(Number(cost)<=3&&Number(engine.user?.energy||0)<28)weight*=1.20;
  return weight;
}

function selectRegularRows(engine,rows,ctx){
  const pool=[...rows],selected=[];
  while(selected.length<Math.min(3,pool.length)){
    const chosen=weightedPick(pool,row=>actionWeight(engine,row,ctx,selected),engine.rng);if(!chosen)break;selected.push(chosen);pool.splice(pool.indexOf(chosen),1);
  }
  if(!selected.some(row=>Number(row[4])<=3)){
    const economical=rows.filter(row=>Number(row[4])<=3&&!selected.includes(row));
    const replacement=weightedPick(economical,row=>actionWeight(engine,row,ctx,selected.slice(0,2)),engine.rng);
    if(replacement)selected[selected.length-1]=replacement;
  }
  return selected;
}

function enhanceDecision(engine,payload){
  const key=situationKey(engine),rows=CATALOG[key]||CATALOG.support_move,ctx=contextFor(engine);let regular=selectRegularRows(engine,rows,ctx).map(row=>contextualize(engine,makeChoice(engine,row),ctx));
  const specialRows=SPECIALS[key]||[];if(specialRows.length&&engine.rng()<rareChance(engine,key)){const special=contextualize(engine,makeChoice(engine,pick(specialRows,engine.rng)),ctx);special.rare=true;regular.push(special);}
  const title=pick(TITLES[key]||[payload.title],engine.rng)||payload.title;engine.pendingDecision.options=regular;engine.pendingDecision.situation={...(engine.pendingDecision.situation||{}),key,title};engine.playState.currentContext=ctx;
  engine.offeredActionHistory.push(regular.slice(0,3).map(option=>option.key));if(engine.offeredActionHistory.length>6)engine.offeredActionHistory.shift();
  engine.situationHistory.push({minute:engine.minute,key,with_ball:engine.ball?.ownerId===engine.user?.id});if(engine.situationHistory.length>12)engine.situationHistory.shift();
  return{...payload,title,options:regular,energy:engine.user?.energy,gameplayContext:ctx,intensity:engine.matchIntensity||'moderate',rareAppearanceChance:Math.round(rareChance(engine,key)*100),situationKey:key,engagement:engine.engagementProfile};
}

function roleEngagementBase(engine){const role=engine.user?.role||'cm';let base={st:19,wing:20,am:20,cm:18,dm:16,fb:16,cb:15,gk:12}[role]||17;const readiness=Number(engine.userPreparation||70);if(readiness>=88)base+=1;if(readiness<55)base-=1;const style=String(engine.context?.club?.play_style||'').toLowerCase();if((style.includes('ofens')||style.includes('press'))&&['st','wing','am','cm'].includes(role))base+=1;return base;}
function engagementVariance(rng){const r=rng();if(r<.08)return .78;if(r<.25)return .88;if(r<.58)return .98;if(r<.82)return 1.08;if(r<.96)return 1.18;return 1.30;}
function initializeEngagement(engine){const variance=engagementVariance(engine.rng),target=clamp(Math.round(roleEngagementBase(engine)*variance),11,26),cap=Math.min(30,target+4);engine.engagementProfile={target,cap,variance};engine.maxUserMoments=cap;engine.nextUserMoment=Math.min(Number(engine.nextUserMoment||7),randomInt(engine.rng,3,7));engine.situationHistory=[];engine.offeredActionHistory=[];}
function recentWithBall(engine){return(engine.situationHistory||[]).slice(-3).filter(item=>item.with_ball).length;}
function primeUserInvolvement(engine){
  const user=engine.user;if(!user?.onField)return;const mode=engine.matchIntensity||'moderate',cfg=INTENSITY[mode]||INTENSITY.moderate,role=user.role;
  let chance={st:.24,wing:.28,am:.27,cm:.18,dm:.10,fb:.11,cb:.07,gk:.03}[role]??.15;chance+=cfg.forcedBallDelta;
  const recent=(engine.situationHistory||[]).slice(-3),withBall=recentWithBall(engine);if(recent.length>=3&&withBall===0)chance+=.16;if(withBall>=2)chance-=.10;
  const team=user.team,opp=opponentTeam(team),diff=Number(engine.score?.[team]||0)-Number(engine.score?.[opp]||0);if(engine.minute>=65&&diff<0)chance+=.05;
  if(engine.rng()<clamp(chance,.02,.48)){engine.possession=team;engine.ball.ownerId=user.id;engine.ball.x=user.x;engine.ball.y=user.y;}
}
function scheduleNextMoment(engine){const mode=engine.matchIntensity||'moderate',cfg=INTENSITY[mode]||INTENSITY.moderate,team=engine.user?.team||'home',opp=opponentTeam(team),diff=Number(engine.score?.[team]||0)-Number(engine.score?.[opp]||0);let gap=randomInt(engine.rng,cfg.gapMin,cfg.gapMax);if(engine.minute>=65&&diff<0)gap-=1;if(mode==='light'&&diff>0)gap+=1;engine.nextUserMoment=engine.minute+clamp(gap,2,9);}

function resetSequence(engine){engine.playState.advantage=0;engine.playState.pressureBias=0;engine.playState.sequence=0;engine.playState.lastChoice=null;}
function updateSequence(engine,choice,result,before){const tags=new Set(choice?.tags||[]);engine.playState.lastChoice=choice;engine.playState.sequence+=1;if(result?.success){if(tags.has('dribble')){engine.playState.advantage=clamp(engine.playState.advantage+12,-20,35);engine.playState.pressureBias=clamp(engine.playState.pressureBias-14,-30,30);}else if(tags.has('run')||tags.has('sprint')){engine.playState.advantage=clamp(engine.playState.advantage+7,-20,35);engine.playState.pressureBias=clamp(engine.playState.pressureBias-7,-30,30);}else if(tags.has('chance'))engine.playState.advantage=clamp(engine.playState.advantage+6,-20,35);else if(tags.has('support')||tags.has('pass'))engine.playState.advantage=clamp(engine.playState.advantage+2,-20,35);}else{engine.playState.advantage=clamp(engine.playState.advantage-8,-20,35);engine.playState.pressureBias=clamp(engine.playState.pressureBias+9,-30,30);}if(tags.has('shot')||tags.has('foul')||engine.possession!==engine.user?.team)resetSequence(engine);if(engine.playerStats?.goals>before.goals)resetSequence(engine);}

function maybeContinuation(engine,choice,result,before){
  if(!result||engine.awaitingDecision||engine.phase==='final'||!engine.user?.onField)return false;const tags=new Set(choice?.tags||[]),team=engine.user.team;if(engine.playState.sequence>=3)return false;let title=null,key=null;
  if(result.success&&tags.has('dribble')&&engine.ball.ownerId===engine.user.id){key=progressOf(engine,team,engine.user.x)>74?'box_ball':'central_ball';title='Você elimina o marcador e a jogada continua';}
  else if(result.success&&tags.has('run')&&engine.ball.ownerId===engine.user.id){key='box_ball';title='A movimentação cria uma nova janela de decisão';}
  else if(tags.has('shot')&&result.success&&engine.playerStats.goals===before.goals&&engine.rng()<.20){engine.possession=team;engine.ball.ownerId=engine.user.id;engine.ball.x=engine.user.x;engine.ball.y=engine.user.y;key='box_ball';title='A defesa rebate curto e a bola volta para você';}
  if(!key)return false;engine.pendingDecision={situation:{key,title},options:[],chain:engine.playState.sequence};engine.paused=true;engine.awaitingDecision=true;engine.emit('decision',{minute:engine.minute,title,options:[],energy:engine.user.energy,rating:engine.rating,instruction:engine.coachInstruction,chain:true,directOpponent:engine.directOpponent?{name:engine.directOpponent.name,position:engine.directOpponent.position,ovr:engine.directOpponent.ovr}:null});return true;
}

if(!CareerMatchEngine.prototype.__gameplayDepthV2Installed){
  const originalStart=CareerMatchEngine.prototype.start,originalEmit=CareerMatchEngine.prototype.emit,originalChoose=CareerMatchEngine.prototype.choose,originalShouldMoment=CareerMatchEngine.prototype.shouldUserMoment,originalOpenMoment=CareerMatchEngine.prototype.openUserMoment,originalOnMinute=CareerMatchEngine.prototype.onMinute,originalMaybeSub=CareerMatchEngine.prototype.maybeUserSubstitution,originalResult=CareerMatchEngine.prototype.result;

  CareerMatchEngine.prototype.setMatchIntensity=function(mode='moderate'){if(!INTENSITY[mode])return this.matchIntensity||'moderate';this.matchIntensity=mode;if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('career:match-intensity-changed',{detail:{mode,engine:this}}));return mode;};
  CareerMatchEngine.prototype.emit=function(name,payload){if(name==='decision'&&payload?.options){payload=enhanceDecision(this,payload);if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('career:match-decision-meta',{detail:{engine:this,payload}}));}if(name==='user_subbed'&&this._dynamicSubReason){payload={...payload,reason:this._dynamicSubReason};this._dynamicSubReason=null;}return originalEmit.call(this,name,payload);};
  CareerMatchEngine.prototype.start=function(...args){this.matchIntensity='moderate';this.playState={advantage:0,pressureBias:0,sequence:0,lastChoice:null,currentContext:null};this.intensityMinutes={light:0,moderate:0,intense:0};this.decisionHistory=[];this.energySpentActions=0;const startEnergy=Number(this.user?.energy??this.context?.state?.energy??80);this.matchRecoveryCeiling=Math.min(92,startEnergy+6);const result=originalStart.apply(this,args);initializeEngagement(this);if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('career:match-engine-ready',{detail:{engine:this}}));return result;};
  CareerMatchEngine.prototype.shouldUserMoment=function(){const mode=this.matchIntensity||'moderate',cfg=INTENSITY[mode]||INTENSITY.moderate,profile=this.engagementProfile||{target:18,cap:22};if(!this.user?.onField||this.awaitingDecision||this.userMoments>=profile.cap||this.minute<this.nextUserMoment)return false;let eligible=originalShouldMoment.call(this);if(mode==='intense'&&!eligible&&this.rng()<.12)eligible=true;if(!eligible)return false;let gate=cfg.momentGate;if(this.userMoments>=profile.target)gate*=cfg.overflowGate;return this.rng()<clamp(gate,.08,1);};
  CareerMatchEngine.prototype.openUserMoment=function(...args){primeUserInvolvement(this);const result=originalOpenMoment.apply(this,args);scheduleNextMoment(this);return result;};
  CareerMatchEngine.prototype.choose=function(key){const choice=this.pendingDecision?.options?.find(option=>option.key===key);if(!choice)return originalChoose.call(this,key);const before={goals:Number(this.playerStats?.goals||0),energy:Number(this.user?.energy||0)};const result=originalChoose.call(this,key);const afterEnergy=Number(this.user?.energy||0);this.energySpentActions+=Math.max(0,before.energy-afterEnergy);if(choice.energyCost<=2&&result?.success&&['pass','support','defend'].some(tag=>choice.tags?.includes(tag))&&this.user?.onField)this.user.energy=clamp(this.user.energy+.35,0,this.matchRecoveryCeiling);this.decisionHistory.push({minute:this.minute,key:choice.key,label:choice.label,success:Boolean(result?.success),chance:choice.successChance,cost:choice.energyCost,energy_before:Math.round(before.energy),energy_after:Math.round(this.user?.energy??afterEnergy),intensity:this.matchIntensity||'moderate',situation:this.pendingDecision?.situation?.key||null,context:choice.context});if(this.decisionHistory.length>60)this.decisionHistory.shift();updateSequence(this,choice,result,before);maybeContinuation(this,choice,result,before);return result;};
  CareerMatchEngine.prototype.onMinute=function(...args){const userWasOn=Boolean(this.user?.onField),before=Number(this.user?.energy??0),mode=this.matchIntensity||'moderate',cfg=INTENSITY[mode]||INTENSITY.moderate;const result=originalOnMinute.apply(this,args);if(userWasOn)this.intensityMinutes[mode]=(this.intensityMinutes[mode]||0)+1;if(this.user?.onField){const after=Number(this.user.energy||0),spent=Math.max(0,before-after);if(cfg.minuteRefund>0&&spent>0)this.user.energy=clamp(this.user.energy+spent*cfg.minuteRefund,0,this.matchRecoveryCeiling);if(mode==='light'&&!this.awaitingDecision){const distance=Math.hypot((this.ball?.x??50)-this.user.x,(this.ball?.y??50)-this.user.y);if(distance>25)this.user.energy=clamp(this.user.energy+cfg.idleRecovery,0,this.matchRecoveryCeiling);}if(cfg.extraDrain>0&&!this.awaitingDecision)this.user.energy=clamp(this.user.energy-cfg.extraDrain,0,100);}return result;};
  CareerMatchEngine.prototype.maybeUserSubstitution=function(){if(!this.user?.onField||this.userSubbed||this.minute<63||(this.selection==='bench_entered'&&this.minute<82))return false;const energy=Number(this.user.energy||0),rating=Number(this.rating||6),diff=this.score.home-this.score.away,minute=this.minute,mode=this.matchIntensity||'moderate';let chance=minute<68?.015:minute<75?.04:minute<82?.075:minute<87?.12:.18;if(energy<35)chance+=.08;if(energy<22)chance+=.13;if(energy<10)chance+=.18;if(rating<5.6)chance+=.08;if(rating>=8&&minute>=78&&diff>0)chance+=.07;if(mode==='intense'&&energy<35)chance+=.04;if(this.selection==='bench_entered')chance*=.55;const reason=energy<22?'fadiga acumulada':rating<5.6?'queda de rendimento':rating>=8&&minute>=78&&diff>0?'preservação':'ajuste tático';if(!(energy<=5&&minute>=70)&&this.rng()>clamp(chance,0,.65))return false;const saved=Number(this.user.energy||0);this._dynamicSubReason=reason;this.user.energy=Math.min(saved,27);const changed=originalMaybeSub.call(this);if(changed&&this.user)this.user.energy=saved;else{this.user.energy=saved;this._dynamicSubReason=null;}return changed;};
  CareerMatchEngine.prototype.result=function(...args){const result=originalResult.apply(this,args);if(result?.playerStats){result.playerStats.intensity_minutes={...this.intensityMinutes};result.playerStats.energy_spent_actions=Math.round(this.energySpentActions||0);result.playerStats.decision_count=this.decisionHistory.length;result.playerStats.moment_count=Number(this.userMoments||0);result.playerStats.engagement_target=Number(this.engagementProfile?.target||0);result.playerStats.rare_actions=this.decisionHistory.filter(item=>String(item.key).startsWith('sp_')).length;result.playerStats.final_intensity=this.matchIntensity||'moderate';result.playerStats.decision_history=this.decisionHistory.slice(-50);result.playerStats.situation_history=(this.situationHistory||[]).slice(-20);}return result;};
  Object.defineProperty(CareerMatchEngine.prototype,'__gameplayDepthV2Installed',{value:true,enumerable:false,configurable:false});
}
