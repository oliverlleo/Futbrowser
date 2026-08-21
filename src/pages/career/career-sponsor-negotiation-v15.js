import { supabase } from '../../services/supabase-client.js';
import { showToast } from '../../components/toast/toast.js';

let busy=false;
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(Number(v||0));

function ensureStyle(){
  if(document.getElementById('sponsor-negotiation-v15-style'))return;
  const style=document.createElement('style');
  style.id='sponsor-negotiation-v15-style';
  style.textContent=`
  .sponsor-neg-v15{position:fixed;inset:0;z-index:195000;display:grid;place-items:center;padding:18px;background:rgba(5,12,22,.76);backdrop-filter:blur(10px)}
  .sponsor-neg-v15.hidden{display:none!important}
  .sponsor-neg-card{width:min(920px,calc(100vw - 28px));max-height:min(820px,calc(100vh - 28px));overflow:hidden;display:grid;grid-template-rows:auto minmax(0,1fr) auto;border:1px solid var(--line);border-radius:22px;background:var(--card-solid);box-shadow:0 36px 110px rgba(0,0,0,.5)}
  .sponsor-neg-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:20px 22px;border-bottom:1px solid var(--line);background:linear-gradient(135deg,rgba(56,201,31,.09),transparent 55%)}
  .sponsor-neg-head span{color:var(--green-2);font-size:9px;font-weight:950;letter-spacing:.09em;text-transform:uppercase}.sponsor-neg-head h2{margin-top:4px;font-size:23px;font-weight:950;letter-spacing:-.03em}.sponsor-neg-head p{margin-top:5px;color:var(--muted);font-size:10px;line-height:1.5}
  .sponsor-neg-close{width:38px;height:38px;display:grid;place-items:center;border:1px solid var(--line);border-radius:10px;background:transparent;color:var(--text);font-size:18px;font-weight:900;cursor:pointer}
  .sponsor-neg-body{overflow:auto;padding:20px 22px}.sponsor-neg-columns{display:grid;grid-template-columns:.82fr 1.18fr;gap:16px}
  .sponsor-neg-current,.sponsor-neg-editor{padding:16px;border:1px solid var(--line);border-radius:15px;background:rgba(127,127,127,.025)}
  .sponsor-neg-current h3,.sponsor-neg-editor h3{font-size:11px;font-weight:950;text-transform:uppercase;letter-spacing:.06em}.sponsor-neg-current>p,.sponsor-neg-editor>p{margin-top:5px;color:var(--muted);font-size:9px;line-height:1.45}
  .sponsor-neg-current-grid{display:grid;gap:8px;margin-top:14px}.sponsor-neg-current-grid div{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 10px;border:1px solid rgba(127,127,127,.09);border-radius:9px;background:var(--card-solid)}.sponsor-neg-current-grid span{color:var(--muted);font-size:8px;font-weight:850;text-transform:uppercase}.sponsor-neg-current-grid strong{font-size:10px;font-weight:950;text-align:right}
  .sponsor-neg-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;margin-top:14px}.sponsor-neg-field{display:grid;gap:6px}.sponsor-neg-field.wide{grid-column:1/-1}.sponsor-neg-field>span{color:var(--muted);font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.04em}.sponsor-neg-field input,.sponsor-neg-field select{width:100%;height:42px;padding:0 11px;border:1px solid var(--line);border-radius:9px;background:var(--card-solid);color:var(--text);font:inherit;font-size:11px;font-weight:850;outline:none}.sponsor-neg-field input:focus,.sponsor-neg-field select:focus{border-color:var(--green-2);box-shadow:0 0 0 3px rgba(56,201,31,.08)}
  .sponsor-neg-toggle{min-height:42px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 11px;border:1px solid var(--line);border-radius:9px;background:var(--card-solid)}.sponsor-neg-toggle span{font-size:10px;font-weight:900}.sponsor-neg-toggle input{width:18px;height:18px;accent-color:var(--green-2)}
  .sponsor-neg-hint{margin-top:14px;padding:10px 12px;border-left:3px solid var(--green-2);border-radius:0 9px 9px 0;background:rgba(56,201,31,.055);color:var(--muted);font-size:9px;line-height:1.55}
  .sponsor-neg-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 22px;border-top:1px solid var(--line);background:rgba(127,127,127,.018)}.sponsor-neg-round{color:var(--muted);font-size:9px;font-weight:850}.sponsor-neg-actions{display:flex;gap:8px}.sponsor-neg-actions button{min-height:40px;padding:0 15px;border:1px solid var(--line);border-radius:10px;font-size:10px;font-weight:950;cursor:pointer}.sponsor-neg-cancel{background:transparent;color:var(--text)}.sponsor-neg-submit{border-color:transparent!important;background:var(--green-2);color:#07130a}.sponsor-neg-actions button:disabled{opacity:.5;cursor:not-allowed}
  @media(max-width:720px){.sponsor-neg-columns{grid-template-columns:1fr}.sponsor-neg-form{grid-template-columns:1fr}.sponsor-neg-field.wide{grid-column:auto}.sponsor-neg-body{padding:14px}.sponsor-neg-footer{align-items:stretch;flex-direction:column}.sponsor-neg-actions{display:grid;grid-template-columns:1fr 1fr}.sponsor-neg-actions button{width:100%}}
  `;
  document.head.appendChild(style);
}

