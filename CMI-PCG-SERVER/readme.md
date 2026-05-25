# Sistema de Gerenciamento Clínico - CMI-PCG-SERVER
Este é um sistema backend para gerenciamento de clínicas médicas, desenvolvido com Flask e PostgreSQL, utilizando uma arquitetura moderna com dataclasses e blueprints.

## Visão Geral do Projeto
O sistema gerencia as principais operações de uma clínica médica, incluindo:

Cadastro de pacientes e empresas conveniadas

- Agendamento de consultas

- Registro de pagamentos

- Catálogo de exames disponíveis

A aplicação é containerizada com Docker e utiliza PostgreSQL como banco de dados.

## Estrutura do Projeto
```
CMI-PCG-SERVER/
├── app.py                # Ponto de entrada principal da aplicação
├── blueprints.py         # Centraliza todas as blueprints do projeto
├── database.py           # Configuração do banco de dados
├── Dockerfile            # Configuração do Docker para a aplicação
├── docker-compose.yml    # Configuração do Docker Compose
├── entrypoint.sh         # Script de entrada para o container
├── make-db-backup.sh     # Script para backup do banco de dados
├── migrations/           # Migrações de banco de dados
├── model/                # Modelos de dados (dataclasses)
│   ├── appointments_model.py
│   ├── companies_model.py
│   ├── exams_model.py
│   ├── patients_model.py
│   └── payments_model.py
├── control/              # Controllers (blueprints)
│   ├── appointments_controller.py
│   ├── companies_controller.py
│   ├── exams_controller.py
│   ├── patients_controller.py
│   └── payments_controller.py
├── config/               # Configurações de ambiente
├── db-backup/            # Backups do banco de dados
├── requirements.txt      # Dependências do Python
└── view/                 # Frontend (não implementado neste projeto)
```
## Tecnologias Utilizadas
**Backend**: Python 3.12

**Framework**: Flask

**ORM**: SQLAlchemy

**Banco de Dados**: PostgreSQL

**Containerização**: Docker

**Serialização**: Dataclasses nativas do Python

## Endpoints da API
### Pacientes
```
GET /pacientes - Lista todos os pacientes
```
```
GET /pacientes/<id> - Obtém detalhes de um paciente
```
```
POST /pacientes - Cria um novo paciente
```
### Empresas
```
GET /empresas - Lista todas as empresas
```
```
GET /empresas/<id> - Obtém detalhes de uma empresa
```
```
POST /empresas - Cria uma nova empresa
```
### Pagamentos
```
GET /pagamentos - Lista todos os pagamentos
```
```
GET /pagamentos/<id> - Obtém detalhes de um pagamento
```
```
POST /pagamentos - Cria um novo pagamento
```
### Exames
```
GET /exames - Lista todos os exames
```
```
GET /exames/<id> - Obtém detalhes de um exame
```
```
POST /exames - Cria um novo exame
```
### Agendamentos
```
GET /agendamentos - Lista todos os agendamentos
```
```
GET /agendamentos/<id> - Obtém detalhes de um agendamento
```
```
POST /agendamentos - Cria um novo agendamento
```
## Como Executar o Projeto
### Pré-requisitos
- Docker

- Docker Compose

## Passos para Execução
Clone o repositório:

```
git clone https://github.com/seu-usuario/CMI-PCG-SERVER.git
cd CMI-PCG-SERVER
```

Crie um arquivo .env na pasta config com as seguintes variáveis:

```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=sua_senha_segura
POSTGRES_DB=clinicacmi
POSTGRES_HOST=db
POSTGRES_PORT=5432
```
Construa e inicie os containers:
```
docker-compose up --build
```
A aplicação estará disponível em: http://localhost:5000

## Backup do Banco de Dados
Para criar um backup do banco de dados, execute:

```
./make-db-backup.sh
```
Os backups serão salvos no diretório db-backup/.

## Características Técnicas
### Arquitetura
- Blueprints: Organização modular dos endpoints

- Dataclasses: Serialização automática de modelos

- PostgreSQL: Banco de dados relacional robusto

- Docker: Ambiente de execução consistente

## Padrões de Projeto
- MVC (Model-View-Controller): Separação clara de responsabilidades

- DRY (Don't Repeat Yourself): Reutilização de código através de serialização automática

- KISS (Keep It Simple): Implementação direta e eficiente

## Exemplos de Uso
### Criar um paciente
```
curl -X POST http://localhost:5000/pacientes \
  -H "Content-Type: application/json" \
  -d '{
        "nome": "João Silva",
        "cpf": 12345678900,
        "data_nascimento": "1980-05-15",
        "email": "joao@example.com",
        "numero_de_contato": 11999999999,
        "vinculado_a_empresa": true,
        "cnpj": 12345678000199
      }'
```

### Listar agendamentos
```
curl http://localhost:5000/agendamentos
Criar um pagamento
bash
curl -X POST http://localhost:5000/pagamentos \
  -H "Content-Type: application/json" \
  -d '{
        "tipo": "Cartão de Crédito",
        "valor": 250.00,
        "data": "2023-05-30",
        "paciente_id": 1
      }'
```
## Contribuição
Contribuições são bem-vindas! Siga estes passos:

- Faça um fork do projeto

- Crie uma branch para sua feature (git checkout -b feature/nova-feature)

- Faça commit das suas alterações (git commit -am 'Adiciona nova feature')

- Faça push para a branch (git push origin feature/nova-feature)

- Abra um Pull Request

## Licença
Este projeto está licenciado sob a Licença MIT - veja o arquivo LICENSE para detalhes.