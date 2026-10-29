# Testes e evidências

## Automatizados

Executar `npm run check`: compila, roda os quatro testes de hospedagem e executa a suíte de contrato e comportamento da interface (`tests/app-contract.test.mjs`). As verificações cobrem entrega de arquivos, fallback HTML, empacotamento, identidade AcessoClaro, rótulos estruturais, avisos dinâmicos, regras para telas pequenas, validação de URL (CT01), resolução de cenários e interrupções (CT02, CT06 e CT07), contagem do checklist e relatório parcial (CT03 e CT05), persistência e preservação de avisos de falha do `localStorage` (CT04 e CT09) e integração com a API (`Response.ok`).

Em `backend`, executar `npm test` valida saúde da API, CORS, bloqueio de SSRF/endereços privados/locais, portas e falhas de DNS, tratamento de JSON inválido e limite de concorrência (`429`).

Os testes automatizados não substituem verificações manuais com teclado, leitor de tela, ampliação de 200% e participantes reais.

## Roteiro manual

| Caso | Requisito | Procedimento | Esperado |
|---|---|---|---|
| CT01 | RF02 | Enviar URL vazia/inválida | Erro explicado, sem iniciar |
| CT02 | RF05 | Abrir cenário com achados | Detalhes e aviso de simulação |
| CT03 | RF06 | Responder, sair e reabrir checklist | Respostas e pendências preservadas |
| CT04 | RF07 | Recarregar e consultar histórico | Recuperar avaliação correta |
| CT05 | RF08 | Imprimir avaliação parcial | Relatório legível com limitações |
| CT06 | RF03/RF04 | Usar cenários de interrupção | Motivo e estado incompleto |
| CT07 | RF05 | Usar cenário sem achados | Não afirmar conformidade integral |
| CT08 | Qualidade | Usar teclado, zoom e tela estreita | Controles alcançáveis, conteúdo preservado |
| CT09 | RF07 | Simular armazenamento indisponível | Aviso persistente, sem falso salvamento |

Registrar revisão, data, navegador, ambiente, esperado, obtido, resultado e evidência. Uma execução anterior não aprova automaticamente uma nova versão.

## Pendências conhecidas

O aviso de falha ao salvar no `localStorage` durante `start` (CT09) e o uso da propriedade booleana `response.ok` na integração com a API foram corrigidos e cobertos por testes de regressão. Leitor de tela com participantes reais e páginas de teste controladas em produção permanecem no roteiro de validação.
