#!/usr/bin/env bash
# =============================================================================
#  Evolution API — WhatsApp do CRM em UM comando (Ubuntu/Debian, como root)
#
#  Num servidor novo (VPS ou Oracle Cloud), conecte por SSH e rode:
#
#    curl -fsSL https://raw.githubusercontent.com/edersoncontas-cell/CRM/claude/relaxed-cori-5c3g4l/evolution/instalar.sh \
#      | sudo bash -s -- https://SEU-CRM.vercel.app
#
#  (troque https://SEU-CRM.vercel.app pela URL do seu CRM na Vercel; pode
#   omitir — aí o webhook é apontado depois, pela tela /conexao do CRM)
#
#  O que ele faz, sozinho:
#   1. instala o Docker (se não tiver);
#   2. gera uma chave secreta e descobre o IP público do servidor;
#   3. sobe Evolution API + Postgres + Redis em /opt/evolution (reinicia
#      sozinho se o servidor reiniciar);
#   4. libera a porta 8080 no firewall;
#   5. cria a instância "crm" já apontando o webhook para o CRM;
#   6. imprime as 3 variáveis para colar na Vercel (e salva em
#      /opt/evolution/CREDENCIAIS.txt).
#
#  Pode rodar de novo à vontade: ele reaproveita a chave e não duplica nada.
# =============================================================================
set -euo pipefail

CRM_URL="${1:-}"
CRM_URL="${CRM_URL%/}"
DIR=/opt/evolution
INSTANCIA="${EVOLUTION_INSTANCE:-crm}"
IMAGEM="${EVOLUTION_IMAGE:-evoapicloud/evolution-api:v2.3.7}"

verde() { printf '\033[1;32m%s\033[0m\n' "$*"; }
amarelo() { printf '\033[1;33m%s\033[0m\n' "$*"; }
falha() { printf '\033[1;31mERRO: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || falha "rode como root (use sudo)."
command -v apt-get >/dev/null || falha "este instalador é para Ubuntu/Debian."

verde "1/6 Pacotes básicos"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates openssl >/dev/null

verde "2/6 Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker >/dev/null 2>&1 || true
docker compose version >/dev/null 2>&1 || falha "docker compose não ficou disponível. Instale o pacote docker-compose-plugin e rode de novo."

verde "3/6 Chave e endereço"
mkdir -p "$DIR"
chmod 700 "$DIR"
if [ -f "$DIR/.env" ]; then
  # shellcheck disable=SC1091
  . "$DIR/.env"
fi
CHAVE="${AUTHENTICATION_API_KEY:-$(openssl rand -hex 24)}"
IP="$(curl -4 -fsS --max-time 8 https://api.ipify.org 2>/dev/null || curl -4 -fsS --max-time 8 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
[ -n "$IP" ] || falha "não consegui descobrir o IP público do servidor."
URL_EVOLUTION="${SERVER_URL:-http://$IP:8080}"

cat > "$DIR/.env" <<EOF
SERVER_URL=$URL_EVOLUTION
AUTHENTICATION_API_KEY=$CHAVE
EOF
chmod 600 "$DIR/.env"

cat > "$DIR/docker-compose.yml" <<EOF
# Gerado por instalar.sh — chave e URL ficam em .env (mesma pasta).
services:
  evolution-api:
    image: $IMAGEM
    container_name: evolution_api
    restart: always
    ports:
      - "8080:8080"
    depends_on:
      - postgres
      - redis
    environment:
      - SERVER_URL=\${SERVER_URL}
      - AUTHENTICATION_API_KEY=\${AUTHENTICATION_API_KEY}
      - AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true
      - LANGUAGE=pt-BR
      - DATABASE_ENABLED=true
      - DATABASE_PROVIDER=postgresql
      - DATABASE_CONNECTION_URI=postgresql://evolution:evolution@postgres:5432/evolution?schema=public
      - DATABASE_CONNECTION_CLIENT_NAME=evolution
      - DATABASE_SAVE_DATA_INSTANCE=true
      - DATABASE_SAVE_DATA_NEW_MESSAGE=true
      - DATABASE_SAVE_MESSAGE_UPDATE=false
      - DATABASE_SAVE_DATA_CONTACTS=true
      - DATABASE_SAVE_DATA_CHATS=true
      - DATABASE_SAVE_DATA_LABELS=false
      - DATABASE_SAVE_DATA_HISTORIC=true
      - CACHE_REDIS_ENABLED=true
      - CACHE_REDIS_URI=redis://redis:6379/6
      - CACHE_REDIS_PREFIX_KEY=evolution
      - CACHE_REDIS_SAVE_INSTANCES=false
      - CACHE_LOCAL_ENABLED=false
      - WEBHOOK_GLOBAL_ENABLED=false
      - CONFIG_SESSION_PHONE_CLIENT=CRM
      - CONFIG_SESSION_PHONE_NAME=Chrome
      - QRCODE_LIMIT=30
    volumes:
      - evolution_instances:/evolution/instances

  postgres:
    image: postgres:16-alpine
    container_name: evolution_postgres
    restart: always
    environment:
      - POSTGRES_USER=evolution
      - POSTGRES_PASSWORD=evolution
      - POSTGRES_DB=evolution
    volumes:
      - evolution_postgres:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: evolution_redis
    restart: always
    command: redis-server --save 60 1 --loglevel warning
    volumes:
      - evolution_redis:/data

volumes:
  evolution_instances:
  evolution_postgres:
  evolution_redis:
EOF

verde "4/6 Firewall (porta 8080)"
if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 8080/tcp >/dev/null || true
fi
if command -v iptables >/dev/null; then
  # Oracle Cloud vem com iptables bloqueando tudo além do SSH.
  if ! iptables -C INPUT -p tcp --dport 8080 -j ACCEPT 2>/dev/null; then
    iptables -I INPUT 5 -m state --state NEW -p tcp --dport 8080 -j ACCEPT 2>/dev/null || iptables -I INPUT -p tcp --dport 8080 -j ACCEPT || true
  fi
  # A regra acima vive só na memória: sem salvar, o primeiro reboot da VM
  # (manutenção da Oracle, por exemplo) fecha a porta de novo — a Evolution
  # continua rodando, mas ninguém a alcança e o CRM fica sem QR. Já aconteceu.
  if ! command -v netfilter-persistent >/dev/null; then
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq iptables-persistent >/dev/null 2>&1 || true
  fi
  if command -v netfilter-persistent >/dev/null; then
    netfilter-persistent save >/dev/null 2>&1 || true
  else
    # Sem o pacote de persistência: reaplica a regra a cada boot.
    mkdir -p /etc/systemd/system
    cat > /etc/systemd/system/evolution-porta-8080.service <<'UNIT'
[Unit]
Description=Libera a porta 8080 da Evolution API no boot
After=network-online.target

[Service]
Type=oneshot
ExecStart=/bin/sh -c '/sbin/iptables -C INPUT -p tcp --dport 8080 -j ACCEPT 2>/dev/null || /sbin/iptables -I INPUT 5 -m state --state NEW -p tcp --dport 8080 -j ACCEPT'
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
UNIT
    systemctl daemon-reload >/dev/null 2>&1 || true
    systemctl enable --now evolution-porta-8080.service >/dev/null 2>&1 || true
  fi
fi

verde "5/6 Subindo a Evolution API (pode levar 1–2 min na primeira vez)"
cd "$DIR"
docker compose pull -q 2>/dev/null || true
docker compose up -d
ok=0
for _ in $(seq 1 90); do
  if curl -fsS --max-time 3 http://127.0.0.1:8080/ >/dev/null 2>&1; then ok=1; break; fi
  sleep 2
done
[ "$ok" = 1 ] || { docker compose logs --tail 40 evolution-api; falha "a Evolution não respondeu na porta 8080. Veja o log acima."; }

verde "6/6 Instância \"$INSTANCIA\""
if [ -n "$CRM_URL" ]; then
  WEBHOOK_JSON=",\"webhook\":{\"enabled\":true,\"url\":\"$CRM_URL/api/webhooks/evolution\",\"byEvents\":false,\"base64\":true,\"events\":[\"MESSAGES_UPSERT\",\"MESSAGES_UPDATE\"]}"
else
  WEBHOOK_JSON=""
fi
resp="$(curl -sS --max-time 30 -X POST "http://127.0.0.1:8080/instance/create" \
  -H "apikey: $CHAVE" -H "Content-Type: application/json" \
  -d "{\"instanceName\":\"$INSTANCIA\",\"integration\":\"WHATSAPP-BAILEYS\",\"qrcode\":true,\"syncFullHistory\":true$WEBHOOK_JSON}" || true)"
