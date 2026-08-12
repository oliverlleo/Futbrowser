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

const matchHint = document.querySelector('.next-match-mini small');
if (matchHint) matchHint.textContent = 'A partida fica disponível no dia do jogo.';

await import('./career-profile-v2.js?v=20260811-12');
await import('./career-profile-history-v2.js?v=20260811-12');
await import('./career-team-pitch-v2.js?v=20260811-12');
await import('./career-match-runtime-v2.js?v=20260811-2');
await import('./career-v3.js?v=20260811-13');
await import('./career-avatar-sync.js?v=20260811-12');
await import('./career-development-loop.js?v=20260811-2');
