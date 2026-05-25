# Guia para IAs na Migracao GCO

## Objetivo

Este guia define como agentes de IA devem trabalhar na migracao do legado
`CMI-PCG-SERVER` e `CMI-PCG-FRONTEND` para o GCO V2.

## Antes de editar

1. Leia `docs/SDD_MIGRACAO_SUPERSERVIDOR_GCO.md`.
2. Leia `docs/ARQUITETURA_GCO_SUPERSERVIDOR.md`.
3. Leia `docs/MAPA_MODULOS_GCO.md`.
4. Inspecione apenas os arquivos legados do dominio solicitado.
5. Confirme quais contratos ja existem na V2.

## Regras de implementacao

- Nao copie controllers Flask.
- Nao copie componentes Vite inteiros sem adaptar ao App Router.
- Nao preserve nomes CMI.
- Nao criar compatibilidade artificial com endpoint legado.
- Criar modelos e migrations novos.
- Criar schemas Pydantic por caso de uso.
- Criar services pequenos e testaveis.
- Criar permissao para cada acao sensivel.
- Criar testes para regra de negocio.
- Atualizar documentacao quando contrato mudar.

## Checklist white-label

Buscar antes de concluir uma fase:

```bash
rg -n "CMI|Centro Medico|Centro Médico|logo_cmi|cmi_" backend frontend docs
```

Referencias permitidas:

- documentos que falam explicitamente do legado;
- changelog historico;
- nomes de pastas legadas ainda presentes no repositorio.

Referencias proibidas na V2:

- UI final;
- PDF final;
- variaveis de ambiente novas;
- storage keys;
- classes CSS;
- nomes de servicos Docker.

## Padrao de resposta final

Toda rodada deve listar:

- fase/tarefas implementadas;
- arquivos principais alterados;
- comandos de validacao;
- pendencias e riscos.

