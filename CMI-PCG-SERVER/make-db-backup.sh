#!/bin/bash

# Configurações
DB_NAME="clinicacmi"
DB_USER="postgres"
DOCKER_CONTAINER="cmi-pcg-server-db"
PROJECT_DIR="/home/cmilms/PCG-CMI/CMI-PCG-SERVER"
BACKUP_DIR="$PROJECT_DIR/db-backup"

mkdir -p "$BACKUP_DIR"
chmod 755 "$BACKUP_DIR"
# Criar diretório de backups se não existir
mkdir -p "$BACKUP_DIR"
chmod 755 "$BACKUP_DIR"

# Gerar nome do arquivo com timestamp
TIMESTAMP=$(date +"%d-%m-%Y-%H-%M-%S")
BACKUP_FILE="${BACKUP_DIR}/${TIMESTAMP}-backup.sql"

# Executar pg_dump no container Docker
docker exec -t "$DOCKER_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"

# Verificar se o backup foi bem sucedido
if [ $? -eq 0 ]; then
    echo "Backup realizado com sucesso: ${BACKUP_FILE}"
    # Manter apenas últimos 7 backups
    ls -t "$BACKUP_DIR"/*.sql | tail -n +8 | xargs rm -f

    # Enviar para Discord
    python3 - <<EOF
import sys
sys.path.insert(0, "$PROJECT_DIR")
from app.webhooks.discord_webhook import send_discord_file
send_discord_file("${BACKUP_FILE}", message="Backup diário do banco de dados")
EOF

else
    echo "Erro ao realizar backup!" >&2
    exit 1
fi

# Dar permissão aos arquivos de backup
chmod 644 "$BACKUP_FILE"
