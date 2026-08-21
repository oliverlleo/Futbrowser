import { assertCareerMatchBackendReady } from './career-meta-service.js?v=20260812-1';

function errorBox(button){
  let box=document.getElementById('careerMatchBackendError');
  if(box)return box;
  box=document.createElement('div');
  box.id='careerMatchBackendError';
  box.className='career-match-backend-error';
  button.parentElement?.appendChild(box);
  return box;
}

function setButtonState(button,{busy=false,verified=false}={}){
  if(!button)return;
  button.disabled=busy;
  if(verified)button.dataset.backendVerified='1';
  const label=button.querySelector('span');
  if(label)label.textContent=busy?'Verificando partida…':'Entrar na partida';
}

document.addEventListener('click',async event=>{
  const button=event.target.closest?.('#startCareerMatchBtn');
  if(!button||button.dataset.backendVerified==='1')return;

  event.preventDefault();
  event.stopImmediatePropagation();
  setButtonState(button,{busy:true});
  const box=errorBox(button);
  box.textContent='';
  box.classList.remove('show');

  try{
    const context=await assertCareerMatchBackendReady();
    window.__careerVerifiedMatchContext=context;
    setButtonState(button,{busy:false,verified:true});
    button.click();
  }catch(error){
    setButtonState(button,{busy:false});
    box.textContent=error?.message||'O backend da partida ainda não está disponível.';
    box.classList.add('show');
    console.error('Career match backend guard:',error);
  }
},true);
