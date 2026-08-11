function ensurePitchCss(){
  if(document.querySelector('link[data-career-pitch-v2]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='src/pages/career/career-pitch.css?v=20260811-8';
  link.dataset.careerPitchV2='true';
  document.head.appendChild(link);
}

function lineFor(position){
  const value=String(position||'').toLowerCase();
  if(value.includes('goleiro'))return 'gk';
  if(value.includes('zagueiro')||value.includes('lateral'))return 'def';
  if(value.includes('volante')||value.includes('meio')||value.includes('meia'))return 'mid';
  return 'att';
}

function renderPitch(){
  const pitch=document.querySelector('#clubProfileContent .probable-lineup');
  const active=document.querySelector('#clubProfileContent [data-team-tab="lineup"].active');
  if(!pitch||!active)return false;
  pitch.classList.add('football-pitch');
  const rows={att:[],mid:[],def:[],gk:[]};
  pitch.querySelectorAll('.lineup-player').forEach(player=>{
    const descriptor=player.querySelector('small')?.textContent||'';
    const position=descriptor.split('·')[0]?.trim();
    rows[lineFor(position)].push(player);
  });
  const rowNumber={att:1,mid:2,def:3,gk:4};
  Object.entries(rows).forEach(([line,players])=>{
    players.forEach((player,index)=>{
      const center=Math.round(((index+1)*13)/(players.length+1));
      const start=Math.max(1,Math.min(11,center-1));
      player.style.gridRow=String(rowNumber[line]);
      player.style.gridColumn=`${start} / span 2`;
    });
  });
  return true;
}

function renderWhenReady(attempt=0){
  if(attempt>20)return;
  if(renderPitch())return;
  setTimeout(()=>renderWhenReady(attempt+1),35);
}

ensurePitchCss();
document.addEventListener('click',event=>{
  if(event.target.closest('.identity-club')||event.target.closest('[data-team-tab="lineup"]')){
    setTimeout(()=>renderWhenReady(),0);
  }
});
