// Single source of truth for club identity: base_clubs.shield_url from Supabase.
// Existing clubs keep their stored asset path; generated clubs keep the generated
// data URI stored in that same field. The frontend never invents a second crest.
function resolveClubCrest(club = {}) {
  return String(club.shield_url || club.crest || '').trim() || 'img/logo.png';
}

function setImage(image, src) {
  if (!image || !src) return;
  image.onerror = () => {
    image.onerror = null;
    image.src = 'img/logo.png';
  };
  if (image.getAttribute('src') !== src) image.src = src;
}

function applyCanonicalClubCrest(hub) {
  const club = hub?.club || {};
  setImage(document.getElementById('clubCrest'), resolveClubCrest(club));
}

document.addEventListener('career:hub-rendered', event => {
  applyCanonicalClubCrest(event.detail);
});

window.__resolveCareerClubCrest = resolveClubCrest;

export { applyCanonicalClubCrest, resolveClubCrest };
