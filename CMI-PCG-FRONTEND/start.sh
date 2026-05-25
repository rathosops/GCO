#!/bin/bash
# ============================================
# Script de inicialização - CMI-PCG Frontend
# ============================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   CMI-PCG Frontend - Inicialização    ${NC}"
echo -e "${GREEN}========================================${NC}"

# Verificar se o backend está rodando
BACKEND_RUNNING=$(docker ps --filter "name=cmi-pcg-server-app-1" --format "{{.Names}}" 2>/dev/null || true)

if [ -z "$BACKEND_RUNNING" ]; then
    echo -e "${YELLOW}⚠ Backend não está rodando${NC}"
    echo -e "${YELLOW}  O frontend vai subir, mas chamadas à API vão retornar erro.${NC}"
    echo -e "${YELLOW}  Para subir o backend: cd ../CMI-PCG-SERVER && docker compose up -d${NC}"
    echo ""
fi

# Subir o frontend
echo -e "${GREEN}▶ Subindo frontend...${NC}"
docker compose up -d

# Aguardar o container ficar healthy
echo -e "${GREEN}▶ Aguardando container ficar saudável...${NC}"
sleep 3

# Verificar se precisa conectar à rede do backend
if [ -n "$BACKEND_RUNNING" ]; then
    BACKEND_NETWORK=$(docker network ls --filter "name=cmi-pcg-server_default" --format "{{.Name}}" 2>/dev/null || true)
    
    if [ -n "$BACKEND_NETWORK" ]; then
        # Verificar se já está conectado
        ALREADY_CONNECTED=$(docker network inspect cmi-pcg-server_default --format '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null | grep -o "cmi-pcg-frontend" || true)
        
        if [ -z "$ALREADY_CONNECTED" ]; then
            echo -e "${GREEN}▶ Conectando frontend à rede do backend...${NC}"
            docker network connect cmi-pcg-server_default cmi-pcg-frontend 2>/dev/null || true
            echo -e "${GREEN}✓ Frontend conectado ao backend${NC}"
        else
            echo -e "${GREEN}✓ Frontend já está conectado ao backend${NC}"
        fi
    fi
fi

# Status final
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Frontend rodando em: http://localhost:3000${NC}"

if [ -n "$BACKEND_RUNNING" ]; then
    echo -e "${GREEN}✓ Backend disponível em: http://localhost:5000${NC}"
else
    echo -e "${YELLOW}⚠ Backend não conectado${NC}"
fi

echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Comandos úteis:"
echo -e "  ${YELLOW}docker compose logs -f${NC}     - Ver logs"
echo -e "  ${YELLOW}docker compose down${NC}        - Parar"
echo -e "  ${YELLOW}docker compose restart${NC}     - Reiniciar"