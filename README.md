# Conecta Caiçara — Sistema de Controle de Presença

Sistema web para controle de presença das participantes do projeto **Conecta Caiçara — Rodas sobre Areia**.

## Configuração do Firebase (obrigatório antes de usar)

Este projeto já vem configurado para o projeto Firebase `conecta-caicara` (veja `js/firebase-init.js`). Antes de usar de verdade, faça isso **uma vez** no [console do Firebase](https://console.firebase.google.com):

### 1. Regras de segurança do Firestore

Vá em **Firestore Database → Regras** e cole:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Isso permite que qualquer pessoa **veja** a lista de contas (necessário para o login e para a tela de primeiro acesso funcionarem), mas só quem está **logada** pode escrever dados ou ver participantes/chamadas. Para um grupo pequeno e de confiança como o do projeto, isso é suficiente — mas vale saber que, tecnicamente, qualquer integrante logada consegue acessar os dados de todas as outras via ferramentas de desenvolvedor (não só pela interface). Se isso for uma preocupação, dá para restringir ainda mais as regras por perfil (`role`) mais adiante.

### 2. Criar a primeira conta de coordenação

Depois de publicar o site (veja "Deploy no GitHub Pages" abaixo), abra `primeiro-acesso.html` **uma única vez** e crie a conta inicial de coordenação. Depois disso, essa página se recusa a criar novas contas — use "Contas de acesso" dentro do sistema, já logada.

### 3. Limitação atual: redefinição de senha

Hoje, se uma integrante esquecer a senha, a coordenação **não consegue redefini-la diretamente** pelo navegador (o Firebase não permite isso sem um backend próprio/Cloud Function). Solução temporária: inativar a conta antiga em "Contas de acesso" e criar uma nova conta para a mesma participante com um nome de usuária diferente (ex: `luana2`).

## Deploy no GitHub Pages

1. Crie um repositório novo no GitHub e suba todos os arquivos desta pasta (`index.html`, `css/`, `js/`, `assets/` etc.) na raiz do repositório.
2. Vá em **Settings → Pages** no repositório.
3. Em "Source", escolha a branch `main` (ou `master`) e a pasta `/ (root)`.
4. Salve e aguarde alguns minutos. O GitHub mostra o link (algo como `https://seu-usuario.github.io/nome-do-repositorio/`).
5. No Firebase, vá em **Authentication → Settings → Authorized domains** e adicione esse domínio do GitHub Pages (ex: `seu-usuario.github.io`) — sem isso, o login não funciona fora do `localhost`.

## Como abrir localmente (para editar/testar antes de publicar)

1. Descompacte a pasta `conecta-presenca`.
2. Abra o arquivo `index.html` no navegador (Chrome, Edge ou Firefox atualizados) — pode ser com duplo clique, mas funciona melhor com a extensão Live Server do VS Code.
3. Se ainda não existe nenhuma conta, acesse `primeiro-acesso.html` para criar a conta de coordenação. Depois disso, use sempre `index.html` para entrar.

## Perfis de acesso

| Perfil | O que vê |
|---|---|
| **Coordenação (admin)** | Dashboard geral, cadastro de participantes, chamada, histórico completo, importação/exportação, busca e gerenciamento de contas |
| **Integrante** | Apenas o próprio perfil: presenças, faltas e histórico individual |

## Estrutura de arquivos

```
/conecta-presenca
├── index.html          → tela de login
├── dashboard.html       → visão geral (admin)
├── participantes.html   → cadastro de participantes (admin)
├── chamada.html         → registrar presença de uma atividade (admin)
├── historico.html       → histórico completo + filtros + exportar (admin)
├── importacao.html      → importar planilha (admin)
├── perfil.html          → perfil individual (admin vê qualquer uma, integrante vê o próprio)
├── contas.html          → gerenciar logins (admin)
├── css/style.css        → toda a identidade visual
├── js/
│   ├── db.js            → camada de dados (hoje localStorage)
│   ├── auth.js          → login, sessão e proteção de páginas
│   ├── app.js           → navbar, toasts, cálculos de presença/falta
│   ├── dashboard.js
│   ├── participantes.js
│   ├── chamada.js
│   ├── historico.js
│   ├── importacao.js
│   ├── perfil.js
│   └── contas.js
└── assets/logo.jpeg
```

## Tecnologias usadas e por quê

- **HTML, CSS e JavaScript puro**: sem framework — mais fácil de entender e dar manutenção.
- **[Firebase](https://firebase.google.com/)**: banco de dados em nuvem (Firestore) + login seguro (Authentication), ambos gratuitos nesse tamanho de projeto. É o que permite que a coordenação e cada integrante acessem os mesmos dados reais de aparelhos diferentes — algo que uma solução só de frontend com `localStorage` nunca conseguiria fazer.
- **[SheetJS (xlsx.full.min.js)](https://sheetjs.com/)**: para ler e gerar arquivos `.xlsx`/`.csv` (importação e exportação).
- **[Chart.js](https://www.chartjs.org/)**: para os gráficos do dashboard e do perfil individual.
- **Google Fonts (Baloo 2 + Inter)**: tipografia arredondada e amigável para os títulos, e uma fonte limpa para o corpo do texto.

## Armazenamento de dados

Os dados agora ficam salvos no **Firestore** (banco de dados do Firebase), em três coleções principais: `users`, `participantes` e `chamadas`, além de um documento auxiliar `meta/importLog`. Isso significa que:

- Os dados são **compartilhados de verdade** entre a coordenação e todas as integrantes, em qualquer aparelho.
- As senhas são validadas pelo **Firebase Authentication** (seguro, com hash de verdade no servidor do Google) — bem diferente da fase inicial do projeto, que usava só `localStorage` no navegador.

Toda leitura/escrita de dados passa pelo objeto `DB` (em `js/db.js`), e toda autenticação passa pelo objeto `Auth` (em `js/auth.js`). Se um dia for necessário trocar de fornecedor de backend, essas duas peças concentram praticamente toda a integração.

## Regras de cálculo

Para cada participante, com base nas chamadas em que ela aparece:

```
% de presença = (nº de presenças ÷ total de atividades) × 100
% de falta     = (nº de faltas ÷ total de atividades) × 100
```

Faltas justificadas são contadas à parte e não entram no `% de falta`.

## Importação de planilha

Colunas esperadas: `Nome`, `Data`, `Atividade`, `Status` (Presente/Falta/Justificada) e `Observação` (opcional). A tela de importação explica o formato e oferece um botão para baixar um modelo pronto. Participantes que ainda não existem no sistema são cadastradas automaticamente. Cada combinação de participante + data + atividade só é importada uma vez, mesmo que a mesma planilha seja enviada de novo.
