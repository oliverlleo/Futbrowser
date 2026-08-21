const $=id=>document.getElementById(id);

function placeMatchActionInCenter(){
  const lock=$('matchLock');
  const center=document.querySelector('.activity-column');
  if(!lock||!center)return;
  if(lock.parentElement!==center)center.prepend(lock);
  lock.classList.add('match-lock-centered');
}

function ensureFeedbackNode(){
  const stage=document.querySelector('.match-stage');
  if(!stage)return null;
  let node=$('matchChoiceFeedback');
  if(node)return node;
  node=document.createElement('div');
  node.id='matchChoiceFeedback';
  node.className='match-choice-feedback hidden';
  node.setAttribute('aria-live','polite');
  stage.appendChild(node);
  return node;
}

function showOutcome({success,label,outcome,rating,energy}){
  const node=ensureFeedbackNode();
  if(!node)return;
  node.className=`match-choice-feedback ${success?'success':'fail'}`;
  node.innerHTML=`
    <span>${success?'AÇÃO BEM-SUCEDIDA':'A JOGADA NÃO FUNCIONOU'}</span>
    <strong>${label}</strong>
    <p>${outcome}</p>
    <div><b>Nota ${rating}</b><b>${energy}</b></div>`;
  requestAnimationFrame(()=>node.classList.add('show'));
  clearTimeout(node.__hideTimer);
  node.__hideTimer=setTimeout(()=>{
    node.classList.remove('show');
    setTimeout(()=>node.classList.add('hidden'),180);
  },1450);
}

function hideResolvedDecision(panel){
  panel.className='match-decision hidden';
  panel.innerHTML='';
}

document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-match-choice]');
  if(!button)return;
  const panel=$('matchDecision');
  if(!panel)return;

  const selectedLabel=button.querySelector('strong')?.textContent?.trim()||button.textContent.trim();
  const commentaryBefore=$('matchLastEvent')?.textContent?.trim()||'';

  setTimeout(()=>{
    if(!panel.isConnected)return;

    // A jogada encadeada chama showDecision() imediatamente e remove as classes
    // success/fail. Nesse caso não fechamos nada: a próxima decisão deve ficar na tela.
    const success=panel.classList.contains('success');
    const fail=panel.classList.contains('fail');
    if(!success&&!fail)return;

    const commentaryAfter=$('matchLastEvent')?.textContent?.trim()||'';
    const changedCommentary=commentaryAfter&&commentaryAfter!==commentaryBefore;
    const outcome=changedCommentary
      ? commentaryAfter
      : success
        ? 'Sua escolha produziu o efeito esperado no lance.'
        : 'O adversário neutralizou a tentativa e a jogada seguiu.';
    const rating=$('matchPlayerRating')?.textContent?.trim()||'—';
    const energy=$('matchEnergyText')?.textContent?.trim()||'Energia —';

    hideResolvedDecision(panel);
    showOutcome({success,label:selectedLabel,outcome,rating,energy});
  },60);
},true);

document.addEventListener('career:hub-rendered',event=>{
  if(event.detail?.match_locked)queueMicrotask(placeMatchActionInCenter);
});

export { placeMatchActionInCenter };
