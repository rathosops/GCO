"""
Parser de PDFs de NFS-e emitidas pela Prefeitura (Simpliss).

Responsabilidade única: extrair dados estruturados de PDFs de NFS-e.
Não acessa banco, não faz I/O além do PDF recebido.

Compatível com relatórios do sistema Simpliss.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date, datetime
from enum import Enum
from io import BytesIO
from typing import BinaryIO

import pdfplumber


class NfseStatus(str, Enum):
    """Status possíveis de uma NFS-e."""

    NORMAL = "NORMAL"
    CANCELADA = "CANCELADA"
    SUBSTITUIDA_CANCELADA = "ST CANC"


@dataclass(frozen=True)
class NfseRecord:
    """Registro individual de uma NFS-e extraída do PDF."""

    numero: int
    data_emissao: date
    documento_tomador: str  # CPF (11 dígitos) ou CNPJ (14 dígitos), só números
    nome_tomador: str
    valor_nf: float
    valor_base: float
    aliquota: float
    valor_issqn: float
    status: NfseStatus
    is_cnpj: bool

    @property
    def is_cpf(self) -> bool:
        return not self.is_cnpj


@dataclass
class NfsePdfParseResult:
    """Resultado do parsing de um PDF de NFS-e."""

    cnpj_prestador: str | None = None
    razao_social_prestador: str | None = None
    periodo_inicio: date | None = None
    periodo_fim: date | None = None
    registros: list[NfseRecord] = field(default_factory=list)
    total_notas_emitidas: int = 0
    erros: list[str] = field(default_factory=list)

    @property
    def registros_normais(self) -> list[NfseRecord]:
        """Retorna apenas NFS-e com status NORMAL (válidas)."""
        return [r for r in self.registros if r.status == NfseStatus.NORMAL]

    @property
    def registros_cancelados(self) -> list[NfseRecord]:
        """Retorna NFS-e canceladas ou substituídas."""
        return [r for r in self.registros if r.status != NfseStatus.NORMAL]


def _only_digits(value: str) -> str:
    """Extrai apenas dígitos de uma string."""
    return "".join(c for c in value if c.isdigit())


def _parse_br_float(value: str) -> float:
    """Converte valor monetário BR (1.234,56) para float."""
    cleaned = value.replace(".", "").replace(",", ".")
    return float(cleaned)


def _parse_br_date(value: str) -> date:
    """Converte data BR (DD/MM/YYYY) para date."""
    return datetime.strptime(value, "%d/%m/%Y").date()


def _classify_document(raw_doc: str) -> tuple[str, bool]:
    """
    Classifica e normaliza documento do tomador.

    Returns:
        (documento_somente_digitos, is_cnpj)
    """
    digits = _only_digits(raw_doc)

    if "/" in raw_doc or len(digits) == 14:
        return digits.zfill(14), True

    return digits.zfill(11), False


# Regex que captura cada linha de NFS-e do relatório Simpliss
_NFSE_LINE_PATTERN = re.compile(
    r"^(\d+)\s+"  # Nº da NF
    r"(\d{2}/\d{2}/\d{4})\s+"  # Data emissão
    r"(\d+\.\d+)\s+"  # Atividade (ignorada)
    r"([\d.\-/]+)\s+"  # CPF ou CNPJ (formatado)
    r"(.+?)\s+"  # Nome do tomador
    r"([\d.,]+)\s+"  # Vl. NF
    r"([\d.,]+)\s+"  # Vl. Dedução
    r"([\d.,]+)\s+"  # Vl. Base
    r"([\d.,]+)\s+"  # Alíquota
    r"([\d.,]+)\s+"  # Vl. ISSQN
    r"(?:NÃO|SIM)\s+"  # Retido (ignorado)
    r"(NORMAL|CANCELADA|ST CANC)\s+"  # Status
    r"(.+)$",  # Local do recolhimento
    re.MULTILINE,
)

# Regex para extrair metadados do cabeçalho
_CNPJ_PRESTADOR_PATTERN = re.compile(r"CNPJ\s*:\s*([\d./\-]+)")
_RAZAO_SOCIAL_PATTERN = re.compile(r"Razão Social\s*:\s*(.+?)$", re.MULTILINE)
_PERIODO_PATTERN = re.compile(
    r"Período:\s*de\s+(\d{2}/\d{2}/\d{4})\s+até\s+(\d{2}/\d{2}/\d{4})"
)


class NfsePdfParser:
    """
    Parser de PDFs de NFS-e no formato Simpliss (Prefeitura).

    Uso:
        parser = NfsePdfParser()
        result = parser.parse(file_bytes)
        # ou
        result = parser.parse_from_path("/caminho/para/arquivo.pdf")
    """

    def parse(self, file_data: bytes | BinaryIO) -> NfsePdfParseResult:
        """
        Extrai todos os registros de NFS-e de um PDF.

        Args:
            file_data: Bytes do PDF ou file-like object.

        Returns:
            NfsePdfParseResult com registros extraídos.
        """
        result = NfsePdfParseResult()

        if isinstance(file_data, bytes):
            file_data = BytesIO(file_data)

        try:
            with pdfplumber.open(file_data) as pdf:
                full_text = self._extract_full_text(pdf)
                self._extract_metadata(full_text, result)
                self._extract_records(full_text, result)
        except Exception as exc:
            result.erros.append(f"Erro ao processar PDF: {exc}")

        result.total_notas_emitidas = len(result.registros)
        return result

    def parse_from_path(self, path: str) -> NfsePdfParseResult:
        """Conveniência: abre arquivo pelo caminho."""
        with open(path, "rb") as f:
            return self.parse(f.read())

    @staticmethod
    def _extract_full_text(pdf: pdfplumber.PDF) -> str:
        """Concatena texto de todas as páginas."""
        pages_text = []
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                pages_text.append(text)
        return "\n".join(pages_text)

    @staticmethod
    def _extract_metadata(text: str, result: NfsePdfParseResult) -> None:
        """Extrai metadados do cabeçalho do relatório."""
        if match := _CNPJ_PRESTADOR_PATTERN.search(text):
            result.cnpj_prestador = _only_digits(match.group(1))

        if match := _RAZAO_SOCIAL_PATTERN.search(text):
            result.razao_social_prestador = match.group(1).strip()

        if match := _PERIODO_PATTERN.search(text):
            try:
                result.periodo_inicio = _parse_br_date(match.group(1))
                result.periodo_fim = _parse_br_date(match.group(2))
            except ValueError:
                result.erros.append("Erro ao parsear datas do período")

    @staticmethod
    def _extract_records(text: str, result: NfsePdfParseResult) -> None:
        """Extrai registros individuais de NFS-e via regex."""
        for match in _NFSE_LINE_PATTERN.finditer(text):
            try:
                documento, is_cnpj = _classify_document(match.group(4))

                record = NfseRecord(
                    numero=int(match.group(1)),
                    data_emissao=_parse_br_date(match.group(2)),
                    documento_tomador=documento,
                    nome_tomador=match.group(5).strip(),
                    valor_nf=_parse_br_float(match.group(6)),
                    valor_base=_parse_br_float(match.group(8)),
                    aliquota=_parse_br_float(match.group(9)),
                    valor_issqn=_parse_br_float(match.group(10)),
                    status=NfseStatus(match.group(11)),
                    is_cnpj=is_cnpj,
                )
                result.registros.append(record)

            except (ValueError, IndexError) as exc:
                result.erros.append(
                    f"Erro ao parsear linha (NF {match.group(1)}): {exc}"
                )
