/* ============================================================
   participantes.js — CRUD de participantes (somente admin)
   ============================================================ */

(async function () {
  const user = await iniciarPagina(['admin']);
  if (!user) return;

  const modal = document.getElementById('modal-participante');
  const form = document.getElementById('form-participante');
  const checkCriarLogin = document.getElementById('p-criar-login');
  const areaLoginInline = document.getElementById('area-login-inline');

  document.getElementById('btn-nova-participante').addEventListener('click', () => abrirModal());
  document.getElementById('fechar-modal-participante').addEventListener('click', fecharModal);
  document.getElementById('cancelar-participante').addEventListener('click', fecharModal);
  document.getElementById('busca-nome').addEventListener('input', renderTabela);
  document.getElementById('filtro-status').addEventListener('change', renderTabela);

  checkCriarLogin.addEventListener('change', () => {
    areaLoginInline.classList.toggle('oculto', !checkCriarLogin.checked);
  });

  form.addEventListener('submit', salvarParticipante);

  await renderTabela();

  function abrirModal(participante) {
    form.reset();
    areaLoginInline.classList.add('oculto');
    document.getElementById('linha-criar-login').classList.toggle('oculto', !!participante);

    if (participante) {
      document.getElementById('modal-titulo').textContent = 'Editar participante';
      document.getElementById('participante-id').value = participante.id;
      document.getElementById('p-nome').value = participante.nome;
      document.getElementById('p-turma').value = participante.turma || '';
      document.getElementById('p-entrada').value = participante.dataEntrada || '';
      document.getElementById('p-status').value = participante.status;
      document.getElementById('p-contato').value = participante.contato || '';
      document.getElementById('p-obs').value = participante.obs || '';
    } else {
      document.getElementById('modal-titulo').textContent = 'Nova participante';
      document.getElementById('participante-id').value = '';
      document.getElementById('p-entrada').value = new Date().toISOString().slice(0, 10);
    }
    modal.classList.add('aberto');
  }

  function fecharModal() {
    modal.classList.remove('aberto');
  }

  async function salvarParticipante(e) {
    e.preventDefault();
    const nome = document.getElementById('p-nome').value.trim();
    if (!nome) {
      mostrarToast('Informe o nome da participante.', 'erro');
      return;
    }

    const botaoSalvar = form.querySelector('button[type=submit]');
    botaoSalvar.disabled = true;
    botaoSalvar.textContent = 'Salvando...';

    try {
      const participantes = await DB.getParticipantes();
      const idExistente = document.getElementById('participante-id').value;

      const dados = {
        nome,
        turma: document.getElementById('p-turma').value.trim(),
        dataEntrada: document.getElementById('p-entrada').value,
        status: document.getElementById('p-status').value,
        contato: document.getElementById('p-contato').value.trim(),
        obs: document.getElementById('p-obs').value.trim(),
      };

      let participanteId = idExistente;

      if (idExistente) {
        const idx = participantes.findIndex((p) => p.id === idExistente);
        if (idx === -1) {
          mostrarToast('Participante não encontrada.', 'erro');
          return;
        }
        participantes[idx] = { ...participantes[idx], ...dados };
      } else {
        const nova = { id: ccUid('part'), ...dados, criadoEm: new Date().toISOString() };
        participantes.push(nova);
        participanteId = nova.id;
      }

      await DB.saveParticipantes(participantes);

      // criar login vinculado, se marcado
      if (!idExistente && checkCriarLogin.checked) {
        const usuario = document.getElementById('p-login-usuario').value.trim();
        const senha = document.getElementById('p-login-senha').value.trim();
        if (usuario && senha) {
          const resultado = await criarLoginParaParticipante(usuario, senha, participanteId);
          if (!resultado.ok) mostrarToast(resultado.msg, 'erro');
        } else {
          mostrarToast('Participante salva, mas o login não foi criado (usuária/senha em branco).', 'info');
        }
      }

      mostrarToast('Participante salva com sucesso!', 'sucesso');
      fecharModal();
      await renderTabela();
    } finally {
      botaoSalvar.disabled = false;
      botaoSalvar.textContent = 'Salvar';
    }
  }

  async function criarLoginParaParticipante(usuario, senha, participanteId) {
    const users = await DB.getUsers();
    if (users.some((u) => u.username.toLowerCase() === usuario.toLowerCase())) {
      return { ok: false, msg: `Já existe uma conta com o usuário "${usuario}".` };
    }

    const criado = await criarContaFirebaseSemDeslogar(usuario, senha);
    if (!criado.ok) return criado;

    users.push({
      id: ccUid('user'),
      username: usuario,
      role: 'integrante',
      participanteId,
      status: 'ativo',
      criadoEm: new Date().toISOString(),
    });
    await DB.saveUsers(users);
    return { ok: true };
  }

  async function excluirParticipante(id) {
    if (!confirm('Tem certeza que deseja excluir esta participante? O histórico de chamadas dela será mantido, mas ela deixará de aparecer nas próximas chamadas.')) {
      return;
    }
    let participantes = await DB.getParticipantes();
    participantes = participantes.filter((p) => p.id !== id);
    await DB.saveParticipantes(participantes);
    mostrarToast('Participante removida.', 'sucesso');
    await renderTabela();
  }

  async function renderTabela() {
    const termo = document.getElementById('busca-nome').value.trim().toLowerCase();
    const statusFiltro = document.getElementById('filtro-status').value;

    const tbody = document.getElementById('tbody-participantes');
    tbody.innerHTML = '<tr><td colspan="6"><div class="carregando"><div class="spinner"></div> Carregando...</div></td></tr>';

    const participantes = await DB.getParticipantes();
    const chamadas = await DB.getChamadas();

    const filtradas = participantes
      .filter((p) => {
        const bateNome = !termo || p.nome.toLowerCase().includes(termo);
        const bateStatus = !statusFiltro || p.status === statusFiltro;
        return bateNome && bateStatus;
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    const vazio = document.getElementById('tabela-vazia');

    if (filtradas.length === 0) {
      tbody.innerHTML = '';
      vazio.classList.remove('oculto');
      return;
    }
    vazio.classList.add('oculto');

    tbody.innerHTML = filtradas
      .map((p) => {
        const stats = calcularEstatisticasParticipante(chamadas, p.id);
        return `
        <tr>
          <td><a href="perfil.html?id=${p.id}" style="text-decoration:none;color:var(--azul-marinho);font-weight:600;">${escapeHtml(p.nome)}</a></td>
          <td>${escapeHtml(p.turma || '—')}</td>
          <td>${formatarData(p.dataEntrada)}</td>
          <td><span class="badge ${p.status === 'ativa' ? 'badge-ativo' : 'badge-inativo'}">${p.status === 'ativa' ? 'Ativa' : 'Inativa'}</span></td>
          <td>${stats.total > 0 ? stats.pctPresenca + '%' : '—'}</td>
          <td class="barra-acoes">
            <button class="btn btn-fantasma btn-sm" onclick='editarParticipanteGlobal("${p.id}")'>Editar</button>
            <button class="btn btn-perigo btn-sm" onclick='excluirParticipanteGlobal("${p.id}")'>Excluir</button>
          </td>
        </tr>`;
      })
      .join('');
  }

  // expõe funções para os botões inline da tabela
  window.editarParticipanteGlobal = async (id) => {
    const participante = (await DB.getParticipantes()).find((p) => p.id === id);
    if (participante) abrirModal(participante);
  };
  window.excluirParticipanteGlobal = excluirParticipante;
})();
