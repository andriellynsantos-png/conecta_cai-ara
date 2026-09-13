/* ============================================================
   app.js — Funções compartilhadas entre todas as páginas
   (navbar lateral, toasts, modal, cálculos de presença/falta)
   ============================================================ */

const PAGINAS_ADMIN = [
  { href: 'dashboard.html', icone: '', label: 'Dashboard', chave: 'dashboard' },
  { href: 'participantes.html', icone: '', label: 'Participantes', chave: 'participantes' },
  { href: 'chamada.html', icone: '', label: 'Fazer chamada', chave: 'chamada' },
  { href: 'historico.html', icone: '', label: 'Histórico', chave: 'historico' },
  { href: 'importacao.html', icone: '', label: 'Importar planilha', chave: 'importacao' },
  { href: 'contas.html', icone: '', label: 'Contas de acesso', chave: 'contas' },
];

const PAGINAS_INTEGRANTE = [
  { href: 'perfil.html', icone: '', label: 'Meu perfil', chave: 'perfil' },
];

function renderSidebar(user) {
  const container = document.getElementById('sidebar');
  if (!container) return;

  const paginaAtual = document.body.dataset.page || '';
  const itens = user.role === 'admin' ? PAGINAS_ADMIN : PAGINAS_INTEGRANTE;

  const linksHtml = itens
    .map(
      (item) => `
      <a href="${item.href}" class="${item.chave === paginaAtual ? 'ativo' : ''}">
        <span>${item.icone}</span> <span>${item.label}</span>
      </a>`
    )
    .join('');

  container.innerHTML = `
    <div class="marca">
      <img src="assets/logo.jpeg" alt="Logo Conecta Caiçara">
      <div class="titulo">Conecta Caiçara
        <small>Rodas sobre Areia</small>
      </div>
    </div>
    <nav>${linksHtml}</nav>
    <div class="rodape-usuario">
      <span class="nome">${escapeHtml(user.username)}</span>
      <span class="papel">${user.role === 'admin' ? 'Coordenação' : 'Integrante'}</span>
      <button class="btn-sair" id="btn-logout">Sair</button>
    </div>
  `;

  document.getElementById('btn-logout').addEventListener('click', () => Auth.logout());
}

async function iniciarPagina(allowedRoles) {
  const user = await Auth.requireAuth(allowedRoles);
  if (!user) return null;
  renderSidebar(user);
  configurarMenuMobile();
  return user;
}

function configurarMenuMobile() {
  const btn = document.getElementById('btn-menu-mobile');
  const sidebar = document.getElementById('sidebar');
  if (!btn || !sidebar) return;
  btn.addEventListener('click', () => sidebar.classList.toggle('aberta'));
  document.addEventListener('click', (e) => {
    if (sidebar.classList.contains('aberta') && !sidebar.contains(e.target) && e.target !== btn) {
      sidebar.classList.remove('aberta');
    }
  });
}

function escapeHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

// ---------------- Toasts (mensagens de sucesso/erro) ----------------

function garantirToastContainer() {
  let el = document.getElementById('toast-container');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast-container';
    document.body.appendChild(el);
  }
  return el;
}

function mostrarToast(mensagem, tipo = 'info') {
  const container = garantirToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${tipo}`;
  toast.textContent = mensagem;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3800);
}

// ---------------- Cálculos de presença / falta ----------------
// Regras (conforme especificação do projeto):
//   presença% = (nº de presenças / total de atividades) * 100
//   falta%    = (nº de faltas / total de atividades) * 100
//   faltas justificadas contam à parte, não entram no "falta%"

function calcularEstatisticasParticipante(chamadas, participanteId) {
  let presencas = 0;
  let faltas = 0;
  let justificadas = 0;
  let total = 0;

  chamadas.forEach((chamada) => {
    const registro = chamada.registros.find((r) => r.participanteId === participanteId);
    if (!registro) return; // participante não estava na lista dessa chamada
    total++;
    if (registro.status === 'presente') presencas++;
    else if (registro.status === 'falta') faltas++;
    else if (registro.status === 'justificada') justificadas++;
  });

  const pctPresenca = total > 0 ? (presencas / total) * 100 : 0;
  const pctFalta = total > 0 ? (faltas / total) * 100 : 0;

  return {
    total,
    presencas,
    faltas,
    justificadas,
    pctPresenca: Math.round(pctPresenca * 10) / 10,
    pctFalta: Math.round(pctFalta * 10) / 10,
  };
}

function calcularEstatisticasGerais(chamadas, participantes) {
  const porParticipante = participantes.map((p) => ({
    participante: p,
    stats: calcularEstatisticasParticipante(chamadas, p.id),
  }));

  const totalPresencas = porParticipante.reduce((s, p) => s + p.stats.presencas, 0);
  const totalFaltas = porParticipante.reduce((s, p) => s + p.stats.faltas, 0);
  const totalJustificadas = porParticipante.reduce((s, p) => s + p.stats.justificadas, 0);

  const mediaPresenca =
    porParticipante.length > 0
      ? porParticipante.reduce((s, p) => s + p.stats.pctPresenca, 0) / porParticipante.length
      : 0;

  return {
    porParticipante,
    totalPresencas,
    totalFaltas,
    totalJustificadas,
    totalAtividades: chamadas.length,
    mediaPresenca: Math.round(mediaPresenca * 10) / 10,
  };
}

function formatarData(isoDate) {
  if (!isoDate) return '—';
  const [ano, mes, dia] = isoDate.split('-');
  if (!ano || !mes || !dia) return isoDate;
  return `${dia}/${mes}/${ano}`;
}

function badgeStatus(status) {
  const mapa = {
    presente: ['Presente', 'badge-presente'],
    falta: ['Falta', 'badge-falta'],
    justificada: ['Justificada', 'badge-justificada'],
  };
  const [label, classe] = mapa[status] || [status, ''];
  return `<span class="badge ${classe}">${label}</span>`;
}

function iniciaisNome(nome) {
  const partes = (nome || '').trim().split(/\s+/);
  const iniciais = partes.slice(0, 2).map((p) => p[0]?.toUpperCase() || '');
  return iniciais.join('') || '?';
}

// ---------------- Criação de contas sem deslogar quem está criando ----------------
// Truque necessário porque firebase.auth().createUserWithEmailAndPassword()
// loga automaticamente como a conta recém-criada. Usamos um segundo app do
// Firebase (temporário, só pra esse cadastro) para não perder a sessão da
// coordenadora que está cadastrando outras contas.
async function criarContaFirebaseSemDeslogar(username, senha) {
  const nomeAppTemporario = `temp_${Date.now()}`;
  const appTemporario = firebase.initializeApp(firebaseConfig, nomeAppTemporario);
  try {
    const email = usernameParaEmail(username);
    await appTemporario.auth().createUserWithEmailAndPassword(email, senha);
    await appTemporario.auth().signOut();
    return { ok: true };
  } catch (err) {
    const mapa = {
      'auth/email-already-in-use': `Já existe uma conta com o usuário "${username}".`,
      'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
      'auth/invalid-email': 'Nome de usuária inválido — use apenas letras, números e ponto.',
    };
    return { ok: false, msg: mapa[err.code] || 'Não foi possível criar o login.' };
  } finally {
    await appTemporario.delete();
  }
}
