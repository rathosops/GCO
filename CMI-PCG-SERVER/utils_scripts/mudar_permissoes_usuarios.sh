#!/bin/bash
# toggle_write_permissions.sh
# Alterna permissões de escrita dos usuários matheus_db e daiara_db no banco clinicacmi
# e envia notificação ao Discord.

CONTAINER="cmi-pcg-server-db"
DB="clinicacmi"
USERS="matheus_db, daiara_db"

# Determina o diretório do script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Carrega o .env do diretório raiz do projeto
if [ -f "$PROJECT_ROOT/.env" ]; then
  source "$PROJECT_ROOT/.env"
  echo "✓ Arquivo .env carregado de: $PROJECT_ROOT/.env"
else
  echo "⚠ Arquivo .env não encontrado em: $PROJECT_ROOT/.env"
fi

# Escolhe webhook de produção como padrão
WEBHOOK_URL="${DISCORD_WEBHOOK_URL_PROD:-}"

if [ -z "$WEBHOOK_URL" ]; then
  echo "⚠ Aviso: Nenhum webhook configurado (.env não contém DISCORD_WEBHOOK_URL_PROD)"
else
  echo "✓ Webhook Discord configurado: ${WEBHOOK_URL:0:50}..."
fi

if [ -z "$1" ]; then
  echo "Uso: $0 [on|off]"
  echo ""
  echo "  on  - Ativa permissões INSERT, UPDATE, DELETE"
  echo "  off - Remove permissões INSERT, UPDATE, DELETE"
  exit 1
fi

MODE=$1

TIMESTAMP=$(date '+%d/%m/%Y %H:%M:%S')
HOSTNAME=$(hostname)

if [ "$MODE" = "on" ]; then
  echo "Ativando permissões de escrita (INSERT, UPDATE, DELETE) para $USERS..."
  docker exec -i $CONTAINER psql -U postgres -d $DB <<EOF
\c $DB
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO matheus_db, daiara_db;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT INSERT, UPDATE, DELETE ON TABLES TO matheus_db, daiara_db;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO matheus_db, daiara_db;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO matheus_db, daiara_db;
EOF
  echo "✓ Permissões de escrita ativadas."
  
  MESSAGE="🟢 **Permissões ATIVADAS** no banco \`$DB\`\\nUsuários: \`$USERS\`\\nData/Hora: $TIMESTAMP\\nServidor: \`$HOSTNAME\`"

elif [ "$MODE" = "off" ]; then
  echo "Removendo permissões de escrita (INSERT, UPDATE, DELETE) para $USERS..."
  docker exec -i $CONTAINER psql -U postgres -d $DB <<EOF
\c $DB
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM matheus_db, daiara_db;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT, UPDATE, DELETE ON TABLES FROM matheus_db, daiara_db;
REVOKE USAGE ON ALL SEQUENCES IN SCHEMA public FROM matheus_db, daiara_db;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE USAGE ON SEQUENCES FROM matheus_db, daiara_db;
EOF
  echo "✓ Permissões de escrita removidas."
  
  MESSAGE="🔴 **Permissões DESATIVADAS** no banco \`$DB\`\\nUsuários: \`$USERS\`\\nData/Hora: $TIMESTAMP\\nServidor: \`$HOSTNAME\`"

else
  echo "Erro: Opção inválida. Use 'on' ou 'off'."
  exit 1
fi

# Envia notificação ao Discord (caso webhook esteja configurado)
if [ -n "$WEBHOOK_URL" ]; then
  curl -H "Content-Type: application/json" \
       -X POST \
       -d "{\"content\": \"$MESSAGE\"}" \
       "$WEBHOOK_URL" \
       >/dev/null 2>&1
  
  if [ $? -eq 0 ]; then
    echo "✓ Notificação enviada ao Discord."
  else
    echo "⚠ Falha ao enviar notificação ao Discord."
  fi
fi
