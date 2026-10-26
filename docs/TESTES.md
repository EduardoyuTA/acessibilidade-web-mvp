# Testes e evidências

## Automatizados

Executar `npm run check`: compila, roda os quatro testes de hospedagem e executa três contratos básicos da interface. As verificações cobrem entrega de arquivos, fallback HTML, empacotamento, identidade AcessoClaro, rótulos estruturais, avisos dinâmicos e regras mínimas para telas pequenas.

Não cobrem a interação completa do React, segurança de rede, precisão da análise nem conformidade com as WCAG. Os testes automatizados não substituem verificações manuais com teclado, leitor de tela, ampliação de 200% e participantes reais.

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

Em `start`, `save()` antecede `go('results')`, que limpa avisos; a mensagem de falha ao salvar pode desaparecer. É um achado de inspeção estática a reproduzir e corrigir. Impressão, leitor de tela, contraste e todas as transições precisam de validação documentada. Futuras verificações reais exigem páginas de teste controladas.
