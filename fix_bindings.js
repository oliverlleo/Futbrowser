const fs = require('fs');
let code = fs.readFileSync('src/pages/dashboard/offers-ui.js', 'utf8');

// Replace club stats logic
const oldClubLogic = `const clubOvr = club.ovr !== undefined ? club.ovr : "Dado indisponível";
    const clubStyle = club.style || "Dado indisponível";
    const clubFormation = club.formation || "Dado indisponível";
    if (club.ovr === undefined) console.error("Dado indisponível: club.ovr");
    if (!club.style) console.error("Dado indisponível: club.style");
    if (!club.formation) console.error("Dado indisponível: club.formation");`;

const newClubLogic = `const snapshotData = currentDossier.snapshot_data || currentDossier.snapshot || {};
    const clubOvr = snapshotData.club_overall !== undefined ? snapshotData.club_overall : (club.ovr || "Dado indisponível");
    const clubStyle = club.style || "Dado indisponível";
    const clubFormation = club.formation || "Dado indisponível";`;

code = code.replace(oldClubLogic, newClubLogic);

// Replace chance_of_play to use snapshot_data
code = code.replace(/\$\{currentDossier\.snapshot\?\.chance_of_play \|\| 'Indisponível'\}/g, 
    "${(currentDossier.snapshot_data?.chance_of_play || currentDossier.snapshot?.chance_of_play) || 'Indisponível'}");

// Remove console.error that spams the console
code = code.replace(/if \(!acad \|\| validAcadAreas\.length < 5\) console\.error\("Dado indisponível: áreas da academia ausentes"\);/, "");

code = code.replace(/const coachProf = coach\.profile !== undefined \? coach\.profile : "Dado indisponível";\s+if \(coach\.profile === undefined\) console\.error\("Dado indisponível: coach\.profile"\);/,
    'const coachProf = coach.profile !== undefined ? coach.profile : "Dado indisponível";');

code = code.replace(/if \(impacts\.tolerance_to_bad_games === undefined\) console\.error\("Dado indisponível: tolerance_to_bad_games"\);/, "");

code = code.replace(/} else \{\s+console\.error\("Dado indisponível: dossier\.roster"\);\s+\}/, "");

fs.writeFileSync('src/pages/dashboard/offers-ui.js', code);
console.log('Successfully updated bindings and removed console errors.');
