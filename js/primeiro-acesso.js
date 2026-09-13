/* ============================================================
   primeiro-acesso.js
   ------------------------------------------------------------
   Só permite criar a conta se ainda NÃO existir nenhuma conta
   no sistema. Depois que a primeira coordenadora é criada, essa
   página se recusa a criar outra (use "Contas de acesso" dentro
   do sistema, já logada).
   ============================================================ */

(async function () {
  const form = document.getElementById('form-primeiro-acesso');
  const areaMsg = document.getElementById('area-mensagem');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    areaMsg.innerHTML = '';

    const usuario = document.getElementById('usuario').value.trim();
    const senha = document.getElementById('senha').value;
    const confirmar = document.getElementById('senha-confirmar').value;
    const botao = form.querySelector('button[type=submit]');

    if (senha !== confirmar) {
      areaMsg.innerHTML = '<div class="msg-erro" style="margin-bottom:14px;">As senhas não coincidem.</div>';
      return;
    }

    botao.disabled = true;
    botao.textContent = 'Verificando...';

    try {
      const usuariosExistentes = await DB.getUsers();
      if (usuariosExistentes.length > 0) {
        areaMsg.innerHTML = `
          <div class="msg-erro" style="margin-bottom:14px;">
            O sistema já tem contas cadastradas. Peça para uma coordenadora criar seu acesso em "Contas de acesso".
          </div>`;
        botao.disabled = false;
        botao.textContent = 'Criar conta de coordenação';
        return;
      }

      botao.textContent = 'Criando conta...';
      const email = usernameParaEmail(usuario);
      await fbAuth.createUserWithEmailAndPassword(email, senha);

      const novoAdmin = {
        id: ccUid('user'),
        username: usuario,
        role: 'admin',
        participanteId: null,
        status: 'ativo',
        criadoEm: new Date().toISOString(),
      };
      await DB.saveUsers([novoAdmin]);

      areaMsg.innerHTML = '<div class="msg-sucesso" style="margin-bottom:14px;">Conta criada! Redirecionando...</div>';
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 900);
    } catch (err) {
      console.error(err);
      const mapa = {
        'auth/email-already-in-use': 'Já existe uma conta com esse nome de usuária.',
        'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
        'auth/invalid-email': 'Nome de usuária inválido — use apenas letras, números e ponto.',
      };
      areaMsg.innerHTML = `<div class="msg-erro" style="margin-bottom:14px;">${mapa[err.code] || 'Não foi possível criar a conta. Tente novamente.'}</div>`;
      botao.disabled = false;
      botao.textContent = 'Criar conta de coordenação';
    }
  });
})();
