# Mapa de Modulos GCO

Este mapa liga funcionalidades legadas aos modulos novos. O objetivo e orientar
IAs e pessoas durante a migracao sem copiar a arquitetura antiga.

## identity

Legado:

- `CMI-PCG-SERVER/app/control/auth_controller.py`
- `CMI-PCG-SERVER/app/src/auth/*`
- `CMI-PCG-SERVER/app/models/auth/*`

V2:

- usuarios;
- papeis;
- permissoes;
- login;
- refresh;
- logout;
- troca de senha;
- auditoria de acesso.

## tenant

Legado:

- `clinic_infos_model.py`
- variaveis `CLINIC_NAME`;
- logos e textos nos templates.

V2:

- perfil da clinica;
- branding;
- tema;
- parametros operacionais;
- dados usados em PDFs.

## patients

Legado:

- `patients_controller.py`
- `patients_model.py`
- `features/pacientes/*`

V2:

- cadastro de paciente;
- busca por CPF/nome;
- endereco;
- contatos;
- vinculos com empresa e convenio;
- ficha e historico resumido.

## professionals

Legado:

- `doctors_controller.py`
- `social_workers_controller.py`
- `doctors_model.py`
- `nurses_model.py`
- `attendants_model.py`
- `social_workers_model.py`

V2:

- medicos;
- enfermeiros;
- atendentes;
- assistentes sociais;
- conselhos profissionais;
- agenda/performance.

## companies

Legado:

- `companies_controller.py`
- `company_sectors_controller.py`
- `company_positions_controller.py`
- `employee_bonds_controller.py`
- `features/empresas/*`

V2:

- empresas;
- setores;
- cargos;
- riscos;
- exames obrigatorios;
- vinculos trabalhador-empresa.

## appointments e calls

Legado:

- `appointments_controller.py`
- `appointment_receipt_pdf_controller.py`
- sistema de chamadas ja migrado nas fases anteriores.

V2:

- agenda;
- import CSV;
- disponibilidade por feriados;
- comparecimento;
- comprovante;
- chamada para painel de TV.

## clinical_records

Legado:

- `medical_appointments_controller.py`
- `medical_records_controller.py`
- `medical_records_pdf_controller.py`
- `features/consultas/*`

V2:

- consulta;
- anamnese;
- conduta;
- hipotese diagnostica;
- prontuario;
- PDF do prontuario.

## occupational_health

Legado:

- `aso_controller.py`
- `aso_questionario_controller.py`
- `aso_questionario_pdf_controller.py`
- `risks_model.py`
- `features/aso/*`

V2:

- ASO;
- questionarios;
- riscos ocupacionais;
- exames periodicos;
- conclusao de aptidao;
- relatorios NR-7.

## exams

Legado:

- `exams_controller.py`
- `clinic_exams_controller.py`
- `exam_request_controller.py`
- `utils_scripts/importar_exames_xlsx.py`
- `features/exames/*`

V2:

- catalogo de exames;
- precificacao;
- import/export;
- solicitacao de exames;
- PDF de solicitacao.

## prescriptions

Legado:

- `prescriptions_controller.py`
- `prescriptions_pdf_controller.py`
- `prescription_service.py`
- `features/receituarios/*`

V2:

- receituarios;
- itens;
- orientacoes;
- PDF;
- integracao opcional com estoque.

## finance e billing

Legado:

- `payments_controller.py`
- `expenses_controller.py`
- `financial_controller.py`
- `financial_analytics_controller.py`
- `company_billing_controller.py`
- `company_billing_pdf_controller.py`
- `features/financeiro/*`

V2:

- pagamentos;
- despesas;
- DRE;
- analytics;
- relatorios financeiros;
- faturamento posterior;
- recibos.

## inventory

Legado:

- `suppliers_controller.py`
- `medications_controller.py`
- `stock_controller.py`
- `stock_service.py`
- `features/farmacia/*`

V2:

- fornecedores;
- medicamentos;
- lotes;
- entrada;
- ajuste;
- descarte;
- dispensacao;
- alertas.

## documents e reports

Legado:

- `templates/*`
- `base_pdf_report.py`
- `reports_async_controller.py`
- `reports_tasks.py`
- `documentos_livres_controller.py`

V2:

- geracao de PDF;
- documentos livres;
- jobs de exportacao;
- armazenamento temporario;
- historico de documentos gerados.

## integrations

Legado:

- `cep_controller.py`
- `nfse_import_controller.py`
- `nfse_pdf_parser.py`
- `nfse_reconciliation.py`
- `google_forms_webhook.py`
- `discord_webhook.py`

V2:

- CEP com providers;
- NFS-e por provider;
- webhooks configuraveis;
- notificacoes externas.

