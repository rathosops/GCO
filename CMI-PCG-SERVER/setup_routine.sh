#!/bin/bash

echo "⏳ Iniciando rotina de configuração..."

# 1. Atualizar política de restart dos serviços no docker-compose.yml
echo "🔧 Atualizando política de restart no docker-compose.yml..."
sed -i '/^\s*app:/,/^\s*[^ ]/ s/^\(\s*\)\(build\|image\|ports\|environment\|depends_on\|volumes\|env_file\|healthcheck\)/\1restart: always\n\1\2/' docker-compose.yml
sed -i '/^\s*db:/,/^\s*[^ ]/ s/^\(\s*\)\(image\|ports\|environment\|volumes\|healthcheck\)/\1restart: always\n\1\2/' docker-compose.yml

# 2. Aplicar docker-compose com política atualizada
echo "🚀 Reiniciando containers com política de restart:always..."
docker compose down
docker compose up -d

# 3. Agendar cronjob diário às 19:00 (horário de Brasília)
echo "🕒 Configurando cron para executar backup diário às 19:00 BRT..."
PROJECT_DIR="/home/$USER/PCG-CMI/CMI-PCG-SERVER"
CRON_JOB="0 19 * * * TZ=America/Sao_Paulo bash $PROJECT_DIR/make-db-backup.sh >> $PROJECT_DIR/db-backup/backup.log 2>&1"

# Remover entrada duplicada, se já existir
(crontab -l | grep -v 'make-db-backup.sh'; echo "$CRON_JOB") | crontab -

# 4. Habilitar Docker para iniciar com o sistema
echo "🛠️ Habilitando Docker para iniciar automaticamente no boot..."
sudo systemctl enable docker

# Conclusão
echo "✅ Setup concluído com sucesso!"
