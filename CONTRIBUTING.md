# Contribuição

1. Descrever a tarefa com requisito, responsável e critério de aceitação.
2. Atualizar `main` com `git pull --ff-only`, sem trabalho local pendente.
3. Criar branch curta: `feat/checklist`, `fix/aviso-salvamento` ou `docs/requisitos`.
4. Fazer mudanças pequenas e executar `npm run check` e testes manuais pertinentes.
5. Abrir pull request, registrar evidências e solicitar revisão ao outro integrante.
6. Integrar após resolver apontamentos e combinar a publicação quando necessária.

Esse fluxo é proposto, não uma proteção de branch já configurada. Não usar force push em `main`.

## Critério de conclusão

- Critério de aceitação atendido e documentação coerente.
- Verificações aprovadas e testes não executados explicitados.
- Sem credenciais ou dados de participantes.
- Avisos de simulação preservados.
- Mudanças visuais verificadas por teclado e em tela estreita.
- Revisão da dupla conforme acordo de trabalho.

Código em `src/`, testes em `tests/`, documentação em `docs/`. Preservar o pacote de hospedagem. Preferir commits `feat:`, `fix:`, `docs:`, `test:` ou `chore:`. Decisões importantes ficam em `docs/decisions/`.

Usar dados fictícios em testes. Não adicionar matrículas, documentos pessoais ou respostas individuais do questionário. Resultados agregados dependem de revisão. Licença e atribuição de responsáveis exigem acordo da equipe.
