// Career Hub loader: protects the page even when the browser still has an older
// career-service / enhancement module cached.
const NativeMutationObserver = window.MutationObserver;

if (NativeMutationObserver && !window.__careerObserverGuardInstalled) {
  window.__careerObserverGuardInstalled = true;
  window.MutationObserver = class CareerSafeMutationObserver extends NativeMutationObserver {
    observe(target, options = {}) {
      const safe = { ...options };
      if (target?.id === 'activityGrid') {
        // Never allow a price/icon decorator to observe its own descendants.
        safe.childList = true;
        safe.subtree = false;
      }
      if (target?.id === 'decisionModal' && safe.subtree) {
        // Event decoration only needs the modal open/close state.
        safe.attributes = true;
        safe.attributeFilter = ['class'];
        safe.childList = false;
        safe.subtree = false;
      }
      return super.observe(target, safe);
    }
  };
}

await import('./career-profile-v2.js?v=20260811-7');
await import('./career-v2.js?v=20260811-7');