function ensureModal(){
  ensureStyle();
  let overlay=document.getElementById('sponsorNegotiationModalV15');
  if(overlay)return overlay;
  overlay=document.createElement('div');
  overlay.id='sponsorNegotiationModalV15';
  overlay.className='sponsor-neg-v15 hidden';
  overlay.innerHTML=`<section class="sponsor-neg-card" role="dialog" aria-modal="true" aria-labelledby="sponsorNegTitle"><header class="sponsor-neg-head"><div><span>NEGOCIAÇÃO COM EMPRESÁRIO</span><h2 id="sponsorNegTitle">Monte sua contraproposta</h2><p>Você escolhe o que quer pedir. Seu empresário leva os termos para a marca.</p></div><button class="sponsor-neg-close" type="button" aria-label="Fechar">×</button></header><div class="sponsor-neg-body" id="sponsorNegBody"></div><footer class="sponsor-neg-footer"><div class="sponsor-neg-round" id="sponsorNegRound"></div><div class="sponsor-neg-actions"><button class="sponsor-neg-cancel" type="button">Cancelar</button><button class="sponsor-neg-submit" type="button">Enviar contraproposta</button></div></footer></section>`;
  document.body.appendChild(overlay);
  const close=()=>overlay.classList.add('hidden');
  overlay.querySelector('.sponsor-neg-close').addEventListener('click',close);
  overlay.querySelector('.sponsor-neg-cancel').addEventListener('click',close);
  overlay.addEventListener('click',event=>{if(event.target===overlay)close()});
  overlay.querySelector('.sponsor-neg-submit').addEventListener('click',submitCounter);
  return overlay;
}

async function getProposal(){
  const {data,error}=await supabase.rpc('get_career_sponsorship_state');
  if(error)throw error;
  return data?.proposal||null;
}

function currentPenalty(p){return Number(p?.terms?.penalty_policy?.first_miss_percent??25)}
function currentBonus(p){return Number(p?.terms?.bonus_policy?.multiplier??1)}

