#!/bin/bash
# setup_global_commands.sh
# Configura comandos globais para gerenciar permissões do banco de dados

echo "🔧 Configurando comandos globais para CMI-PCG-SERVER..."
echo ""

# Determina o diretório do script atual
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Caminho do script original
ORIGINAL_SCRIPT="$SCRIPT_DIR/mudar_permissoes_usuarios.sh"

# Verifica se o script existe
if [ ! -f "$ORIGINAL_SCRIPT" ]; then
  echo "❌ Erro: Script não encontrado em $ORIGINAL_SCRIPT"
  exit 1
fi

# Cria o diretório para scripts locais se não existir
mkdir -p ~/.local/bin

# Cria o wrapper para o comando ON
cat > ~/.local/bin/pcg-cmi-db-acessos-on << 'WRAPPER_ON'
#!/bin/bash
# Comando global para ATIVAR permissões de escrita no banco CMI
bash SCRIPT_PATH on "$@"
WRAPPER_ON

# Cria o wrapper para o comando OFF
cat > ~/.local/bin/pcg-cmi-db-acessos-off << 'WRAPPER_OFF'
#!/bin/bash
# Comando global para DESATIVAR permissões de escrita no banco CMI
bash SCRIPT_PATH off "$@"
WRAPPER_OFF

# Substitui o placeholder pelo caminho real
sed -i "s|SCRIPT_PATH|$ORIGINAL_SCRIPT|g" ~/.local/bin/pcg-cmi-db-acessos-on
sed -i "s|SCRIPT_PATH|$ORIGINAL_SCRIPT|g" ~/.local/bin/pcg-cmi-db-acessos-off

# Dá permissão de execução
chmod +x ~/.local/bin/pcg-cmi-db-acessos-on
chmod +x ~/.local/bin/pcg-cmi-db-acessos-off

echo "✓ Comandos criados em ~/.local/bin/"
echo ""

# Verifica se ~/.local/bin está no PATH
if [[ ":$PATH:" == *":$HOME/.local/bin:"* ]]; then
  echo "✓ ~/.local/bin já está no PATH"
else
  echo "⚠ Adicionando ~/.local/bin ao PATH..."
  
  # Detecta o shell
  if [ -n "$ZSH_VERSION" ]; then
    SHELL_RC="$HOME/.zshrc"
  else
    SHELL_RC="$HOME/.bashrc"
  fi
  
  # Adiciona ao arquivo de configuração do shell
  echo '' >> "$SHELL_RC"
  echo '# Adiciona ~/.local/bin ao PATH para comandos personalizados' >> "$SHELL_RC"
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$SHELL_RC"
  
  echo "✓ PATH atualizado em $SHELL_RC"
  echo ""
  echo "⚠ IMPORTANTE: Execute o comando abaixo para aplicar as mudanças:"
  echo "   source $SHELL_RC"
  echo ""
  echo "   Ou feche e abra o terminal novamente."
fi

echo ""
echo "✅ Configuração concluída!"
echo ""
echo "📋 Comandos disponíveis:"
echo "   pcg-cmi-db-acessos-on  → Ativa permissões de escrita (INSERT, UPDATE, DELETE)"
echo "   pcg-cmi-db-acessos-off → Remove permissões de escrita"
echo ""
echo "💡 Teste agora:"
echo "   pcg-cmi-db-acessos-on"
echo ""
