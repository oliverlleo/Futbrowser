import { supabase } from '../../services/supabase-client.js';

let busy=false;

async function syncTeamTrainingGuard(){
  if(busy)return;
  busy=true;
  try{
    const {data,error}=await supabase.rpc('get_career_preparation_status');
    if(error)throw error;
    const overloaded=Number(data?.physical?.overload_days||0)>0;
    document.querySelectorAll('[data-team-action]').forEach(button=>{
      const blocked=overloaded&&['team_training_normal','team_training_intense'].includes(button.dataset.teamAction);
      button.disabled=blocked;
      if(blocked)button.title='Sobrecarga muscular: apenas carga reduzida ou ausência estão liberadas até o corpo recuperar.';
      else if(button.title?.includes('Sobrecarga muscular'))button.removeAttribute('title');
    });
    const panel=document.getElementById('teamSessionPanel');
    panel?.querySelector('.team-overload-note')?.remove();
    if(overloaded&&panel&&!panel.classList.contains('hidden')){
      const note=document.createElement('p');
      note.className='team-overload-note';
      note.textContent='Sobrecarga muscular ativa · carga reduzida liberada. Insistir em carga normal ou intensa aumenta o risco de agravamento.';
      panel.querySelector('.team-choice-grid')?.insertAdjacentElement('beforebegin',note);
    }
  }catch(error){console.warn('[Career preparation] proteção de treino coletivo indisponível:',error?.message||error);}
  finally{busy=false;}
}

document.addEventListener('career:hub-rendered',syncTeamTrainingGuard);
syncTeamTrainingGuard();