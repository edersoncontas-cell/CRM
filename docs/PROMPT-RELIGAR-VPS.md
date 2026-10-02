# Prompt para a extensão do Chrome — religar a VPS da Evolution

**Quando usar:** quando a tela Conexão do CRM disser "O servidor da Evolution (sua
VPS) não está respondendo" (02/10: a VPS `147.15.65.44` ficou fora mais de 2 h).

**O que a extensão NÃO consegue fazer:** ler o QR Code (precisa do seu celular) e
mandar a mensagem de teste de outro telefone. Se o CRM pedir QR no fim, é com você.

Cole o texto abaixo da linha na extensão.

---

O servidor (VPS) onde roda o WhatsApp do meu CRM parou de responder. O IP dele é
147.15.65.44 e ele deve estar na Hostinger (https://hpanel.hostinger.com). Quero
que você descubra o que aconteceu e religue. Siga os passos na ordem. Regras que
valem o tempo todo:

- NUNCA escreva nesta conversa senha, chave de API ou valor de variável. Se o
  painel pedir login ou senha, PARE e me peça para entrar.
- NUNCA clique em: Reinstalar / Reinstall, Mudar sistema operacional / Change OS,
  Formatar, Reset, Modo de recuperação / Recovery, Restaurar snapshot ou backup,
  Excluir / Delete, Trocar senha root. Não mexa em snapshots nem backups.
- NÃO pague nada, não renove, não adicione cartão, não mude plano, não clique em
  Upgrade. Se aparecer fatura em aberto, só me diga o valor e a data.
- NÃO apague nem altere regra de firewall que já existe. Só pode CRIAR a regra
  descrita no Passo 4, e só naquele caso.
- No terminal do servidor, digite SOMENTE o comando do Passo 6, e só naquele caso.
- Se alguma tela for diferente do que está descrito, pare e me diga o que está vendo.

**Passo 1 — O que o CRM diz agora.**
Abra https://crm-lyart-ten.vercel.app/conexao (se pedir login, pare e me peça).
Espere até 1 minuto: o diagnóstico roda sozinho.
- Se aparecer "WhatsApp conectado", o servidor já voltou: PARE e me diga.
- Senão, copie da tela as linhas que começam com "Servidor no ar:" e "VPS ligada:"
  (se houver) e a primeira frase do quadro de conclusão logo abaixo delas.

**Passo 2 — Achar a VPS no painel.**
Abra https://hpanel.hostinger.com → VPS. Ache a VPS com o IP 147.15.65.44 e abra
(Gerenciar / Manage). Se não houver nenhuma VPS com esse IP, PARE e me diga os IPs
que aparecem (pode ser outra hospedagem ou o IP mudou).
Anote: o status (ligada / parada / suspensa), qualquer aviso em destaque (manutenção,
suspensão, fatura, uso de recursos) e, se houver gráfico de CPU/memória/disco, se
algum está no limite.

**Passo 3 — Ligar ou reiniciar.**
- Se estiver **suspensa**: PARE. Me diga o motivo que o painel mostra. Não pague nada.
- Se estiver **parada**: clique em Iniciar / Start e confirme.
- Se estiver **ligada** e o Passo 1 disse "porta bloqueada" ou "firewall": vá para o
  Passo 4 antes de reiniciar.
- Se estiver **ligada** em qualquer outro caso: clique em Reiniciar / Restart e confirme.
Espere 4 minutos.

**Passo 4 — Firewall (só se o Passo 1 falou em firewall ou porta bloqueada).**
Na mesma VPS, abra Segurança → Firewall (ou Firewall). Se não houver firewall
ativo, volte e reinicie (Passo 3). Se houver firewall ativo e NENHUMA regra
liberando TCP na porta 8080, crie uma: Aceitar / Accept, protocolo TCP, porta 8080,
origem qualquer (Any / 0.0.0.0/0). Salve. Se a regra já existir, não mexa e reinicie
a VPS (Passo 3). Espere 2 minutos.

**Passo 5 — Conferir no CRM.**
Volte para https://crm-lyart-ten.vercel.app/conexao e clique em Atualizar. Espere
até 1 minuto.
- "WhatsApp conectado": terminou. Vá para o Passo 7.
- Apareceu um QR Code: terminou a sua parte. Vá para o Passo 7 (eu leio o QR).
- Ainda diz que o servidor não responde: copie de novo as linhas do Passo 1 e siga.

**Passo 6 — Subir a Evolution à mão (só se o Passo 5 disser "Evolution está parada"
e já tiverem passado 5 minutos desde o reinício).**
No painel da VPS, abra o Terminal do navegador (Browser terminal / Terminal). Se ele
pedir usuário ou senha, PARE e me peça. Cole exatamente esta linha e tecle Enter:

    cd /opt/evolution && docker compose up -d

Espere terminar. Copie as últimas linhas que ele mostrar (sem nenhuma senha) e volte
ao Passo 5 uma vez. Não digite mais nada no terminal.

**Passo 7 — Me diga, nesta ordem:**
1. O status que a VPS tinha no Passo 2 e os avisos do painel (copiados).
2. O que você clicou (Iniciar, Reiniciar, regra de firewall, comando).
3. O IP que o painel mostra para a VPS.
4. O que a tela Conexão do CRM mostra no fim (conectado, QR, ou as linhas do
   diagnóstico).
