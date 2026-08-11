// ============================================================
// Futbrowser — Toast Component
// ============================================================

const TOAST_STYLE_ID = 'futbrowser-toast-styles';
const TOAST_DURATION = 4000;

const TOAST_META = {
  info: {
    label: 'Informação',
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 10v6"></path><path d="M12 7.2h.01"></path></svg>'
  },
  success: {
    label: 'Concluído',
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="m8.5 12 2.25 2.25L15.8 9.2"></path></svg>'
  },
  error: {
    label: 'Atenção',
    icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.3 4.5 3.7 16a2 2 0 0 0 1.74 3h13.12a2 2 0 0 0 1.74-3L13.7 4.5a2 2 0 0 0-3.4 0Z"></path><path d="M12 9v4"></path><path d="M12 16.5h.01"></path></svg>'
  }
};

function normalizeType(type) {
  if (type === 'sucesso') return 'success';
  if (type === 'erro') return 'error';
  return TOAST_META[type] ? type : 'info';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function ensureToastStyles() {
  if (document.getElementById(TOAST_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = TOAST_STYLE_ID;
  style.textContent = `
    #toast-container.fb-toast-container {
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 99999;
      width: min(390px, calc(100vw - 32px));
      display: grid;
      gap: 12px;
      pointer-events: none;
    }

    #toast-container .fb-toast {
      --toast-accent: #5b7cfa;
      --toast-accent-soft: rgba(91, 124, 250, .13);
      position: relative;
      width: 100%;
      min-height: 76px;
      display: grid;
      grid-template-columns: 42px minmax(0, 1fr) 30px;
      align-items: center;
      gap: 12px;
      padding: 14px 14px 14px 16px;
      overflow: hidden;
      border: 1px solid rgba(15, 28, 45, .10);
      border-radius: 16px;
      background: rgba(255, 255, 255, .94);
      box-shadow: 0 18px 48px rgba(15, 28, 45, .16), 0 3px 10px rgba(15, 28, 45, .06);
      color: #10192a;
      backdrop-filter: blur(18px) saturate(145%);
      -webkit-backdrop-filter: blur(18px) saturate(145%);
      pointer-events: auto;
      opacity: 0;
      transform: translate3d(24px, -6px, 0) scale(.985);
      transition: opacity .22s ease, transform .28s cubic-bezier(.2, .8, .2, 1), border-color .2s ease;
    }

    #toast-container .fb-toast::before {
      content: '';
      position: absolute;
      inset: 0 auto 0 0;
      width: 4px;
      background: var(--toast-accent);
    }

    #toast-container .fb-toast.show {
      opacity: 1;
      transform: translate3d(0, 0, 0) scale(1);
    }

    #toast-container .fb-toast.success {
      --toast-accent: #28b814;
      --toast-accent-soft: rgba(40, 184, 20, .12);
    }

    #toast-container .fb-toast.error {
      --toast-accent: #e45151;
      --toast-accent-soft: rgba(228, 81, 81, .12);
    }

    #toast-container .fb-toast.info {
      --toast-accent: #3d78f2;
      --toast-accent-soft: rgba(61, 120, 242, .12);
    }

    #toast-container .fb-toast-icon {
      width: 42px;
      height: 42px;
      display: grid;
      place-items: center;
      border-radius: 13px;
      background: var(--toast-accent-soft);
      color: var(--toast-accent);
    }

    #toast-container .fb-toast-icon svg {
      width: 22px;
      height: 22px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    #toast-container .fb-toast-copy {
      min-width: 0;
    }

    #toast-container .fb-toast-kicker {
      display: block;
      margin-bottom: 3px;
      color: var(--toast-accent);
      font-size: 10px;
      line-height: 1.2;
      font-weight: 900;
      letter-spacing: .11em;
      text-transform: uppercase;
    }

    #toast-container .fb-toast-title {
      margin: 0 0 3px;
      color: inherit;
      font-size: 14px;
      line-height: 1.25;
      font-weight: 900;
      letter-spacing: -.01em;
    }

    #toast-container .fb-toast-message {
      margin: 0;
      color: #5e6c80;
      font-size: 13px;
      line-height: 1.4;
      font-weight: 650;
    }

    #toast-container .fb-toast:not(.has-title) .fb-toast-message {
      color: #1b2638;
      font-size: 14px;
      font-weight: 800;
    }

    #toast-container .fb-toast-close {
      width: 30px;
      height: 30px;
      display: grid;
      place-items: center;
      align-self: start;
      border: 0;
      border-radius: 9px;
      background: transparent;
      color: #8390a2;
      cursor: pointer;
      transition: background .18s ease, color .18s ease, transform .18s ease;
    }

    #toast-container .fb-toast-close:hover {
      background: rgba(15, 28, 45, .07);
      color: #172236;
    }

    #toast-container .fb-toast-close:active {
      transform: scale(.94);
    }

    #toast-container .fb-toast-close svg {
      width: 17px;
      height: 17px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
    }

    #toast-container .fb-toast-progress {
      position: absolute;
      right: 0;
      bottom: 0;
      left: 4px;
      height: 2px;
      overflow: hidden;
      background: rgba(15, 28, 45, .05);
    }

    #toast-container .fb-toast-progress::after {
      content: '';
      display: block;
      width: 100%;
      height: 100%;
      background: var(--toast-accent);
      transform-origin: left center;
      animation: fbToastProgress ${TOAST_DURATION}ms linear forwards;
    }

    html[data-theme='dark'] #toast-container .fb-toast {
      border-color: rgba(255, 255, 255, .10);
      background: rgba(10, 20, 32, .94);
      box-shadow: 0 20px 52px rgba(0, 0, 0, .36);
      color: #f2f7ff;
    }

    html[data-theme='dark'] #toast-container .fb-toast-message,
    html[data-theme='dark'] #toast-container .fb-toast:not(.has-title) .fb-toast-message {
      color: #c0cada;
    }

    html[data-theme='dark'] #toast-container .fb-toast:not(.has-title) .fb-toast-message {
      color: #eef5ff;
    }

    html[data-theme='dark'] #toast-container .fb-toast-close:hover {
      background: rgba(255, 255, 255, .08);
      color: #fff;
    }

    @keyframes fbToastProgress {
      from { transform: scaleX(1); }
      to { transform: scaleX(0); }
    }

    @media (max-width: 620px) {
      #toast-container.fb-toast-container {
        top: auto;
        right: 16px;
        bottom: 18px;
        left: 16px;
        width: auto;
      }

      #toast-container .fb-toast {
        min-height: 70px;
        border-radius: 14px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      #toast-container .fb-toast,
      #toast-container .fb-toast-progress::after {
        transition: none;
        animation: none;
      }
    }
  `;

  document.head.appendChild(style);
}

function createToastContainer() {
  ensureToastStyles();

  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  container.classList.add('fb-toast-container');
  container.setAttribute('aria-live', 'polite');
  container.setAttribute('aria-atomic', 'false');
  return container;
}

function removeToast(toast) {
  if (!toast || toast.dataset.closing === 'true') return;
  toast.dataset.closing = 'true';
  toast.classList.remove('show');
  toast.style.opacity = '0';
  toast.style.transform = 'translate3d(18px, -4px, 0) scale(.985)';

  window.setTimeout(() => toast.remove(), 260);
}

export function showToast(title, message, type = 'info') {
  const container = createToastContainer();
  const normalizedType = normalizeType(type);
  const meta = TOAST_META[normalizedType];

  const toast = document.createElement('div');
  toast.className = `fb-toast game-toast toast ${normalizedType} ${title ? 'has-title' : ''}`;
  toast.setAttribute('role', normalizedType === 'error' ? 'alert' : 'status');

  toast.innerHTML = `
    <div class="fb-toast-icon">${meta.icon}</div>
    <div class="fb-toast-copy">
      <span class="fb-toast-kicker">${meta.label}</span>
      ${title ? `<h4 class="fb-toast-title">${escapeHtml(title)}</h4>` : ''}
      <p class="fb-toast-message">${escapeHtml(message)}</p>
    </div>
    <button class="fb-toast-close" type="button" aria-label="Fechar notificação" title="Fechar">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg>
    </button>
    <div class="fb-toast-progress" aria-hidden="true"></div>
  `;

  const closeButton = toast.querySelector('.fb-toast-close');
  closeButton.addEventListener('click', () => removeToast(toast));

  container.appendChild(toast);

  // Evita uma coluna infinita de notificações em ações rápidas.
  const toasts = [...container.querySelectorAll('.fb-toast')];
  if (toasts.length > 3) {
    removeToast(toasts[0]);
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });

  window.setTimeout(() => removeToast(toast), TOAST_DURATION);
}
