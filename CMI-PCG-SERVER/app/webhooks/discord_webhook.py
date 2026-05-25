import logging
import os
import requests
from dotenv import load_dotenv

# Carrega variáveis do .env
load_dotenv()

# Detecta ambiente atual (development ou production)
FLASK_ENV = os.getenv("FLASK_ENV", "development")

# Escolhe a URL correta
if FLASK_ENV == "production":
    DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL_PROD")
else:
    DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL_DEV")

# Webhook específico para backups
DISCORD_WEBHOOK_DB_BACKUP = os.getenv("DISCORD_WEBHOOK_DB_BACKUP")

MAX_DISCORD_LENGTH = 1900  # segurança: Discord aceita até 2000 chars


def send_discord_message(message: str):
    """
    Envia uma mensagem simples para o canal do Discord.
    """
    if not DISCORD_WEBHOOK_URL:
        logging.warning("[Discord Webhook] URL não configurada.")
        return

    if len(message) > MAX_DISCORD_LENGTH:
        message = message[:MAX_DISCORD_LENGTH] + "... (truncated)"

    payload = {"content": message}

    try:
        response = requests.post(
            DISCORD_WEBHOOK_URL,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=5,
        )
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        logging.error(f"[Discord Webhook] Falha ao enviar mensagem: {e}")


def send_discord_file(file_path: str, message: str = "Backup do banco"):
    """
    Envia um arquivo para o Discord usando webhook específico para backups.
    """
    if not DISCORD_WEBHOOK_DB_BACKUP:
        logging.warning("[Discord Webhook] URL de backup não configurada.")
        return

    if not os.path.isfile(file_path):
        logging.error(f"[Discord Webhook] Arquivo não encontrado: {file_path}")
        return

    try:
        with open(file_path, "rb") as f:
            response = requests.post(
                DISCORD_WEBHOOK_DB_BACKUP,
                files={"file": (os.path.basename(file_path), f)},
                data={"content": message},
                timeout=10,
            )
            response.raise_for_status()
            logging.info(f"[Discord Webhook] Backup enviado com sucesso: {file_path}")
    except requests.exceptions.RequestException as e:
        logging.error(f"[Discord Webhook] Falha ao enviar arquivo: {e}")


class DiscordLogHandler(logging.Handler):
    """
    Um logging.Handler que envia mensagens de log para um canal do Discord.
    """

    def emit(self, record: logging.LogRecord):
        try:
            log_entry = self.format(record)
            formatted_message = f"🚨 **LOG DE ERRO** 🚨\n```{log_entry}```"
            send_discord_message(formatted_message)
        except Exception as e:
            logging.error(f"[Discord Webhook] Falha no handler: {e}")
