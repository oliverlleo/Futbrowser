// ============================================================
// Futbrowser — Error Handlers
// ============================================================

export function traduzirErro(mensagem) {
  const msg = mensagem.toLowerCase();
  if (msg.includes('invalid login credentials')) return 'O e-mail ou a senha estão incorretos.';
  if (msg.includes('user already registered') || msg.includes('duplicate key value')) return 'Este usuário ou e-mail já está em uso em outro clube.';
  if (msg.includes('password should be at least')) return 'A senha é muito fraca. Tente uma senha mais forte.';
  if (msg.includes('invalid email')) return 'O formato do e-mail é inválido.';
  if (msg.includes('email rate limit exceeded')) return 'Você solicitou muitos e-mails recentemente. Aguarde um tempo e tente novamente.';
  
  // Esconder mensagens internas no frontend e usar genérica
  console.error("Erro interno:", mensagem); // Apenas no log dev
  return 'Ocorreu um erro no servidor. Tente novamente mais tarde.';
}
