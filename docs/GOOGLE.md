# Google Agenda e Contatos — como conectar (grátis)

O CRM lança cada visita na sua Google Agenda (com lembrete 1 dia e 1 hora
antes) e usa os nomes dos seus contatos do Google para batizar clientes que
ficaram como "Contato 5528…". Tudo pela conta Google do próprio vendedor, sem
custo. Leva uns 10 minutos, uma vez só.

## 1. Criar o projeto no Google Cloud

1. Abra <https://console.cloud.google.com/> logado com a sua conta Google.
2. No topo, clique no seletor de projeto → **Novo projeto** → nome `CRM do Edy`
   → **Criar**. Selecione o projeto criado.

## 2. Ativar as duas APIs

1. Menu ☰ → **APIs e serviços** → **Biblioteca**.
2. Procure **Google Calendar API** → **Ativar**.
3. Procure **People API** → **Ativar**.

## 3. Tela de consentimento

1. Menu ☰ → **Google Auth Platform** (antes chamado **Tela de permissão OAuth**;
   em inglês, "OAuth consent screen").
2. Tipo de usuário: **Externo** → **Criar**.
3. Nome do app: `CRM do Edy`; e-mail de suporte e de contato: o seu. **Salvar**.
4. Em **Público-alvo / Usuários de teste**, clique em **Adicionar usuários** e
   coloque o seu próprio e-mail Google.
5. **Publique o app** (ainda em **Público-alvo**, em inglês *Audience*): em
   **Status da publicação** (*Publishing status: Testing*), clique em
   **Publicar app** (*Publish app*) e confirme. É grátis e não precisa
   enviar para verificação do Google. **Não pule este passo**: com o app em
   modo "teste" o Google só vale o acesso por **7 dias** — a conexão cai toda
   semana com "Token has been expired or revoked" e as visitas param de ir
   para a Agenda. (Este passo estava errado nas versões antigas deste guia, que
   mandavam deixar em teste.) Publicado e sem verificação, o app mostra o aviso
   "O Google não verificou este app" na hora de conectar (passo 6) e vale para até 100
   contas — para um vendedor sozinho, é o que precisa.

## 4. Criar a credencial

1. **APIs e serviços** → **Credenciais** → **Criar credenciais** → **ID do
   cliente OAuth**.
2. Tipo: **Aplicativo da Web**. Nome: `CRM`.
3. Em **URIs de redirecionamento autorizados**, adicione exatamente:

   ```
   https://SEU-APP.vercel.app/api/google/callback
   ```

   (troque `SEU-APP.vercel.app` pelo endereço do seu CRM; é o mesmo endereço
   que aparece em Configurações → Google → "URI de redirecionamento").
4. **Criar**. Copie o **ID do cliente** e a **Chave secreta do cliente**.

## 5. Colocar as chaves na Vercel

1. Vercel → seu projeto → **Settings** → **Environment Variables**.
2. Adicione:

   | Nome | Valor |
   |---|---|
   | `GOOGLE_CLIENT_ID` | o ID do cliente (termina em `.apps.googleusercontent.com`) |
   | `GOOGLE_CLIENT_SECRET` | a chave secreta |
   | `GOOGLE_REDIRECT_URI` | `https://SEU-APP.vercel.app/api/google/callback` |

3. **Deployments** → menu ⋯ do último deploy → **Redeploy** (as variáveis só
   valem em um deploy novo).

## 6. Conectar

1. No CRM: **Configurações** → card **Google Agenda e Contatos** → **Conectar
   com o Google**.
2. Escolha a sua conta, aceite as permissões (agenda e contatos — leitura e
   gravação, para os clientes do CRM poderem ir para a sua agenda).
   Se aparecer "O Google não verificou este app", clique em **Avançado** →
   **Acessar CRM do Edy** (é o seu próprio app).
3. De volta ao CRM, o card mostra o e-mail conectado. Pronto:
   - toda visita nova (formulário, voz, IA ou WhatsApp) entra na agenda;
   - remover a visita no CRM apaga o evento;
   - a **lista de clientes fica ligada ao Google Contatos**: todo contato
     com telefone vira cliente (ou completa o cadastro de quem já existe com
     o mesmo número — nome real no lugar de "Contato 5528…", e-mail, endereço
     e município). Roda a cada hora e no botão **Sincronizar agora** da tela
     de Clientes;
   - opcional: marque **Enviar clientes do CRM para o Google Contatos** para
     os clientes que você cadastra aqui aparecerem no celular.

Se a conta foi conectada numa versão anterior (só leitura de contatos),
desconecte e conecte de novo para liberar o envio.

## Problemas comuns

- **"redirect_uri_mismatch"**: o URI cadastrado no Google não é idêntico ao
  `GOOGLE_REDIRECT_URI`. Confira `https`, o domínio e o final `/api/google/callback`.
- **"access_denied" / usuário não autorizado**: com o app em teste, seu e-mail
  não está em "Usuários de teste" (passo 3.4). Com o app já publicado, quase
  sempre foi só o cancelamento da tela do Google; se persistir, o
  administrador do Google Workspace bloqueou o app ou o limite de 100 contas do
  app não verificado foi atingido.
- **"Token has been expired or revoked"** (a faixa de Clientes e o card de
  Configurações passam a mostrar "reconexão necessária" com o botão
  **Reconectar com o Google**): o Google recusou renovar o acesso. Causa mais
  comum: o app está **em teste** (passo 3.5) e o acesso venceu aos 7 dias.
  Publique o app e reconecte — só uma vez. Outras causas: a permissão foi
  removida em myaccount.google.com/permissions ou o administrador do Google
  Workspace bloqueou o app. Nada
  se perde: as visitas e os clientes continuam no CRM; enquanto estiver caída,
  só o lembrete na Agenda e a sincronização de contatos ficam parados.
- **Conectou mas não cria evento**: veja **ZEUS** → eventos de erro; o mais
  comum é a Calendar API não ativada (passo 2).
- **Quer trocar de conta**: **Desconectar** no card e conecte de novo.
