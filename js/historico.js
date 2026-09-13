/* ============================================================
   historico.js — listagem, filtros, edição e exportação
   ============================================================ */

(async function () {
  const user = await iniciarPagina(['admin']);
  if (!user) return;

  let chamadaEmEdicao = null;

  ['f-data', 'f-atividade', 'f-participante', 'f-status'].forEach((id) => {
    document.getElementById(id).addEventListener('input', renderTabela);
  });
  document.getElementById('btn-limpar-filtros').addEventListener('click', () => {
    document.getElementById('f-data').value = '';
    document.getElementById('f-atividade').value = '';
    document.getElementById('f-participante').value = '';
    document.getElementById('f-status').value = '';
    renderTabela();
  });

  document.getElementById('fechar-modal-chamada').addEventListener('click', fecharModal);
  document.getElementById('btn-salvar-edicao-chamada').addEventListener('click', salvarEdicao);
  document.getElementById('btn-excluir-chamada').addEventListener('click', excluirChamada);
  document.getElementById('btn-exportar').addEventListener('click', exportarPlanilha);

  await renderTabela();

  async function chamadasFiltradas() {
    const data = document.getElementById('f-data').value;
    const atividade = document.getElementById('f-atividade').value.trim().toLowerCase();
    const nomeParticipante = document.getElementById('f-participante').value.trim().toLowerCase();
    const status = document.getElementById('f-status').value;

    const participantes = await DB.getParticipantes();
    const mapaNomes = Object.fromEntries(participantes.map((p) => [p.id, p.nome.toLowerCase()]));

    return (await DB.getChamadas())
      .filter((c) => !data || c.data === data)
      .filter((c) => !atividade || c.nomeAtividade.toLowerCase().includes(atividade))
      .filter((c) => {
        if (!nomeParticipante) return true;
        return c.registros.some((r) => (mapaNomes[r.participanteId] || '').includes(nomeParticipante));
      })
      .filter((c) => {
        if (!status) return true;
        return c.registros.some((r) => r.status === status);
      })
      .sort((a, b) => (a.data < b.data ? 1 : -1));
  }

  async function renderTabela() {
    const tbody = document.getElementById('tbody-historico');
    tbody.innerHTML = '<tr><td colspan="6"><div class="carregando"><div class="spinner"></div> Carregando...</div></td></tr>';

    const chamadas = await chamadasFiltradas();
    const vazio = document.getElementById('historico-vazio');

    if (chamadas.length === 0) {
      tbody.innerHTML = '';
      vazio.classList.remove('oculto');
      return;
    }
    vazio.classList.add('oculto');

    tbody.innerHTML = chamadas
      .map((c) => {
        const presentes = c.registros.filter((r) => r.status === 'presente').length;
        const faltas = c.registros.filter((r) => r.status === 'falta').length;
        const justificadas = c.registros.filter((r) => r.status === 'justificada').length;
        return `
        <tr class="clicavel" onclick='abrirModalGlobal("${c.id}")'>
          <td>${formatarData(c.data)}</td>
          <td>${escapeHtml(c.nomeAtividade)}</td>
          <td>${c.registros.length}</td>
          <td>${presentes}</td>
          <td>${faltas}</td>
          <td>${justificadas}</td>
        </tr>`;
      })
      .join('');
  }

  async function abrirModal(chamadaId) {
    const chamada = (await DB.getChamadas()).find((c) => c.id === chamadaId);
    if (!chamada) return;
    chamadaEmEdicao = chamadaId;

    const participantes = await DB.getParticipantes();
    const mapaParticipantes = Object.fromEntries(participantes.map((p) => [p.id, p]));

    document.getElementById('modal-chamada-titulo').textContent = `${chamada.nomeAtividade} — ${formatarData(chamada.data)}`;

    const linhas = chamada.registros
      .map((r) => {
        const p = mapaParticipantes[r.participanteId];
        const nome = p ? p.nome : '(participante removida)';
        return `
        <tr>
          <td>${escapeHtml(nome)}</td>
          <td>
            <div class="barra-acoes" style="gap:12px;">
              <label style="font-weight:400;font-size:0.85rem;"><input type="radio" name="edit_${r.participanteId}" value="presente" ${r.status === 'presente' ? 'checked' : ''}> Presente</label>
              <label style="font-weight:400;font-size:0.85rem;"><input type="radio" name="edit_${r.participanteId}" value="falta" ${r.status === 'falta' ? 'checked' : ''}> Falta</label>
              <label style="font-weight:400;font-size:0.85rem;"><input type="radio" name="edit_${r.participanteId}" value="justificada" ${r.status === 'justificada' ? 'checked' : ''}> Justificada</label>
            </div>
          </td>
          <td><input type="text" data-edit-obs="${r.participanteId}" value="${escapeHtml(r.obs || '')}" style="width:100%;padding:6px 8px;border-radius:6px;border:1px solid var(--cinza-borda);"></td>
        </tr>`;
      })
      .join('');

    document.getElementById('modal-chamada-corpo').innerHTML = `
      <div class="tabela-wrap" style="box-shadow:none;">
        <table>
          <thead><tr><th>Participante</th><th>Situação</th><th>Observação</th></tr></thead>
          <tbody>${linhas}</tbody>
        </table>
      </div>
    `;

    document.getElementById('modal-chamada').classList.add('aberto');
  }

  function fecharModal() {
    document.getElementById('modal-chamada').classList.remove('aberto');
    chamadaEmEdicao = null;
  }

  async function salvarEdicao() {
    if (!chamadaEmEdicao) return;
    const chamadas = await DB.getChamadas();
    const chamada = chamadas.find((c) => c.id === chamadaEmEdicao);
    if (!chamada) return;

    chamada.registros = chamada.registros.map((r) => {
      const radios = document.getElementsByName(`edit_${r.participanteId}`);
      let status = r.status;
      radios.forEach((rad) => { if (rad.checked) status = rad.value; });
      const obsInput = document.querySelector(`input[data-edit-obs="${r.participanteId}"]`);
      return { ...r, status, obs: obsInput ? obsInput.value.trim() : r.obs };
    });
    chamada.atualizadoEm = new Date().toISOString();

    await DB.saveChamadas(chamadas);
    mostrarToast('Chamada atualizada com sucesso.', 'sucesso');
    fecharModal();
    await renderTabela();
  }

  async function excluirChamada() {
    if (!chamadaEmEdicao) return;
    if (!confirm('Excluir esta chamada do histórico? Essa ação não pode ser desfeita.')) return;
    let chamadas = await DB.getChamadas();
    chamadas = chamadas.filter((c) => c.id !== chamadaEmEdicao);
    await DB.saveChamadas(chamadas);
    mostrarToast('Chamada excluída.', 'sucesso');
    fecharModal();
    await renderTabela();
  }

  async function exportarPlanilha() {
    const participantes = await DB.getParticipantes();
    const chamadas = await DB.getChamadas();

    // Aba 1: resumo por participante
    const resumo = participantes.map((p) => {
      const stats = calcularEstatisticasParticipante(chamadas, p.id);
      return {
        Nome: p.nome,
        'Turma/ano': p.turma || '',
        Status: p.status,
        'Total de atividades': stats.total,
        'Total de presenças': stats.presencas,
        'Total de faltas': stats.faltas,
        'Faltas justificadas': stats.justificadas,
        '% Presença': stats.pctPresenca,
        '% Falta': stats.pctFalta,
      };
    });

    // Aba 2: histórico detalhado (uma linha por participante/chamada)
    const mapaNomes = Object.fromEntries(participantes.map((p) => [p.id, p.nome]));
    const detalhado = [];
    chamadas.forEach((c) => {
      c.registros.forEach((r) => {
        detalhado.push({
          Data: formatarData(c.data),
          Atividade: c.nomeAtividade,
          Participante: mapaNomes[r.participanteId] || '(removida)',
          Situação: r.status,
          Observação: r.obs || '',
        });
      });
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), 'Resumo por participante');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalhado), 'Histórico detalhado');

    const dataHoje = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `conecta-caicara-presenca-${dataHoje}.xlsx`);
    mostrarToast('Planilha exportada com sucesso!', 'sucesso');
  }

  window.abrirModalGlobal = abrirModal;
})();
