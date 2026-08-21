const boot = document.getElementById('pageBoot');
const bootMessage = document.getElementById('pageBootMessage');

export function updatePageBootMessage(message) {
  if (bootMessage && message) bootMessage.textContent = message;
}

export function finishPageBoot() {
  if (!boot) return;
  boot.classList.add('is-ready');
  document.documentElement.classList.remove('page-booting');
  window.setTimeout(() => boot.remove(), 520);
}

export function failPageBoot(message = 'Não foi possível carregar agora. Recarregue a página.') {
  if (!boot) return;
  boot.classList.add('is-error');
  updatePageBootMessage(message);
  const progress = boot.querySelector('.page-boot-progress span');
  if (progress) progress.style.animationPlayState = 'paused';
}

window.FutbrowserPageBoot = {
  update: updatePageBootMessage,
  finish: finishPageBoot,
  fail: failPageBoot
};
