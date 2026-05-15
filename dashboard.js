// Lógica do Dashboard
import { supabase, getCurrentSession } from './authService.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Aplicar background baseado na hora (Dia/Noite)
    const hour = new Date().getHours();
    const isDay = hour >= 6 && hour < 18;
    document.body.style.backgroundImage = isDay ? "url('./img/background dia.png')" : "url('./img/background noite.png')";

    // Verificar se o usuário está logado
    const session = await getCurrentSession();

    if (!session) {
        window.location.href = 'index.html'; // Redirecionar se não estiver logado
        return;
    }

    // Funcionalidade de Logout
    document.getElementById('btn-logout').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    });

    // Seleção de Caminho
    const cards = document.querySelectorAll('.role-card');
    cards.forEach(card => {
        card.addEventListener('click', async () => {
            const role = card.getAttribute('data-role');
            await salvarCaminho(session.user.id, role);
        });
    });
});

async function salvarCaminho(userId, role) {
    try {
        mostrarToast(`Salvando sua escolha como ${role.toUpperCase()}...`, 'info');

        // Atualizar o banco de dados
        const { error } = await supabase
            .from('usuarios')
            .update({ caminho: role })
            .eq('id', userId);

        if (error) throw error;

        mostrarToast('Caminho escolhido com sucesso!', 'success');

        // Aguarda um pouco e redireciona para o proximo passo do jogo
        setTimeout(() => {
            // window.location.href = 'game.html'; // ou a proxima tela
            mostrarToast('Indo para a próxima etapa...', 'info');
        }, 2000);

    } catch (error) {
        console.error('Erro ao salvar caminho:', error);
        mostrarToast('Erro ao salvar escolha. Tente novamente.', 'error');
    }
}

// Sistema de Toast
function mostrarToast(mensagem, tipo = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.innerText = mensagem;

    container.appendChild(toast);

    // Trigger animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (container.contains(toast)) {
                container.removeChild(toast);
            }
        }, 400); // wait for animation to finish
    }, 3000);
}
