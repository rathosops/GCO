"""
Serviço de Feriados Brasileiros.

Combina feriados oficiais (via lib holidays) com feriados customizados
cadastrados no banco de dados.

Features:
- Feriados nacionais, estaduais (SP) e municipais
- Feriados customizados da clínica
- Verificação se data é feriado
- Listagem de feriados por período
- Cache para performance

Fuso horário: America/Sao_Paulo
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from functools import lru_cache
from typing import Optional

import holidays as holidays_lib

from app.utils.timezone import SAO_PAULO_TZ, get_today_sao_paulo


@dataclass(frozen=True)
class FeriadoInfo:
    """Informações de um feriado."""

    data: date
    nome: str
    tipo: str  # NACIONAL, ESTADUAL, MUNICIPAL, PONTO_FACULTATIVO, CLINICA
    fonte: str  # "oficial" ou "customizado"
    bloqueia_agendamento: bool = True


class BrazilianHolidaysService:
    """
    Serviço para consulta de feriados brasileiros.

    Utiliza a biblioteca `holidays` para feriados oficiais e
    consulta feriados customizados do banco quando necessário.
    """

    # Estado padrão (São Paulo)
    DEFAULT_STATE = "SP"

    # Feriados estaduais de SP que não estão na lib
    _SP_EXTRA_HOLIDAYS: dict[tuple[int, int], str] = {
        (7, 9): "Revolução Constitucionalista de 1932",
    }

    def __init__(self, state: str = DEFAULT_STATE):
        """
        Inicializa o serviço.

        Args:
            state: Sigla do estado (padrão: SP)
        """
        self.state = state.upper()

    @lru_cache(maxsize=10)
    def _get_official_holidays(self, year: int) -> holidays_lib.Brazil:
        """
        Retorna objeto de feriados oficiais para o ano.

        Usa cache LRU para evitar recriação.
        """
        return holidays_lib.Brazil(years=year, subdiv=self.state, language="pt_BR")

    def _get_customized_holidays(
        self,
        start_date: date,
        end_date: date,
    ) -> list[FeriadoInfo]:
        """
        Busca feriados customizados no banco de dados.

        Args:
            start_date: Data inicial
            end_date: Data final

        Returns:
            Lista de FeriadoInfo dos feriados customizados
        """
        # Import lazy para evitar circular
        from app.models.holidays_model import FeriadoCustomizado

        query = FeriadoCustomizado.query.filter(
            FeriadoCustomizado.ativo.is_(True),
        )

        # Feriados fixos no período
        fixed = query.filter(
            FeriadoCustomizado.recorrente.is_(False),
            FeriadoCustomizado.data >= start_date,
            FeriadoCustomizado.data <= end_date,
        ).all()

        # Feriados recorrentes (verifica mês/dia)
        recorrentes = query.filter(
            FeriadoCustomizado.recorrente.is_(True),
        ).all()

        result: list[FeriadoInfo] = []

        # Adiciona feriados fixos
        for f in fixed:
            result.append(
                FeriadoInfo(
                    data=f.data,
                    nome=f.nome,
                    tipo=f.tipo,
                    fonte="customizado",
                    bloqueia_agendamento=f.bloqueia_agendamento,
                )
            )

        # Processa recorrentes
        for f in recorrentes:
            # Para cada ano no período
            for year in range(start_date.year, end_date.year + 1):
                try:
                    recurrent_date = date(year, f.data.month, f.data.day)
                    if start_date <= recurrent_date <= end_date:
                        result.append(
                            FeriadoInfo(
                                data=recurrent_date,
                                nome=f.nome,
                                tipo=f.tipo,
                                fonte="customizado",
                                bloqueia_agendamento=f.bloqueia_agendamento,
                            )
                        )
                except ValueError:
                    # 29/02 em ano não bissexto
                    continue

        return result

    def is_holiday(self, check_date: date) -> Optional[FeriadoInfo]:
        """
        Verifica se uma data é feriado.

        Args:
            check_date: Data a verificar

        Returns:
            FeriadoInfo se for feriado, None caso contrário
        """
        # 1. Verifica feriados oficiais
        official = self._get_official_holidays(check_date.year)
        if check_date in official:
            nome = official.get(check_date)
            return FeriadoInfo(
                data=check_date,
                nome=nome,
                tipo="NACIONAL",
                fonte="oficial",
                bloqueia_agendamento=True,
            )

        # 2. Verifica feriados customizados
        custom = self._get_customized_holidays(check_date, check_date)
        if custom:
            return custom[0]

        return None

    def is_blocked_for_scheduling(self, check_date: date) -> tuple[bool, Optional[str]]:
        """
        Verifica se a data está bloqueada para agendamento.

        Args:
            check_date: Data a verificar

        Returns:
            Tupla (bloqueado, motivo)
        """
        holiday = self.is_holiday(check_date)
        if holiday and holiday.bloqueia_agendamento:
            return True, holiday.nome
        return False, None

    def get_holidays_in_period(
        self,
        start_date: date,
        end_date: date,
        include_weekends: bool = False,
    ) -> list[FeriadoInfo]:
        """
        Lista todos os feriados em um período.

        Args:
            start_date: Data inicial
            end_date: Data final
            include_weekends: Se True, inclui sábados/domingos

        Returns:
            Lista de FeriadoInfo ordenada por data
        """
        holidays_dict: dict[date, FeriadoInfo] = {}

        # 1. Feriados oficiais
        for year in range(start_date.year, end_date.year + 1):
            official = self._get_official_holidays(year)
            for d, nome in official.items():
                if start_date <= d <= end_date:
                    holidays_dict[d] = FeriadoInfo(
                        data=d,
                        nome=nome,
                        tipo="NACIONAL",
                        fonte="oficial",
                        bloqueia_agendamento=True,
                    )

        # 2. Feriados customizados (sobrescreve oficiais se houver conflito)
        custom = self._get_customized_holidays(start_date, end_date)
        for f in custom:
            holidays_dict[f.data] = f

        # 3. Finais de semana (opcional)
        if include_weekends:
            current = start_date
            while current <= end_date:
                if current.weekday() in (5, 6):  # Sáb, Dom
                    if current not in holidays_dict:
                        day_name = "Sábado" if current.weekday() == 5 else "Domingo"
                        holidays_dict[current] = FeriadoInfo(
                            data=current,
                            nome=day_name,
                            tipo="FIM_DE_SEMANA",
                            fonte="sistema",
                            bloqueia_agendamento=True,
                        )
                current += timedelta(days=1)

        # Ordena por data
        return sorted(holidays_dict.values(), key=lambda x: x.data)

    def get_holidays_in_month(
        self,
        year: int,
        month: int,
        include_weekends: bool = False,
    ) -> list[FeriadoInfo]:
        """
        Lista feriados de um mês específico.

        Args:
            year: Ano
            month: Mês (1-12)
            include_weekends: Se True, inclui sábados/domingos

        Returns:
            Lista de FeriadoInfo do mês
        """
        start = date(year, month, 1)

        # Último dia do mês
        if month == 12:
            end = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end = date(year, month + 1, 1) - timedelta(days=1)

        return self.get_holidays_in_period(start, end, include_weekends)

    def get_next_business_day(self, from_date: date) -> date:
        """
        Retorna o próximo dia útil a partir de uma data.

        Args:
            from_date: Data de referência

        Returns:
            Próximo dia útil
        """
        check = from_date
        max_iterations = 30  # Segurança

        for _ in range(max_iterations):
            # Pula fins de semana
            if check.weekday() in (5, 6):
                check += timedelta(days=1)
                continue

            # Verifica feriado
            if self.is_holiday(check):
                check += timedelta(days=1)
                continue

            return check

        # Fallback (não deveria acontecer)
        return from_date

    def count_business_days(self, start_date: date, end_date: date) -> int:
        """
        Conta dias úteis entre duas datas.

        Args:
            start_date: Data inicial (inclusive)
            end_date: Data final (inclusive)

        Returns:
            Número de dias úteis
        """
        if start_date > end_date:
            return 0

        count = 0
        current = start_date
        while current <= end_date:
            is_weekend = current.weekday() in (5, 6)
            is_holiday = self.is_holiday(current) is not None

            if not is_weekend and not is_holiday:
                count += 1

            current += timedelta(days=1)

        return count


# Instância global para uso simplificado
holidays_service = BrazilianHolidaysService()


# Funções de conveniência
def is_holiday(check_date: date) -> Optional[FeriadoInfo]:
    """Verifica se uma data é feriado."""
    return holidays_service.is_holiday(check_date)


def is_blocked_for_scheduling(check_date: date) -> tuple[bool, Optional[str]]:
    """Verifica se data está bloqueada para agendamento."""
    return holidays_service.is_blocked_for_scheduling(check_date)


def get_holidays_in_month(
    year: int, month: int, include_weekends: bool = False
) -> list[FeriadoInfo]:
    """Lista feriados do mês."""
    return holidays_service.get_holidays_in_month(year, month, include_weekends)
