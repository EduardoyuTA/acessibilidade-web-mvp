# Backlog e metodologia

Este é um plano em arquivo, não um quadro GitHub Projects já criado. Responsáveis e prazos devem ser acordados pela dupla.

| Prioridade | Tarefa | Critério de conclusão |
|---|---|---|
| Concluído | Corrigir aviso de falha de armazenamento | CT09 e teste de regressão aprovados |
| Concluído | Verificar cenários e impressão | Evidências CT01-CT07 e testes automatizados aprovados |
| P1 | Avaliar acessibilidade da interface | Teclado, foco, contraste, zoom e axe-core verificados; leitor de tela manual pendente |
| P1 | Configurar testes de interface, lint e typecheck | Testes de contrato e comportamento em CI; lint/typecheck dedicados pendentes |
| Concluído | Modularizar App.tsx | Regras extraídas para `src/evaluation.mjs`, comportamento preservado e testes aprovados |
| P2 | Especificar API e segurança | Contratos e controles revisados |
| P2 | Implementar análise real | Achados verificáveis em páginas controladas e isolamento testado |
| P2 | Definir persistência | Decisão sobre histórico local/remoto e proteção de dados |
| P2 | Revisar UML/BPMN | Diagramas compatíveis com implementação |
| P2 | Avaliar com participantes | Procedimento aprovado e resultados agregados |

## Organização proposta

Kanban: A fazer → Em andamento → Revisão/testes → Concluído. Cada tarefa tem responsável, requisito e evidência. PDCA: planejar, implementar, verificar e corrigir/padronizar. A aplicação de qualidade, ITIL e COBIT precisa de evidências próprias; criar documentação não comprova aplicação integral.

O questionário mede aceitação percebida, não conformidade WCAG ou eficácia técnica; não substitui SUS. Não registrar resultados antes da coleta.

## Conclusão do MVP real

Exige análise efetivamente executada, resultados rastreáveis, falhas tratadas, revisão manual e relatório preservados, testes essenciais documentados e limitações explícitas. O protótipo atual ainda não satisfaz todo esse conjunto.
