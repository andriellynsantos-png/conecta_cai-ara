/* ============================================================
   db.js — Camada de dados, agora usando o Firestore (Firebase)
   ------------------------------------------------------------
   Antes os dados ficavam só no localStorage do navegador. Agora
   ficam num banco de dados na nuvem, compartilhado entre todos
   os aparelhos: quando a coordenação faz uma chamada no
   computador, a integrante já vê isso atualizado no celular dela.

   Todas as funções do DB agora são ASSÍNCRONAS (retornam uma
   Promise) porque conversar com um servidor na internet leva um
   tempinho. Por isso, em todo o sistema, sempre usamos:

       const participantes = await DB.getParticipantes();

   em vez de:

       const participantes = DB.getParticipantes();

   Estratégia usada: em vez de reescrever toda a lógica de cada
   página para o "jeito Firestore" (documento por documento), o
   DB imita o comportamento antigo — "pega a lista inteira",
   "salva a lista inteira de volta" — só que por trás ele calcula
   as diferenças e grava só o que mudou. Isso deixou o restante
   do código (participantes.js, chamada.js, etc.) quase idêntico
   ao que já existia.
   ============================================================ */

function ccUid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Lê uma coleção inteira do Firestore e devolve como array,
// no mesmo formato que o resto do sistema já espera: [{id, ...campos}]
async function ccGetCollection(nomeColecao) {
  const snap = await fbDb.collection(nomeColecao).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

// Recebe a lista completa (já com os itens editados/adicionados)
// e sincroniza com o Firestore: atualiza quem já existe, cria quem
// é novo (usando o id que já veio no item) e apaga quem foi removido
// da lista.
async function ccSaveCollection(nomeColecao, listaCompleta) {
  const snapAtual = await fbDb.collection(nomeColecao).get();
  const idsAtuais = new Set(snapAtual.docs.map((d) => d.id));
  const idsNovos = new Set(listaCompleta.map((item) => item.id));

  const batch = fbDb.batch();

  idsAtuais.forEach((id) => {
    if (!idsNovos.has(id)) {
      batch.delete(fbDb.collection(nomeColecao).doc(id));
    }
  });

  listaCompleta.forEach((item) => {
    const { id, ...dados } = item;
    batch.set(fbDb.collection(nomeColecao).doc(id), dados);
  });

  await batch.commit();
}

const DB = {
  getUsers: () => ccGetCollection('users'),
  saveUsers: (lista) => ccSaveCollection('users', lista),

  getParticipantes: () => ccGetCollection('participantes'),
  saveParticipantes: (lista) => ccSaveCollection('participantes', lista),

  getChamadas: () => ccGetCollection('chamadas'),
  saveChamadas: (lista) => ccSaveCollection('chamadas', lista),

  // o "log de importação" é só uma lista de textos (assinaturas),
  // então fica salvo num único documento em vez de uma coleção.
  async getImportLog() {
    const doc = await fbDb.collection('meta').doc('importLog').get();
    return doc.exists ? doc.data().assinaturas || [] : [];
  },
  async saveImportLog(lista) {
    await fbDb.collection('meta').doc('importLog').set({ assinaturas: lista });
  },
};
