// Clubs that already had hand-made assets before the competition engine must
// always keep those assets. Generated/database crests are used only when the
// club has no existing asset registered here.
const EXISTING_CLUB_ASSETS = [
  {
    names: ['Academia Aurora Sub-18', 'Academia Aurora', 'AAS'],
    src: 'img/clubs/academia_aurora_sub_18.png'
  },
  {
    names: ['Atlético do Vale Sub-18', 'Atlético do Vale', 'ADV'],
    src: 'img/clubs/atletico_do_vale_sub_18.png'
  },
  {
    names: ['Ferroviário Central Sub-18', 'Ferroviário Central', 'FCS'],
    src: 'img/clubs/ferroviario_central_sub_18.png'
  },
  {
    names: ['Real Horizonte Sub-18', 'Real Horizonte', 'RHS'],
    src: 'img/clubs/real_horizonte_sub_18.png'
  },
  {
    names: ['União Litorânea Sub-18', 'União Litorânea', 'ULS'],
    src: 'img/clubs/uniao_litoranea_sub_18.png'
  }
];

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function existingAssetFor(value) {
  const text = normalize(value);
  if (!text) return '';
  const entry = EXISTING_CLUB_ASSETS.find(item =>
    item.names.some(name => {
      const alias = normalize(name);
      return text === alias || text.includes(alias);
    })
  );
  return entry?.src || '';
}

function resolveClubCrest(club = {}) {
  const existing = existingAssetFor(club.name) || existingAssetFor(club.short_name);
  if (existing) return existing;
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
  patchRenderedClubCrests();
}

function patchRenderedClubCrests() {
  // Competition cards use short names/monograms, so inspect the text around
  // each crest and restore an existing hand-made asset when one is known.
  const roots = [
    document.getElementById('competitionOverlay'),
    document.getElementById('careerCompetitionTeaser'),
    document.querySelector('.meta-hero')
  ].filter(Boolean);

  for (const root of roots) {
    for (const image of root.querySelectorAll('img')) {
      const context = image.parentElement?.textContent || image.closest('article, div, section')?.textContent || '';
      const existing = existingAssetFor(context);
      if (existing) setImage(image, existing);
    }
  }
}

document.addEventListener('career:hub-rendered', event => {
  applyCanonicalClubCrest(event.detail);
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', patchRenderedClubCrests, { once: true });
} else {
  patchRenderedClubCrests();
}

// The competition center is rendered dynamically. Watch only structural
// changes; changing an image src does not retrigger this observer.
const crestObserver = new MutationObserver(mutations => {
  if (mutations.some(mutation => mutation.addedNodes.length)) {
    queueMicrotask(patchRenderedClubCrests);
  }
});
crestObserver.observe(document.documentElement, { childList: true, subtree: true });

window.__resolveCareerClubCrest = resolveClubCrest;

export { applyCanonicalClubCrest, patchRenderedClubCrests, resolveClubCrest };
