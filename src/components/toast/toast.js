// ============================================================
// Futbrowser — Toast Component
// ============================================================

function createToastContainer() {
  if (!document.getElementById('toast-container')) {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
}

export function showToast(title, message, type = 'info') {
  createToastContainer();
  const container = document.getElementById('toast-container');

  const toast = document.createElement('div');
  toast.className = `game-toast ${type} toast ${type}`; // classes to keep compatibility

  const icon = type === 'erro' || type === 'error' ? '⚠️' : type === 'sucesso' || type === 'success' ? '✅' : 'ℹ️';

  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-body">
      ${title ? `<h4>${title}</h4>` : ''}
      <p>${message}</p>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;

  container.appendChild(toast);

  // Fallback class from dashboard.js
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease-in forwards';
    toast.classList.remove('show');
    setTimeout(() => {
      if (container.contains(toast)) {
        toast.remove();
      }
    }, 400);
  }, 4000);
}
