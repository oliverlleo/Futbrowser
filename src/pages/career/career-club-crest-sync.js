// The database is the single source of truth for a club crest.
// Do not infer assets from the club name and do not keep a second crest map.
function applyCanonicalClubCrest(hub) {
  const club = hub?.club || {};
  const crest = String(club.shield_url || '').trim();
  if (!crest) return;

  const image = document.getElementById('clubCrest');
  if (!image) return;

  image.onerror = () => {
    image.onerror = null;
    image.src = 'img/logo.png';
  };

  if (image.getAttribute('src') !== crest) image.src = crest;
}

document.addEventListener('career:hub-rendered', event => {
  applyCanonicalClubCrest(event.detail);
});

export { applyCanonicalClubCrest };
