/* ============================================================
   contas.js — criação de logins, redefinição de senha e
   ativação/inativação de contas (somente admin)
   ============================================================ */

(async function () {
  const user = await iniciarPagina(['admin']);
  if (!user) return;

  const modalConta = document.getElementById('modal-conta');

  document.getElementById('btn-nova-conta').addEventListener('click', abrirModalConta);
  document.getElementById('fechar-modal-conta').addEventListener('click', () => modalConta.classList.remove('aberto'));
  document.getElementById('cancelar-conta').addEventListener('click', () => modalConta.classList.remove('aberto'));
  document.getElementById('form-conta').addEventListener('submit', criarConta);
  document.getElementById('conta-tipo').addEventListener('change', atualizarVisibilidadeParticipante);

  await renderTabela();

  async function abrirModalConta() {
    const participantes = await DB.getParticipantes();
    const users = await DB.getUsers();
    const idsComLogin = new Set(users.map((u) => u.participanteId).filter(Boolean));
    const disponiveis = participantes.filter((p) => !idsComLogin.has(p.id));

    const select = document.getElementById('conta-participante');
    if (disponiveis.length === 0) {
      select.innerHTML = '<option value="">Todas as participantes já têm login</option>';
    } else {
      select.innerHTML = disponiveis.map((p) => `<option value="${p.id}">${escapeHtml(p.nome)}</option>`).join('');
    }

    document.getElementById('form-conta').reset();
    atualizarVisibilidadeParticipante();
    modalConta.classList.add('aberto');
  }

  function atualizarVisibilidadeParticipante() {
    const tipo = document.getElementById('conta-tipo').value;
    const linha = document.getElementById('linha-conta-participante');
    const select = document.getElementById('conta-participante');
    const ehIntegrante = tipo === 'integrante';
    linha.classList.toggle('oculto', !ehIntegrante);
    select.required = ehIntegrante;
  }

  async function criarConta(e) {
    e.preventDefault();
    const tipo = document.getElementById('conta-tipo').value; // 'admin' ou 'integrante'
    const participanteId = tipo === 'integrante' ? document.getElementById('conta-participante').value : null;
    const usuario = document.getElementById('conta-usuario').value.trim();
    const senha = document.getElementById('conta-senha').value;

    if (!usuario || !senha || (tipo === 'integrante' && !participanteId)) {
      mostrarToast('Preencha todos os campos.', 'erro');
      return;
    }
    if (senha.length < 6) {
      mostrarToast('A senha precisa ter pelo menos 6 caracteres.', 'erro');
      return;
    }

    const botao = e.target.querySelector('button[type=submit]');
    botao.disabled = true;
    botao.textContent = 'Criando...';

    try {
      const users = await DB.getUsers();
      if (users.some((u) => u.username.toLowerCase() === usuario.toLowerCase())) {
        mostrarToast(`Já existe uma conta com o usuário "${usuario}".`, 'erro');
        return;
      }

      // cria o login de verdade no Firebase Authentication, sem
      // deslogar a coordenadora que está fazendo o cadastro
      const criado = await criarContaFirebaseSemDeslogar(usuario, senha);
      if (!criado.ok) {
        mostrarToast(criado.msg, 'erro');
        return;
      }

      // guarda os metadados (perfil/vínculo) no Firestore
      users.push({
        id: ccUid('user'),
        username: usuario,
        role: tipo,
        participanteId,
        status: 'ativo',
        criadoEm: new Date().toISOString(),
      });
      await DB.saveUsers(users);

      mostrarToast(`Conta de ${tipo === 'admin' ? 'coordenação' : 'integrante'} criada com sucesso!`, 'sucesso');
      modalConta.classList.remove('aberto');
      await renderTabela();
    } finally {
      botao.disabled = false;
      botao.textContent = 'Criar conta';
    }
  }

  async function alternarStatus(userId) {
    const users = await DB.getUsers();
    const conta = users.find((u) => u.id === userId);
    if (!conta) return;
    if (conta.role === 'admin' && users.filter((u) => u.role === 'admin' && u.status === 'ativo').length === 1 && conta.status === 'ativo') {
      mostrarToast('Não é possível inativar a única conta de administração.', 'erro');
      return;
    }
    conta.status = conta.status === 'ativo' ? 'inativo' : 'ativo';
    await DB.saveUsers(users);
    mostrarToast(`Conta ${conta.status === 'ativo' ? 'ativada' : 'inativada'}.`, 'sucesso');
    await renderTabela();
  }

  async function renderTabela() {
    const tbody = document.getElementById('tbody-contas');
    tbody.innerHTML = '<tr><td colspan="5"><div class="carregando"><div class="spinner"></div> Carregando...</div></td></tr>';

    const users = await DB.getUsers();
    const participantes = await DB.getParticipantes();
    const mapaNomes = Object.fromEntries(participantes.map((p) => [p.id, p.nome]));

    tbody.innerHTML = users
      .map((u) => {
        const nomeParticipante = u.participanteId ? mapaNomes[u.participanteId] || '(participante removida)' : '—';
        return `
        <tr>
          <td>${escapeHtml(u.username)}</td>
          <td>${escapeHtml(nomeParticipante)}</td>
          <td><span class="badge ${u.role === 'admin' ? 'badge-admin' : 'badge-integrante'}">${u.role === 'admin' ? 'Coordenação' : 'Integrante'}</span></td>
          <td><span class="badge ${u.status === 'ativo' ? 'badge-ativo' : 'badge-inativo'}">${u.status === 'ativo' ? 'Ativa' : 'Inativa'}</span></td>
          <td class="barra-acoes">
            <button class="btn btn-secundario btn-sm" onclick='alternarStatusGlobal("${u.id}")'>${u.status === 'ativo' ? 'Inativar' : 'Ativar'}</button>
          </td>
        </tr>`;
      })
      .join('');
  }

  window.alternarStatusGlobal = alternarStatus;
})();
