document.addEventListener('click', event => {
  const button = event.target.closest?.('.choose-btn[data-role="manager"]');
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  window.location.href = 'manager.html';
}, true);
