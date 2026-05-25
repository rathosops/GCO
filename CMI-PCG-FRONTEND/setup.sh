#!/bin/bash

echo "🚀 Configurando CMI-PCG Frontend..."
echo ""

# Verifica se o Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Por favor, instale o Node.js 20+ primeiro."
    exit 1
fi

echo "✅ Node.js versão: $(node --version)"
echo "✅ npm versão: $(npm --version)"
echo ""

# Cria arquivo .env se não existir
if [ ! -f .env ]; then
    echo "📝 Criando arquivo .env..."
    cp .env.example .env
    echo "✅ Arquivo .env criado. Configure as variáveis de ambiente antes de executar."
else
    echo "✅ Arquivo .env já existe."
fi
echo ""

# Instala dependências
echo "📦 Instalando dependências..."
npm install
echo ""

echo "✨ Setup concluído!"
echo ""
echo "Para iniciar o servidor de desenvolvimento:"
echo "  npm run dev"
echo ""
echo "Para buildar para produção:"
echo "  npm run build"
echo ""
echo "Para executar com Docker:"
echo "  docker-compose up -d --build"
echo ""