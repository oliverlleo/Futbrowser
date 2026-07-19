import re
import traceback

js_path = r"e:\Retro\Futbrowser-main-867521807862020950\Futbrowser-main-867521807862020950\src\pages\dashboard\offers-ui.js"

try:
    with open(js_path, "r", encoding="utf-8") as f:
        content = f.read()

    new_academy_coach_logic = """document.getElementById('fmAcademy').innerHTML = '';

    // Process Academy Stats to find Advantage and Disadvantage
    const ac = currentDossier.academy || { physical: 3, tactical: 3, technical: 3, speed: 3, recovery: 3 };
    const acStats = [
        { name: 'Força e Físico', val: ac.physical || 3 },
        { name: 'Leitura Tática', val: ac.tactical || 3 },
        { name: 'Técnica e Domínio', val: ac.technical || 3 },
        { name: 'Velocidade', val: ac.speed || 3 },
        { name: 'Prevenção Médica', val: ac.recovery || 3 }
    ];
    acStats.sort((a,b) => b.val - a.val);
    const bestStat = acStats[0];
    const worstStat = acStats[acStats.length - 1];
    const avgStars = Math.round(((ac.physical||3) + (ac.tactical||3) + (ac.technical||3) + (ac.speed||3) + (ac.recovery||3)) / 5);

    document.getElementById('fmAcademy').innerHTML = `
        <div style="padding:1.5rem">
            <h3 style="margin-bottom:1rem; font-size:1.1rem; font-weight:800; color:var(--text)">Estrutura da Academia</h3>
            <div class="fm-box" style="margin-bottom:1rem">
                <div class="fm-data-row" style="padding:1rem 0"><span>Nível Geral</span><strong class="fm-stars">${'★'.repeat(avgStars)}${'☆'.repeat(5-avgStars)}</strong></div>
                <div class="fm-data-row" style="padding:1rem 0"><span>Centro de Treinamento</span><strong style="color:var(--green)">${avgStars >= 4 ? 'Moderno' : (avgStars >= 3 ? 'Adequado' : 'Básico')}</strong></div>
            </div>
            
            <div class="fm-overview-grid" style="grid-template-columns:1fr 1fr; padding:0; gap:1rem; margin-bottom:1rem">
                <div class="fm-box" style="border-top: 3px solid var(--green)">
                    <div class="fm-box-title" style="color:var(--green)">Vantagem (Foco)</div>
                    <div style="font-size:1.1rem; font-weight:800; margin-bottom:0.25rem">${bestStat.name}</div>
                    <p style="font-size:0.75rem; color:var(--muted)">Atributos relacionados ganham XP extra devido à excelente estrutura.</p>
                </div>
                <div class="fm-box" style="border-top: 3px solid var(--danger)">
                    <div class="fm-box-title" style="color:var(--danger)">Desvantagem (Déficit)</div>
                    <div style="font-size:1.1rem; font-weight:800; margin-bottom:0.25rem">${worstStat.name}</div>
                    <p style="font-size:0.75rem; color:var(--muted)">A falta de equipamento prejudica o desenvolvimento desta área.</p>
                </div>
            </div>
        </div>
    `;

    const co = currentDossier.coach?.impacts || {};
    const moraleBonus = co.morale_initial_bonus || 0;
    const prefStyle = co.preferred_style || 'Equilibrado';
    const prefForm = co.preferred_formation || '4-3-3';
    const prefArch = co.preferred_archetype || 'Qualquer';

    document.getElementById('fmCoach').innerHTML = `
        <div style="padding:1.5rem">
            <h3 style="margin-bottom:1rem; font-size:1.1rem; font-weight:800; color:var(--text)">Relatório do Treinador</h3>
            <div class="fm-box" style="margin-bottom:1.5rem">
                <div class="fm-coach-flex" style="margin-bottom:1rem">
                    <img src="${coachImg}" alt="${coach.name}" onerror="this.src='img/avatar/avatar4.webp'" style="width:100px; height:100px;">
                    <div style="flex:1">
                        <strong style="display:block; font-size:1.4rem; margin-bottom:2px">${coach.name}</strong>
                        <span style="font-size:0.85rem; color:var(--muted)">Estilo: ${prefStyle} (${prefForm})</span>
                    </div>
                </div>
                <p style="font-size:0.8rem; color:var(--muted); line-height:1.5">O treinador ${coach.name} tem preferência por jogar no estilo ${prefStyle}. Ele costuma buscar jogadores com o arquétipo de <strong>${prefArch}</strong> para encaixar no seu esquema.</p>
            </div>
            
            <div class="fm-overview-grid" style="grid-template-columns:1fr 1fr; padding:0; gap:1rem;">
                <div class="fm-box">
                    <div class="fm-box-title">Gestão de Vestiário</div>
                    <div style="font-size:1.5rem; font-weight:800; color:${moraleBonus > 0 ? 'var(--green)' : (moraleBonus < 0 ? 'var(--danger)' : '#f59e0b')}">${moraleBonus > 0 ? 'Motivador' : (moraleBonus < 0 ? 'Rígido/Duro' : 'Neutro')}</div>
                    <p style="font-size:0.75rem; color:var(--muted); margin-top:0.5rem">Impacto no moral: ${moraleBonus > 0 ? '+'+moraleBonus : moraleBonus}. ${moraleBonus > 0 ? 'Mantém o time feliz facilmente.' : 'Pode punir severamente em caso de falhas.'}</p>
                </div>
                <div class="fm-box">
                    <div class="fm-box-title">Esquema Tático</div>
                    <div style="font-size:1.5rem; font-weight:800; color:var(--text)">${prefForm}</div>
                    <p style="font-size:0.75rem; color:var(--muted); margin-top:0.5rem">Sua flexibilidade de alterar esta formação é baixa.</p>
                </div>
            </div>
        </div>
    `;
"""
    
    parts1 = content.split("document.getElementById('fmAcademy').innerHTML = `")
    if len(parts1) == 2:
        parts2 = parts1[1].split("function renderContractPanel()")
        if len(parts2) == 2:
            new_content = parts1[0] + new_academy_coach_logic + "\n}\n\nfunction renderContractPanel()" + parts2[1]
            with open(js_path, "w", encoding="utf-8") as f:
                f.write(new_content)
            print("Successfully updated UI JS")
        else:
            print("Failed to split part 2")
    else:
        print("Failed to split part 1")

except Exception as e:
    print(traceback.format_exc())
