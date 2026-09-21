/* ============================================================
   chamada.js — Registro de presença de uma atividade
   ============================================================ */

(async function () {
  const user = await iniciarPagina(['admin']);
  if (!user) return;

  const inputData = document.getElementById('c-data');
  const inputAtividade = document.getElementById('c-atividade');
  const avisoExistente = document.getElementById('aviso-chamada-existente');

  inputData.value = new Date().toISOString().slice(0, 10);

  await renderListaParticipantes();
  inputData.addEventListener('change', verificarChamadaExistente);
  inputAtividade.addEventListener('input', verificarChamadaExistente);

  document.getElementById('btn-marcar-todas-presente').addEventListener('click', () => {
    document.querySelectorAll('input[type=radio][value=presente]').forEach((r) => (r.checked = true));
  });

  document.getElementById('btn-salvar-chamada').addEventListener('click', salvarChamada);

  async function renderListaParticipantes() {
    const tbody = document.getElementById('tbody-chamada');
    tbody.innerHTML = '<tr><td colspan="3"><div class="carregando"><div class="spinner"></div> Carregando...</div></td></tr>';

    const participantes = (await DB.getParticipantes())
      .filter((p) => p.status === 'ativa')
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    const vazio = document.getElementById('chamada-vazia');

    if (participantes.length === 0) {
      tbody.innerHTML = '';
      vazio.classList.remove('oculto');
      return;
    }
    vazio.classList.add('oculto');

    tbody.innerHTML = participantes
      .map(
        (p) => `
            <tr>
        <td>${escapeHtml(p.nome)}</td>
        <td>
          <div class="barra-acoes" style="gap:14px; flex-wrap:wrap;">
            <label style="font-weight:400;font-size:0.85rem;"><input type="radio" name="status_${p.id}" value="presente" checked> Presente</label>
            <label style="font-weight:400;font-size:0.85rem;"><input type="radio" name="status_${p.id}" value="falta"> Falta</label>
            <label style="font-weight:400;font-size:0.85rem;"><input type="radio" name="status_${p.id}" value="justificada"> Justificada</label>
            <label style="font-weight:400;font-size:0.85rem;color:var(--cinza-medio);"><input type="radio" name="status_${p.id}" value="nao_entrou"> Ainda não tinha entrado</label>
            <label style="font-weight:400;font-size:0.85rem;color:var(--cinza-medio);"><input type="radio" name="status_${p.id}" value="saiu"> Já tinha saído</label>
          </div>
        </td>
        <td><input type="text" data-obs="${p.id}" placeholder="opcional" style="width:100%;padding:6px 8px;border-radius:6px;border:1px solid var(--cinza-borda);"></td>
      </tr>`
      )
      .join('');
  }

  async function chamadaJaExiste() {
    const data = inputData.value;
    const nome = inputAtividade.value.trim().toLowerCase();
    if (!data || !nome) return null;
    const chamadas = await DB.getChamadas();
    return chamadas.find((c) => c.data === data && c.nomeAtividade.trim().toLowerCase() === nome) || null;
  }

  async function verificarChamadaExistente() {
    const existente = await chamadaJaExiste();
    if (existente) {
      avisoExistente.textContent = 'Já existe uma chamada com essa data e atividade. Salvar irá atualizar os registros existentes (edite pelo Histórico para mais controle).';
      avisoExistente.classList.remove('oculto');
    } else {
      avisoExistente.classList.add('oculto');
    }
  }

  async function salvarChamada() {
    const data = inputData.value;
    const nomeAtividade = inputAtividade.value.trim();

    if (!data || !nomeAtividade) {
      mostrarToast('Preencha a data e o nome da atividade.', 'erro');
      return;
    }

    const botao = document.getElementById('btn-salvar-chamada');
    botao.disabled = true;
    botao.textContent = 'Salvando...';

    try {
      const participantesAtivas = (await DB.getParticipantes()).filter((p) => p.status === 'ativa');
      if (participantesAtivas.length === 0) {
        mostrarToast('Não há participantes ativas para registrar chamada.', 'erro');
        return;
      }

            const registros = participantesAtivas
        .map((p) => {
          const radios = document.getElementsByName(`status_${p.id}`);
          let status = 'presente';
          radios.forEach((r) => { if (r.checked) status = r.value; });
          const obsInput = document.querySelector(`input[data-obs="${p.id}"]`);
          return { participanteId: p.id, status, obs: obsInput ? obsInput.value.trim() : '' };
        })
        // "ainda não tinha entrado" e "já tinha saído" não geram registro nessa
        // chamada — não conta nem a favor nem contra a % de presença.
        .filter((r) => r.status !== 'nao_entrou' && r.status !== 'saiu');

      const chamadas = await DB.getChamadas();
      const existente = await chamadaJaExiste();

      if (existente) {
        const idx = chamadas.findIndex((c) => c.id === existente.id);
        chamadas[idx] = { ...existente, registros, atualizadoEm: new Date().toISOString() };
      } else {
        chamadas.push({
          id: ccUid('cham'),
          data,
          nomeAtividade,
          registros,
          origem: 'manual',
          criadoEm: new Date().toISOString(),
        });
      }

      await DB.saveChamadas(chamadas);
      mostrarToast('Chamada salva com sucesso! Cálculos e histórico atualizados.', 'sucesso');

      // limpa o formulário para a próxima chamada
      inputAtividade.value = '';
      avisoExistente.classList.add('oculto');
      await renderListaParticipantes();
    } finally {
      botao.disabled = false;
      botao.textContent = 'Salvar chamada';
    }
  }
})();
