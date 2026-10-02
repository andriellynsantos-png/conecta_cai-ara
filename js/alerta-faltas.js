(async function () {
  const user = await Auth.getCurrentUser();
  if (!user) return;

  const participantes = await DB.getParticipantes();
  const chamadas = await DB.getChamadas();

  function calcularFaltasConsecutivas(participanteId) {
    const ordenadas = [...chamadas].sort((a, b) => (a.data < b.data ? 1 : -1));
    let streak = 0;
    for (const chamada of ordenadas) {
      const registro = chamada.registros.find((r) => r.participanteId === participanteId);
      if (!registro) continue;
      if (registro.status === 'falta' || registro.status === 'justificada') streak++;
      else if (registro.status === 'presente') break;
    }
    return streak;
  }

  let alertaHtml = '';

  if (user.role === 'admin') {
    const emAlerta = participantes
      .filter((p) => p.status === 'ativa')
      .map((p) => ({ nome: p.nome, id: p.id, streak: calcularFaltasConsecutivas(p.id) }))
      .filter((p) => p.streak >= 3)
      .sort((a, b) => b.streak - a.streak);

    if (emAlerta.length > 0) {
      alertaHtml = `
        <div class="alerta-faltas">
          <button type="button" class="fechar-alerta" onclick="this.parentElement.remove()">&times;</button>
          <h3>Participantes com 3+ faltas seguidas</h3>
          <ul>
            ${emAlerta.map((p) => `<li><a href="perfil.html?id=${p.id}"><strong>${escapeHtml(p.nome)}</strong></a> — ${p.streak} faltas seguidas</li>`).join('')}
          </ul>
        </div>`;
    }
  } else if (user.role === 'integrante' && user.participanteId) {
    const streak = calcularFaltasConsecutivas(user.participanteId);
    if (streak >= 3) {
      alertaHtml = `
        <div class="alerta-faltas">
          <button type="button" class="fechar-alerta" onclick="this.parentElement.remove()">&times;</button>
          <h3>Atenção com sua frequência</h3>
          <p style="font-size:0.9rem;">Você está com <strong>${streak} faltas seguidas</strong>. Se puder, procure a coordenação do projeto.</p>
        </div>`;
    }
  }

  if (!alertaHtml) return;

  const alvo = document.getElementById('conteudo-dashboard') || document.getElementById('conteudo-perfil');
  if (alvo) alvo.insertAdjacentHTML('beforebegin', alertaHtml);
})();
