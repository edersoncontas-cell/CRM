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

1. **APIs e serviços** → **Tela de permissão OAuth** (ou "Branding" na tela nova).
2. Tipo de usuário: **Externo** → **Criar**.
3. Nome do app: `CRM do Edy`; e-mail de suporte e de contato: o seu. **Salvar**.
4. Em **Público-alvo / Usuários de teste**, clique em **Adicionar usuários** e
   coloque o seu próprio e-mail Google. (O app fica em modo "teste", que é
   suficiente: só a sua conta precisa conectar. Não é preciso publicar.)

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
   Se aparecer "app não verificado", clique em **Avançado** → **Acessar CRM do
   Edy** (é o seu próprio app, em modo teste).
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
- **"access_denied" / usuário não autorizado**: seu e-mail não está em
  "Usuários de teste" (passo 3.4).
- **Conectou mas não cria evento**: veja **ZEUS** → eventos de erro; o mais
  comum é a Calendar API não ativada (passo 2).
- **Quer trocar de conta**: **Desconectar** no card e conecte de novo.
