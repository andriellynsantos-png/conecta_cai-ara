/* ============================================================
   dashboard.js — só pode ser acessado pela administradora
   (integrante vai direto para perfil.html)
   ============================================================ */

(async function () {
  const user = await iniciarPagina(['admin']);
  if (!user) return;

  await renderDashboardAdmin();

  async function renderDashboardAdmin() {
    const participantes = await DB.getParticipantes();
    const chamadas = await DB.getChamadas();
    const geral = calcularEstatisticasGerais(chamadas, participantes);

    const ativas = participantes.filter((p) => p.status === 'ativa').length;

    const piores = [...geral.porParticipante]
      .filter((p) => p.stats.total > 0)
      .sort((a, b) => b.stats.faltas - a.stats.faltas)
      .slice(0, 5);

    const container = document.getElementById('conteudo-dashboard');
    container.innerHTML = `
      <div class="grid-cards">
        <div class="card card-stat">
          <div class="rotulo">Participantes cadastradas</div>
          <div class="valor">${participantes.length}</div>
          <div class="text-mudo">${ativas} ativas</div>
        </div>
        <div class="card card-stat">
          <div class="rotulo">Atividades realizadas</div>
          <div class="valor">${geral.totalAtividades}</div>
        </div>
        <div class="card card-stat">
          <div class="rotulo">Total de presenças</div>
          <div class="valor verde">${geral.totalPresencas}</div>
        </div>
        <div class="card card-stat">
          <div class="rotulo">Total de faltas</div>
          <div class="valor marrom">${geral.totalFaltas}</div>
          <div class="text-mudo">${geral.totalJustificadas} justificadas</div>
        </div>
        <div class="card card-stat">
          <div class="rotulo">Presença média</div>
          <div class="valor oliva">${geral.mediaPresenca}%</div>
        </div>
      </div>

      <div class="grid-2col">
        <div class="card">
          <div class="card-titulo">Presenças x faltas por participante</div>
          <canvas id="grafico-barras" height="220"></canvas>
        </div>
        <div class="card">
          <div class="card-titulo">Resumo geral de presença</div>
          <canvas id="grafico-pizza" height="220"></canvas>
        </div>
      </div>

      <div class="card">
        <div class="card-titulo">Participantes com maior número de faltas</div>
        ${
          piores.length === 0
            ? '<div class="tabela-vazia">Ainda não há chamadas registradas.</div>'
            : `
          <div class="tabela-wrap" style="box-shadow:none;border:none;">
            <table>
              <thead>
                <tr><th>Nome</th><th>Faltas</th><th>Justificadas</th><th>% de falta</th></tr>
              </thead>
              <tbody>
                ${piores
                  .map(
                    (p) => `
                  <tr class="clicavel" onclick="window.location.href='perfil.html?id=${p.participante.id}'">
                    <td>${escapeHtml(p.participante.nome)}</td>
                    <td>${p.stats.faltas}</td>
                    <td>${p.stats.justificadas}</td>
                    <td>${p.stats.pctFalta}%</td>
                  </tr>`
                  )
                  .join('')}
              </tbody>
            </table>
          </div>`
        }
      </div>
    `;

    desenharGraficos(geral);
  }

  function desenharGraficos(geral) {
    const cores = {
      verde: '#3f7d52',
      marrom: '#a1442e',
      oliva: '#b7a868',
      azul: '#1b3a5c',
    };

    const top = [...geral.porParticipante]
      .filter((p) => p.stats.total > 0)
      .sort((a, b) => b.stats.total - a.stats.total)
      .slice(0, 8);

    const ctxBar = document.getElementById('grafico-barras');
    if (ctxBar && top.length > 0) {
      new Chart(ctxBar, {
        type: 'bar',
        data: {
          labels: top.map((p) => p.participante.nome.split(' ')[0]),
          datasets: [
            { label: 'Presenças', data: top.map((p) => p.stats.presencas), backgroundColor: cores.verde },
            { label: 'Faltas', data: top.map((p) => p.stats.faltas), backgroundColor: cores.marrom },
            { label: 'Justificadas', data: top.map((p) => p.stats.justificadas), backgroundColor: cores.oliva },
          ],
        },
        options: {
          responsive: true,
          scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
          plugins: { legend: { position: 'bottom' } },
        },
      });
    } else if (ctxBar) {
      ctxBar.parentElement.insertAdjacentHTML('beforeend', '<p class="tabela-vazia">Sem dados suficientes ainda.</p>');
    }

    const ctxPizza = document.getElementById('grafico-pizza');
    if (ctxPizza && geral.totalAtividades > 0) {
      new Chart(ctxPizza, {
        type: 'doughnut',
        data: {
          labels: ['Presenças', 'Faltas', 'Justificadas'],
          datasets: [
            {
              data: [geral.totalPresencas, geral.totalFaltas, geral.totalJustificadas],
              backgroundColor: [cores.verde, cores.marrom, cores.oliva],
            },
          ],
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
      });
    } else if (ctxPizza) {
      ctxPizza.parentElement.insertAdjacentHTML('beforeend', '<p class="tabela-vazia">Sem dados suficientes ainda.</p>');
    }
  }
})();