if echo "$resp" | grep -qiE '"instanceName"|already|in use'; then
  echo "   instância pronta."
else
  amarelo "   a Evolution respondeu: ${resp:0:300}"
  amarelo "   (se a instância não existir, o CRM cria pela tela /conexao)"
fi
if [ -n "$CRM_URL" ]; then
  curl -sS --max-time 30 -X POST "http://127.0.0.1:8080/webhook/set/$INSTANCIA" \
    -H "apikey: $CHAVE" -H "Content-Type: application/json" \
    -d "{\"webhook\":{\"enabled\":true,\"url\":\"$CRM_URL/api/webhooks/evolution\",\"byEvents\":false,\"base64\":true,\"events\":[\"MESSAGES_UPSERT\",\"MESSAGES_UPDATE\"]}}" >/dev/null 2>&1 || true
fi

cat > "$DIR/CREDENCIAIS.txt" <<EOF
Evolution API instalada em $(date '+%d/%m/%Y %H:%M')

Cole estas variáveis na Vercel (Settings → Environment Variables) e faça Redeploy:

EVOLUTION_API_URL=$URL_EVOLUTION
EVOLUTION_API_KEY=$CHAVE
EVOLUTION_INSTANCE=$INSTANCIA

Manager (painel da Evolution): $URL_EVOLUTION/manager  (senha = a chave acima)
Webhook do CRM: ${CRM_URL:-<defina depois em /conexao>}/api/webhooks/evolution

Comandos úteis (nesta pasta, $DIR):
  docker compose logs -f evolution-api   # acompanhar
  docker compose restart                 # reiniciar
  docker compose down && docker compose up -d
EOF
chmod 600 "$DIR/CREDENCIAIS.txt"

echo
verde "============================================================"
verde " PRONTO. Agora na Vercel → Settings → Environment Variables:"
verde "============================================================"
echo
echo "  EVOLUTION_API_URL=$URL_EVOLUTION"
echo "  EVOLUTION_API_KEY=$CHAVE"
echo "  EVOLUTION_INSTANCE=$INSTANCIA"
echo
echo "  Depois: Deployments → ⋯ → Redeploy. Aí abra /conexao no CRM e escaneie o QR."
echo "  (isto ficou salvo em $DIR/CREDENCIAIS.txt)"
echo
