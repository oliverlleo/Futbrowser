const FEEDBACK_HOLD_MS=2800;
const FEEDBACK_FADE_MS=220;

const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

function feedbackHeading(result){
  if(result?.outcomeTier==='partial')return'A MOVIMENTAÇÃO FUNCIONOU';
  if(result?.outcomeTier==='progress')return'A JOGADA AVANÇOU';
  return result?.success?'AÇÃO BEM-SUCEDIDA':'A JOGADA NÃO FUNCIONOU';
}
function fallbackText(result){
  if(result?.outcomeText)return result.outcomeText;
  if(result?.shotOutcome?.goal)return'Gol. A jogada terminou na rede.';
  if(result?.success)return'A decisão funcionou e alterou a jogada.';
  return'O adversário neutralizou sua tentativa.';
}

function showReadableOutcome(engine,result,choice,continued){
  const feedback=document.getElementById('matchChoiceFeedback');
  const decision=document.getElementById('matchDecision');
  if(!feedback||!engine)return;

  clearTimeout(engine.__v5FeedbackFallback);
  clearTimeout(feedback.__hideTimer);
  clearTimeout(feedback.__v5FadeTimer);

  // A chained decision has already been rendered by the engine. Keep it hidden
  // until the player has had time to read what happened in the previous action.
  if(decision&&continued&&!decision.classList.contains('hidden')){
    decision.dataset.v5Queued='1';
    decision.classList.add('hidden');
  }else if(decision&&!continued){
    decision.classList.add('hidden');
  }

  engine.paused=true;
  const rating=Number(engine.rating||6).toFixed(1).replace('.',',');
  const energy=engine.user?.energy==null?'Fora de campo':`Energia ${Math.round(engine.user.energy)}%`;
  const positive=result?.success||result?.outcomeTier==='partial'||result?.outcomeTier==='progress';
  feedback.className=`match-choice-feedback ${positive?'success':'fail'}`;
  feedback.innerHTML=`<span>${esc(feedbackHeading(result))}</span><strong>${esc(choice?.label||'Decisão')}</strong><p>${esc(fallbackText(result))}</p><div><b>Nota ${rating}</b><b>${energy}</b></div>`;
  requestAnimationFrame(()=>feedback.classList.add('show'));

  feedback.__hideTimer=setTimeout(()=>{
    feedback.classList.remove('show');
    feedback.__v5FadeTimer=setTimeout(()=>feedback.classList.add('hidden'),FEEDBACK_FADE_MS);

    if(continued&&engine.awaitingDecision&&engine.pendingDecision&&decision){
      decision.classList.remove('hidden');
      delete decision.dataset.v5Queued;
      engine.paused=true;
      return;
    }

    if(!engine.awaitingDecision){
      engine.paused=false;
      engine.emit?.('state',engine.snapshot?.());
    }
  },FEEDBACK_HOLD_MS);
}

if(typeof window!=='undefined'&&!window.__careerMatchFeedbackHoldInstalled){
  window.__careerMatchFeedbackHoldInstalled=true;
  window.addEventListener('career:match-choice-resolved-v5',event=>{
    const detail=event.detail||{};
    showReadableOutcome(detail.engine,detail.result,detail.choice,Boolean(detail.continued));
  });
}

export { FEEDBACK_HOLD_MS };
