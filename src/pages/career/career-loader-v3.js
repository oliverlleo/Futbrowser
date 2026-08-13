// Career Hub loader: protects the page even when the browser still has an older
// career-service / enhancement module cached.
const NativeMutationObserver = window.MutationObserver;

if (NativeMutationObserver && !window.__careerObserverGuardInstalled) {
  window.__careerObserverGuardInstalled = true;
  window.MutationObserver = class CareerSafeMutationObserver extends NativeMutationObserver {
    observe(target, options = {}) {
      const safe = { ...options };
      if (target?.id === 'activityGrid') {
        safe.childList = true;
        safe.subtree = false;
      }
      if (target?.id === 'decisionModal' && safe.subtree) {
        safe.attributes = true;
        safe.attributeFilter = ['class'];
        safe.childList = false;
        safe.subtree = false;
      }
      return super.observe(target, safe);
    }
  };
}

if (!document.querySelector('link[data-career-match-hub-fix]')) {
  const matchHubFix = document.createElement('link');
  matchHubFix.rel = 'stylesheet';
  matchHubFix.href = 'src/pages/career/career-match-hub-fix.css?v=20260812-2';
  matchHubFix.dataset.careerMatchHubFix = '1';
  document.head.appendChild(matchHubFix);
}

const matchHint = document.querySelector('.next-match-mini small');
if (matchHint) matchHint.textContent = 'A partida fica disponível no dia do jogo.';

await import('./career-profile-v2.js?v=20260811-12');
await import('./career-profile-history-v2.js?v=20260811-12');
await import('./career-team-pitch-v2.js?v=20260811-12');

const competitionCenter = await import('./career-competition-center.js?v=20260812-2');
await competitionCenter.bootstrapCompetitionWorld();

await import('./career-match-formation-patch.js?v=20260811-2');
await import('./career-match-goalkeeper-patch.js?v=20260811-1');
await import('./career-match-football-flow-patch.js?v=20260811-2');
await import('./career-match-football-intelligence-patch.js?v=20260811-2');
await import('./career-match-flow-ui-patch.js?v=20260811-2');
await import('./career-match-workload-patch.js?v=20260812-1');
await import('./career-match-balance-v3.js?v=20260812-1');
await import('./career-match-action-balance-v4.js?v=20260813-1');
await import('./career-match-career-context-v6.js?v=20260813-1');
await import('./career-match-possession-chain-v5.js?v=20260813-1');
await import('./career-match-decision-option-guard.js?v=20260813-1');
await import('./career-match-gameplay-depth-v2.js?v=20260812-2');
await import('./career-match-gameplay-depth-ui.js?v=20260813-1');
await import('./career-match-backend-guard.js?v=20260812-1');
await import('./career-match-runtime-v3.js?v=20260812-2');
await import('./career-match-feedback-hold.js?v=20260813-1');
await import('./career-v3.js?v=20260812-1');
await import('./career-avatar-sync.js?v=20260811-12');
await import('./career-development-loop.js?v=20260813-1');
await import('./career-ui-usability-v6.js?v=20260813-1');
await import('./career-preparation-ui-v7.js?v=20260813-1');