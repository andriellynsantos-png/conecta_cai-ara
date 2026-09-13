/* ============================================================
   perfil.js
   - Integrante logada: sempre vê o próprio perfil.
   - Admin: pode ver o perfil de qualquer participante via
     perfil.html?id=ID_DA_PARTICIPANTE (link vindo de outras telas).
   ============================================================ */

(async function () {
  const user = await iniciarPagina(['admin', 'integrante']);
  if (!user) return;

  const params = new URLSearchParams(window.location.search);
  let participanteId;

  if (user.role === 'integrante') {
    participanteId = user.participanteId;
  } else {
    participanteId = params.get('id');
  }

  const container = document.getElementById('conteudo-perfil');
  const participante = (await DB.getParticipantes()).find((p) => p.id === participanteId);

  if (!participante) {
    container.innerHTML = `
      <div class="topo-pagina"><div><h1>Perfil não encontrado</h1></div></div>
      <div class="card">
        <p>${
          user.role === 'integrante'
            ? 'Sua conta ainda não está vinculada a um cadastro de participante. Fale com a coordenação.'
            : 'Não encontramos essa participante. Ela pode ter sido excluída.'
        }</p>
        ${user.role === 'admin' ? '<a class="btn btn-primario" href="participantes.html">Voltar para participantes</a>' : ''}
      </div>
    `;
    return;
  }

  const chamadas = await DB.getChamadas();
  const stats = calcularEstatisticasParticipante(chamadas, participante.id);

  const historicoDaParticipante = chamadas
    .map((c) => ({ c, registro: c.registros.find((r) => r.participanteId === participante.id) }))
    .filter((item) => item.registro)
    .sort((a, b) => (a.c.data < b.c.data ? 1 : -1));

  container.innerHTML = `
    <div class="topo-pagina">
      <div>
        <h1>Perfil da participante</h1>
        <p class="subtitulo">${user.role === 'admin' ? 'Visão administrativa do histórico individual.' : 'Este é o seu histórico no projeto.'}</p>
      </div>
      ${user.role === 'admin' ? `<a class="btn btn-fantasma" href="participantes.html">← Voltar</a>` : ''}
    </div>

    <div class="card" style="margin-bottom:22px;">
      <div class="perfil-cabecalho">
        <div class="perfil-avatar">${iniciaisNome(participante.nome)}</div>
        <div>
          <h2 style="margin-bottom:2px;">${escapeHtml(participante.nome)}</h2>
          <p class="text-mudo" style="margin:0;">
            ${escapeHtml(participante.turma || 'Turma não informada')} · Entrou em ${formatarData(participante.dataEntrada)}
            · <span class="badge ${participante.status === 'ativa' ? 'badge-ativo' : 'badge-inativo'}">${participante.status === 'ativa' ? 'Ativa' : 'Inativa'}</span>
          </p>
        </div>
      </div>
    </div>

    <div class="grid-cards">
      <div class="card card-stat">
        <div class="rotulo">Total de atividades</div>
        <div class="valor">${stats.total}</div>
      </div>
      <div class="card card-stat">
        <div class="rotulo">Presenças</div>
        <div class="valor verde">${stats.presencas}</div>
      </div>
      <div class="card card-stat">
        <div class="rotulo">Faltas</div>
        <div class="valor marrom">${stats.faltas}</div>
      </div>
      <div class="card card-stat">
        <div class="rotulo">Faltas justificadas</div>
        <div class="valor oliva">${stats.justificadas}</div>
      </div>
      <div class="card card-stat">
        <div class="rotulo">% de presença</div>
        <div class="valor verde">${stats.pctPresenca}%</div>
      </div>
      <div class="card card-stat">
        <div class="rotulo">% de falta</div>
        <div class="valor marrom">${stats.pctFalta}%</div>
      </div>
    </div>

    <div class="grid-2col">
      <div class="card">
        <div class="card-titulo">Histórico individual</div>
        ${
          historicoDaParticipante.length === 0
            ? '<div class="tabela-vazia">Ainda não há registros de presença.</div>'
            : `
        <div class="tabela-wrap" style="box-shadow:none;border:none;">
          <table>
            <thead><tr><th>Data</th><th>Atividade</th><th>Situação</th><th>Observação</th></tr></thead>
            <tbody>
              ${historicoDaParticipante
                .map(
                  (item) => `
                <tr>
                  <td>${formatarData(item.c.data)}</td>
                  <td>${escapeHtml(item.c.nomeAtividade)}</td>
                  <td>${badgeStatus(item.registro.status)}</td>
                  <td>${escapeHtml(item.registro.obs || '—')}</td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>`
        }
      </div>
      <div class="card">
        <div class="card-titulo">Resumo visual</div>
        ${stats.total > 0 ? '<canvas id="grafico-perfil" height="220"></canvas>' : '<div class="tabela-vazia">Sem dados suficientes ainda.</div>'}
      </div>
    </div>
  `;

  if (stats.total > 0) {
    new Chart(document.getElementById('grafico-perfil'), {
      type: 'doughnut',
      data: {
        labels: ['Presenças', 'Faltas', 'Justificadas'],
        datasets: [
          {
            data: [stats.presencas, stats.faltas, stats.justificadas],
            backgroundColor: ['#3f7d52', '#a1442e', '#b7a868'],
          },
        ],
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
    });
  }
})();
