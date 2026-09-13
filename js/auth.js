/* ============================================================
   auth.js — Login, sessão e proteção de páginas
   ------------------------------------------------------------
   Agora quem valida usuária/senha de verdade é o Firebase
   Authentication (seguro, com senha criptografada no servidor
   do Google — bem diferente do hash caseiro que o sistema usava
   antes só com localStorage).

   O Firestore (users/{id}) guarda só os "metadados" de cada
   conta: a que participante ela pertence, se é admin ou
   integrante, e se está ativa ou não.
   ============================================================ */

const Auth = {
  // manterConectada = true  -> continua logada mesmo fechando o navegador
  // manterConectada = false -> desloga ao fechar a aba/navegador
  async login(username, senha, manterConectada) {
    const email = usernameParaEmail(username);

    await fbAuth.setPersistence(
      manterConectada
        ? firebase.auth.Auth.Persistence.LOCAL
        : firebase.auth.Auth.Persistence.SESSION
    );

    try {
      await fbAuth.signInWithEmailAndPassword(email, senha);
    } catch (err) {
      return { ok: false, msg: mensagemDeErro(err) };
    }

    const perfil = await buscarPerfilPorUsername(username);

    if (!perfil) {
      await fbAuth.signOut();
      return { ok: false, msg: 'Sua conta existe no login, mas não tem cadastro no sistema. Fale com a coordenação.' };
    }
    if (perfil.status === 'inativo') {
      await fbAuth.signOut();
      return { ok: false, msg: 'Esta conta está inativa. Fale com a coordenação.' };
    }

    return { ok: true, user: perfilParaSessao(perfil) };
  },

  async logout() {
    await fbAuth.signOut();
    window.location.href = 'index.html';
  },

  // Espera o Firebase confirmar se há alguém logado (é assíncrono
  // porque, ao abrir a página, o Firebase precisa checar isso antes
  // de dizer "sim" ou "não").
  async getCurrentUser() {
    const fbUser = await esperarEstadoDeAutenticacao();
    if (!fbUser) return null;

    const username = emailParaUsername(fbUser.email);
    const perfil = await buscarPerfilPorUsername(username);
    return perfil ? perfilParaSessao(perfil) : null;
  },

  // Chamar no topo de cada página protegida.
  async requireAuth(allowedRoles) {
    const user = await this.getCurrentUser();
    if (!user) {
      window.location.href = 'index.html';
      return null;
    }
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      window.location.href = 'dashboard.html';
      return null;
    }
    return user;
  },
};

function esperarEstadoDeAutenticacao() {
  return new Promise((resolve) => {
    const cancelar = fbAuth.onAuthStateChanged((fbUser) => {
      cancelar();
      resolve(fbUser);
    });
  });
}

async function buscarPerfilPorUsername(username) {
  const users = await DB.getUsers();
  return users.find((u) => u.username.trim().toLowerCase() === username.trim().toLowerCase()) || null;
}

function perfilParaSessao(perfil) {
  return {
    id: perfil.id,
    username: perfil.username,
    role: perfil.role,
    participanteId: perfil.participanteId || null,
  };
}

function mensagemDeErro(err) {
  const mapa = {
    'auth/invalid-email': 'Usuária inválida.',
    'auth/user-not-found': 'Usuária não encontrada.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-credential': 'Usuária ou senha incorreta.',
    'auth/too-many-requests': 'Muitas tentativas erradas. Aguarde um pouco e tente de novo.',
    'auth/network-request-failed': 'Sem conexão com a internet. Verifique sua rede e tente novamente.',
  };
  return mapa[err.code] || 'Não foi possível entrar. Tente novamente.';
}