function render(proposal){
  const overlay=ensureModal();
  overlay.dataset.proposalId=proposal.id;
  overlay.dataset.messageId=proposal.message_id;
  const exclusive=Boolean(proposal.exclusivity_category);
  const body=overlay.querySelector('#sponsorNegBody');
  body.innerHTML=`<div class="sponsor-neg-columns"><section class="sponsor-neg-current"><h3>Proposta atual</h3><p>Estes são os termos que estão na mesa agora.</p><div class="sponsor-neg-current-grid">${Number(proposal.monthly_fee||0)>0?`<div><span>Mensalidade</span><strong>${money(proposal.monthly_fee)}</strong></div>`:''}<div><span>Luvas</span><strong>${money(proposal.signing_bonus)}</strong></div><div><span>Por ação</span><strong>${money(proposal.per_delivery_fee)}</strong></div><div><span>Duração</span><strong>${Number(proposal.contract_days||0)} dias</strong></div><div><span>Máximo semanal</span><strong>${Number(proposal.max_weekly_deliveries||1)}</strong></div><div><span>Exclusividade</span><strong>${exclusive?'Sim':'Não'}</strong></div><div><span>Multa por 1ª falta</span><strong>${currentPenalty(proposal)}% da ação</strong></div><div><span>Bônus esportivos</span><strong>${Math.round(currentBonus(proposal)*100)}%</strong></div></div></section><section class="sponsor-neg-editor"><h3>Sua contraproposta</h3><p>Altere somente o que você quer tentar melhorar.</p><div class="sponsor-neg-form">${Number(proposal.monthly_fee||0)>0?`<label class="sponsor-neg-field"><span>Mensalidade (R$)</span><input name="monthly_fee" type="number" min="0" step="50" value="${Number(proposal.monthly_fee||0)}"></label>`:''}<label class="sponsor-neg-field"><span>Luvas (R$)</span><input name="signing_bonus" type="number" min="0" step="50" value="${Number(proposal.signing_bonus||0)}"></label><label class="sponsor-neg-field"><span>Valor por ação (R$)</span><input name="per_delivery_fee" type="number" min="0" step="25" value="${Number(proposal.per_delivery_fee||0)}"></label><label class="sponsor-neg-field"><span>Duração (dias)</span><input name="contract_days" type="number" min="7" max="720" step="1" value="${Number(proposal.contract_days||0)}"></label><label class="sponsor-neg-field"><span>Máximo de ações por semana</span><select name="max_weekly_deliveries">${[1,2,3].map(n=>`<option value="${n}" ${Number(proposal.max_weekly_deliveries||1)===n?'selected':''}>${n}</option>`).join('')}</select></label><label class="sponsor-neg-field"><span>Multa na primeira falta</span><select name="first_miss_percent">${[0,10,15,20,25,30,40,50].map(n=>`<option value="${n}" ${currentPenalty(proposal)===n?'selected':''}>${n}% do valor da ação</option>`).join('')}</select></label><label class="sponsor-neg-field"><span>Bônus esportivos</span><select name="bonus_multiplier">${[1,1.1,1.25,1.5,1.75,2].map(n=>`<option value="${n}" ${Math.abs(currentBonus(proposal)-n)<.001?'selected':''}>${Math.round(n*100)}% do bônus-base</option>`).join('')}</select></label><label class="sponsor-neg-field wide"><span>Exclusividade</span><div class="sponsor-neg-toggle"><span>Aceitar exclusividade na categoria da marca</span><input name="exclusivity" type="checkbox" ${exclusive?'checked':''}></div></label></div><div class="sponsor-neg-hint">A marca não é obrigada a aceitar. Ela pode aprovar seu pedido, devolver uma contraproposta ou rejeitar a negociação. A interface não revela qual pedido tem maior chance.</div></section></div>`;
  overlay.querySelector('#sponsorNegRound').textContent=`Rodada ${Number(proposal.negotiation_round||0)+1} de 2`;
}

async function openNegotiation(){
  try{
    const proposal=await getProposal();
    if(!proposal){showToast('Patrocínio','Não há proposta comercial pendente.','error');return}
    if(Number(proposal.negotiation_round||0)>=2){showToast('Patrocínio','As duas rodadas de negociação já foram usadas.','error');return}
    render(proposal);
    ensureModal().classList.remove('hidden');
  }catch(error){showToast('Patrocínio',error?.message||'Não foi possível abrir a negociação.','error')}
}

function formTerms(overlay){
  const value=name=>overlay.querySelector(`[name="${name}"]`);
  const monthly=value('monthly_fee');
  return{
    ...(monthly?{monthly_fee:Number(monthly.value||0)}:{}),
    signing_bonus:Number(value('signing_bonus')?.value||0),
    per_delivery_fee:Number(value('per_delivery_fee')?.value||0),
    contract_days:Number(value('contract_days')?.value||7),
    max_weekly_deliveries:Number(value('max_weekly_deliveries')?.value||1),
    exclusivity:Boolean(value('exclusivity')?.checked),
    first_miss_percent:Number(value('first_miss_percent')?.value||0),
    bonus_multiplier:Number(value('bonus_multiplier')?.value||1)
  }
}

async function submitCounter(){
  if(busy)return;
  const overlay=ensureModal(),button=overlay.querySelector('.sponsor-neg-submit');
  busy=true;button.disabled=true;button.textContent='Enviando...';
  try{
    const {data,error}=await supabase.rpc('negotiate_career_sponsor_proposal',{
      p_opportunity_id:overlay.dataset.proposalId,
      p_message_id:overlay.dataset.messageId,
      p_counter_terms:formTerms(overlay)
    });
    if(error)throw error;
    const messages={accepted:'A marca aceitou os termos pedidos.',countered:'A marca devolveu uma contraproposta.',rejected:'A marca recusou os termos pedidos; a proposta anterior continua disponível.'};
    showToast('Patrocínio',messages[data?.status]||'Negociação concluída.','success');
    overlay.classList.add('hidden');
    window.dispatchEvent(new CustomEvent('career:updated'));
  }catch(error){showToast('Patrocínio',error?.message||'Não foi possível enviar a contraproposta.','error')}
  finally{busy=false;button.disabled=false;button.textContent='Enviar contraproposta'}
}

document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-sponsor-modal-response="negotiate"],[data-sponsor-response="negotiate"]');
  if(!button)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openNegotiation();
},true);
