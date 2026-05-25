-- Ajusta a sequência da tabela agendamentos
SELECT setval('agendamentos_id_seq', (SELECT MAX(id) FROM agendamentos));

-- Ajusta a sequência da tabela atendentes
SELECT setval('atendentes_id_seq', (SELECT MAX(id) FROM atendentes));

-- Ajusta a sequência da tabela autenticadores
SELECT setval('autenticadores_id_seq', (SELECT MAX(id) FROM autenticadores));

-- Ajusta a sequência da tabela consultas
SELECT setval('consultas_id_seq', (SELECT MAX(id) FROM consultas));

-- Ajusta a sequência da tabela convenios
SELECT setval('convenios_id_seq', (SELECT MAX(id) FROM convenios));

-- Ajusta a sequência da tabela empresas
SELECT setval('empresas_id_seq', (SELECT MAX(id) FROM empresas));

-- Ajusta a sequência da tabela enfermeiros
SELECT setval('enfermeiros_id_seq', (SELECT MAX(id) FROM enfermeiros));

-- Ajusta a sequência da tabela exames
SELECT setval('exames_id_seq', (SELECT MAX(id) FROM exames));

-- Ajusta a sequência da tabela exames_clinica
SELECT setval('exames_clinica_id_seq', (SELECT MAX(id) FROM exames_clinica));

-- Ajusta a sequência da tabela medicos
SELECT setval('medicos_id_seq', (SELECT MAX(id) FROM medicos));

-- Ajusta a sequência da tabela pacientes
SELECT setval('pacientes_id_seq', (SELECT MAX(id) FROM pacientes));

-- Ajusta a sequência da tabela pagamentos
SELECT setval('pagamentos_id_seq', (SELECT MAX(id) FROM pagamentos));

-- Ajusta a sequência da tabela procedimentos
SELECT setval('procedimentos_id_seq', (SELECT MAX(id) FROM procedimentos));

-- Ajusta a sequência da tabela riscos
SELECT setval('riscos_id_seq', (SELECT MAX(id) FROM riscos));

-- Ajusta a sequência da tabela solicitacoes_de_asos
SELECT setval('solicitacoes_de_asos_id_seq', (SELECT MAX(id) FROM solicitacoes_de_asos));

-- Ajusta a sequência da tabela solicitacoes_de_exames
SELECT setval('solicitacoes_de_exames_id_seq', (SELECT MAX(id) FROM solicitacoes_de_exames));
