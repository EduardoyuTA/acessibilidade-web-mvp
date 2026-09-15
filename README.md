# Protótipo — Acessibilidade Web

Protótipo acadêmico navegável do MVP. Não executa varreduras reais nem certifica acessibilidade.

## Executar

Com Node.js instalado, abra um terminal nesta pasta:

```powershell
npm.cmd install
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

Abra http://127.0.0.1:5173/. Para compilar: `npm.cmd run build`.

## Percurso

1. Informe uma URL pública completa e escolha um cenário simulado.
2. Consulte achados com impacto, regra, elemento, evidência e orientação.
3. Registre respostas e observações no checklist manual.
4. Consulte o relatório e use a impressão do navegador para salvar em PDF.
5. Reabra avaliações pelo Histórico.

Os registros ficam no armazenamento local deste navegador. Não há servidor de análise, conta, sincronização ou banco remoto. A validação de URL é ilustrativa e não substitui proteção de rede no backend. Não insira informações sensíveis.

## Verificação realizada

Compilação aprovada; testados no navegador: campo vazio, processamento simulado, resultados com achados, preenchimento de checklist, exibição no relatório e recuperação do histórico após recarregar. Mantido um registro de teste de example.com, explicitamente identificado como teste.

Pendentes: testes completos dos demais cenários, impressão em PDF, leitor de tela, auditoria de acessibilidade e refinamento visual comparativo. Consulte design-qa.md.
