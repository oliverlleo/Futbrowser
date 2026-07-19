const fs = require('fs');
let code = fs.readFileSync('src/pages/dashboard/offers-ui.js', 'utf8');
code = code.replace(/export /g, '');
code = code.replace(/import .*;/g, '');
code += `
// Mock DOM
global.document = {
    getElementById: (id) => ({ innerHTML: '', classList: { add: ()=>{}, remove: ()=>{} }, onclick: null, addEventListener: ()=>{} }),
    querySelector: () => ({ classList: { add: ()=>{}, remove: ()=>{} }, innerText: '' }),
    querySelectorAll: () => []
};
global.window = {};

// Mock data
currentDossier = {
    offer: { current_terms: { monthly_wage: 1000, squad_role: 'Titular' }, status: 'pending', history: [] },
    club: { name: 'Test', city: 'Test', reputation: 3, formation: '4-3-3', play_style: 'Ofensivo' },
    coach: { name: 'Test Coach', profile: 'Tático', impacts: { tolerance_to_bad_games: 'high', morale_initial_bonus: 1 } },
    academy: { physical: 5, speed: 4, technical: 3, recovery: 2, tactical: 1 },
    snapshot: { chance_of_play: 'Alta', club_overall: 70, average_age: 25 },
    compatibility_breakdown: { total: 80 }
};
currentPlayer = { posicao: 'ATA' };

try {
    renderContractPanel();
    console.log('renderContractPanel passed');
} catch (e) {
    console.error('Error in renderContractPanel:', e);
}
`;
fs.writeFileSync('test_runner.js', code);
