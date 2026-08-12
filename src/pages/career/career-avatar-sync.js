import { getCareerHub } from '../../services/career-service.js?v=20260811-10';

const AVATAR_FILE_RE = /^avatar(?:[1-9]|1[0-9]|2[01])\.webp$/i;

function canonicalAvatarPath(raw) {
  const value = String(raw || '').trim().replaceAll('\\', '/');
  if (!value) return null;

  const file = value.split('/').pop();
  if (AVATAR_FILE_RE.test(file)) return `img/avatar/${file.toLowerCase()}`;

  const numeric = value.match(/^(?:avatar)?(\d{1,2})(?:\.webp)?$/i);
  if (numeric) {
    const number = Number(numeric[1]);
    if (number >= 1 && number <= 21 && number !== 16 && number !== 18) {
      return `img/avatar/avatar${number}.webp`;
    }
  }

  return null;
}

function installAvatarGuard(img, selectedPath) {
  if (!img || !selectedPath) return;

  const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  if (!descriptor?.get || !descriptor?.set) {
    img.src = selectedPath;
    return;
  }

  img.dataset.selectedAvatar = selectedPath;

  if (!img.dataset.avatarGuardInstalled) {
    Object.defineProperty(img, 'src', {
      configurable: true,
      enumerable: true,
      get() {
        return descriptor.get.call(this);
      },
      set(nextValue) {
        const requested = String(nextValue || '');
        const expected = this.dataset.selectedAvatar;
        const requestedFile = requested.split('/').pop();
        const expectedFile = expected?.split('/').pop();

        // O Career antigo usava avatar1 como fallback. Nunca permita trocar
        // silenciosamente a escolha do usuário por outro rosto.
        if (expected && requestedFile === 'avatar1.webp' && expectedFile !== 'avatar1.webp') {
          descriptor.set.call(this, expected);
          return;
        }

        const normalized = canonicalAvatarPath(requested);
        descriptor.set.call(this, normalized || requested);
      }
    });
    img.dataset.avatarGuardInstalled = 'true';
  }

  img.onerror = () => {
    img.onerror = null;
    img.classList.add('avatar-load-error');
    img.removeAttribute('src');
    img.setAttribute('aria-label', 'Avatar escolhido indisponível');
    console.error('Avatar escolhido não pôde ser carregado:', selectedPath);
  };

  img.classList.remove('avatar-load-error');
  img.src = selectedPath;
}

function syncVisibleAvatars(selectedPath) {
  installAvatarGuard(document.getElementById('careerAvatar'), selectedPath);

  const profileAvatar = document.querySelector('#playerProfileContent .meta-hero.player-hero img');
  if (profileAvatar) installAvatarGuard(profileAvatar, selectedPath);
}

async function initAvatarSync() {
  try {
    const hub = await getCareerHub();
    const selectedPath = canonicalAvatarPath(hub?.player?.avatar);
    if (!selectedPath) {
      console.error('Avatar salvo em formato inválido:', hub?.player?.avatar);
      return;
    }

    // Mantém a escolha disponível para diagnosticar/cache local, mas o banco
    // continua sendo a fonte de verdade da carreira.
    try { localStorage.setItem('futbrowser:selected-avatar', hub.player.avatar); } catch (_) {}

    syncVisibleAvatars(selectedPath);

    // O perfil é renderizado sob demanda. Reaplica apenas após cliques que
    // realmente podem reconstruir o cabeçalho do perfil — sem MutationObserver.
    document.addEventListener('click', event => {
      if (event.target.closest('.identity-player, [data-player-tab]')) {
        requestAnimationFrame(() => syncVisibleAvatars(selectedPath));
      }
    });

    // Toda ação de carreira pode redesenhar a identidade principal.
    document.addEventListener('career:activities-rendered', () => syncVisibleAvatars(selectedPath));
    document.addEventListener('career:decision-opened', () => syncVisibleAvatars(selectedPath));
  } catch (error) {
    console.error('Falha ao sincronizar avatar escolhido:', error);
  }
}

initAvatarSync();
