# Plano de validação do MVP

## Testes de acessibilidade

1. Percorrer as quatro etapas apenas com Tab, Shift+Tab, Enter, Espaço e setas.
2. Verificar se o foco permanece visível e segue uma ordem lógica.
3. Testar com leitor de tela no Windows, preferencialmente NVDA.
4. Ampliar a página para 200% e confirmar que nenhuma informação ou ação é perdida.
5. Repetir o fluxo em largura de celular e conferir textos, botões, campos e etapas.

## Teste de usabilidade

Aplicar o teste com pelo menos cinco participantes que ainda não conheçam o fluxo. Cada participante deverá:

1. Iniciar uma avaliação de demonstração.
2. Interpretar pelo menos um achado automático.
3. Responder a dois itens da inspeção manual.
4. Abrir o relatório e explicar o resultado apresentado.

Registrar tempo aproximado, dúvidas, erros de percurso e comentários. Não coletar informações pessoais desnecessárias. O resultado deve ser descrito como teste do protótipo, separado do questionário anterior sobre aceitação da proposta.

## Análise automática real

A integração com axe-core depende de um serviço de back-end capaz de abrir páginas em um navegador controlado. Antes da implementação, a equipe precisa definir a hospedagem desse serviço e aplicar proteções contra acesso a endereços privados, redirecionamentos perigosos, excesso de tempo e páginas muito grandes.

O site atualmente publicado entrega apenas arquivos estáticos. Portanto, adicionar axe-core ao front-end não seria suficiente e criaria uma falsa impressão de análise real.
