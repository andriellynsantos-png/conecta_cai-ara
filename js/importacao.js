/* ============================================================
   importacao.js — leitura de planilha .xlsx/.csv e integração
   com o sistema, evitando duplicar registros já importados.
   Usa a biblioteca SheetJS (xlsx.full.min.js), carregada via CDN
   no importacao.html, porque ler/gerar arquivos Excel em JavaScript
   puro exigiria reescrever o parser binário do formato .xlsx —
   é o motivo de usarmos essa biblioteca em vez de código próprio.
   ============================================================ */

(async function () {
  const user = await iniciarPagina(['admin']);
  if (!user) return;

  const dropzone = document.getElementById('dropzone');
  const inputArquivo = document.getElementById('input-arquivo');

  dropzone.addEventListener('click', () => inputArquivo.click());
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('arraste-ativo'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('arraste-ativo'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('arraste-ativo');
    if (e.dataTransfer.files.length) processarArquivo(e.dataTransfer.files[0]);
  });
  inputArquivo.addEventListener('change', (e) => {
    if (e.target.files.length) processarArquivo(e.target.files[0]);
  });

  document.getElementById('btn-baixar-modelo').addEventListener('click', baixarModelo);

  function processarArquivo(arquivo) {
    const leitor = new FileReader();
    leitor.onload = async (e) => {
      try {
        const dados = new Uint8Array(e.target.result);
        const workbook = XLSX.read(dados, { type: 'array', cellDates: true });
        const primeiraAba = workbook.Sheets[workbook.SheetNames[0]];
        const linhas = XLSX.utils.sheet_to_json(primeiraAba, { defval: '' });
        mostrarToast('Lendo planilha e sincronizando com o servidor...', 'info');
        await importarLinhas(linhas);
      } catch (err) {
        console.error(err);
        mostrarToast('Não foi possível ler o arquivo. Verifique se é um .xlsx ou .csv válido.', 'erro');
      }
    };
    leitor.readAsArrayBuffer(arquivo);
  }

  function normalizarChave(obj, possiveis) {
    const chaves = Object.keys(obj);
    for (const possivel of possiveis) {
      const achada = chaves.find((k) => k.trim().toLowerCase() === possivel);
      if (achada) return obj[achada];
    }
    return '';
  }

  function normalizarStatus(valor) {
    const v = String(valor).trim().toLowerCase();
    if (['presente', 'p', 'presença', 'presenca'].includes(v)) return 'presente';
    if (['falta', 'f', 'ausente'].includes(v)) return 'falta';
    if (['justificada', 'justificado', 'j', 'falta justificada'].includes(v)) return 'justificada';
    return null;
  }

  function normalizarData(valor) {
    if (!valor) return null;
    if (valor instanceof Date && !isNaN(valor)) {
      return valor.toISOString().slice(0, 10);
    }
    const texto = String(valor).trim();
    // AAAA-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
    // DD/MM/AAAA
    const m = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      const [, dia, mes, ano] = m;
      return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    }
    return null;
  }

  async function importarLinhas(linhas) {
    const participantes = await DB.getParticipantes();
    const chamadas = await DB.getChamadas();
    const importLog = new Set(await DB.getImportLog());

    const mapaNomeParaId = new Map(participantes.map((p) => [p.nome.trim().toLowerCase(), p.id]));
    const mapaChamada = new Map(chamadas.map((c) => [`${c.data}|${c.nomeAtividade.trim().toLowerCase()}`, c]));

    let importados = 0;
    let duplicados = 0;
    const erros = [];

    linhas.forEach((linha, index) => {
      const numeroLinha = index + 2; // +2 = cabeçalho + índice base 1

      const nome = String(normalizarChave(linha, ['nome', 'participante', 'nome completo'])).trim();
      const dataBruta = normalizarChave(linha, ['data', 'data da atividade']);
      const atividade = String(normalizarChave(linha, ['atividade', 'nome da atividade'])).trim();
      const statusBruto = normalizarChave(linha, ['status', 'situação', 'situacao', 'presença/falta', 'presenca/falta']);
      const obs = String(normalizarChave(linha, ['observação', 'observacao', 'obs']) || '').trim();

      if (!nome || !dataBruta || !atividade || !statusBruto) {
        erros.push(`Linha ${numeroLinha}: faltam dados obrigatórios (nome, data, atividade ou status).`);
        return;
      }

      const data = normalizarData(dataBruta);
      if (!data) {
        erros.push(`Linha ${numeroLinha}: data "${dataBruta}" em formato não reconhecido.`);
        return;
      }

      const status = normalizarStatus(statusBruto);
      if (!status) {
        erros.push(`Linha ${numeroLinha}: status "${statusBruto}" não reconhecido (use Presente, Falta ou Justificada).`);
        return;
      }

      // encontra ou cadastra a participante automaticamente
      let participanteId = mapaNomeParaId.get(nome.toLowerCase());
      if (!participanteId) {
        const nova = {
          id: ccUid('part'),
          nome,
          turma: '',
          dataEntrada: data,
          status: 'ativa',
          contato: '',
          obs: 'Cadastrada automaticamente via importação de planilha.',
          criadoEm: new Date().toISOString(),
        };
        participantes.push(nova);
        participanteId = nova.id;
        mapaNomeParaId.set(nome.toLowerCase(), participanteId);
      }

      const assinatura = `${participanteId}|${data}|${atividade.toLowerCase()}`;
      if (importLog.has(assinatura)) {
        duplicados++;
        return;
      }

      // localiza (ou cria) a chamada correspondente a essa data+atividade
      const chaveChamada = `${data}|${atividade.toLowerCase()}`;
      let chamada = mapaChamada.get(chaveChamada);
      if (!chamada) {
        chamada = {
          id: ccUid('cham'),
          data,
          nomeAtividade: atividade,
          registros: [],
          origem: 'importacao',
          criadoEm: new Date().toISOString(),
        };
        chamadas.push(chamada);
        mapaChamada.set(chaveChamada, chamada);
      }

      const jaTemRegistro = chamada.registros.some((r) => r.participanteId === participanteId);
      if (jaTemRegistro) {
        duplicados++;
        return;
      }

      chamada.registros.push({ participanteId, status, obs });
      importLog.add(assinatura);
      importados++;
    });

    await DB.saveParticipantes(participantes);
    await DB.saveChamadas(chamadas);
    await DB.saveImportLog(Array.from(importLog));

    mostrarResumo(linhas.length, importados, duplicados, erros);

    if (importados > 0) {
      mostrarToast(`${importados} registro(s) importado(s) com sucesso!`, 'sucesso');
    } else {
      mostrarToast('Nenhum registro novo foi importado. Veja o resumo para detalhes.', 'info');
    }
  }

  function mostrarResumo(lidas, importados, duplicados, erros) {
    document.getElementById('resumo-importacao').classList.remove('oculto');
    document.getElementById('res-lidas').textContent = lidas;
    document.getElementById('res-importados').textContent = importados;
    document.getElementById('res-duplicados').textContent = duplicados;
    document.getElementById('res-erros').textContent = erros.length;

    const listaErros = document.getElementById('lista-erros');
    if (erros.length === 0) {
      listaErros.innerHTML = '';
      return;
    }
    listaErros.innerHTML = `
      <div class="msg-erro" style="margin-top:14px;">
        <strong>Linhas não importadas:</strong>
        <ul style="margin:6px 0 0 18px; padding:0;">
          ${erros.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  function baixarModelo() {
    const modelo = [
      { Nome: 'Maria Silva', Data: '2026-03-10', Atividade: 'Roda na praia', Status: 'Presente', 'Observação': '' },
      { Nome: 'Ana Souza', Data: '2026-03-10', Atividade: 'Roda na praia', Status: 'Falta', 'Observação': '' },
      { Nome: 'Ana Souza', Data: '2026-03-17', Atividade: 'Oficina de artesanato', Status: 'Justificada', 'Observação': 'Atestado médico' },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(modelo), 'Modelo');
    XLSX.writeFile(wb, 'modelo-importacao-conecta-caicara.xlsx');
  }
})();
