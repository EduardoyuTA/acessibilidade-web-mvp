# ADR 001 - Distinguir protótipo e análise real

Estado: documenta a implementação existente. Data: 21/09/2026.

## Contexto

A interface demonstra a experiência de uso antes da integração do motor de análise.

## Decisão

Manter exemplos explicitamente fictícios, não acessar a URL informada e salvar demonstrações localmente. Separar publicação do front-end da implementação futura da API.

## Consequências

É possível apresentar o fluxo, mas não medir precisão dos achados ou certificar páginas. Motor, persistência e acesso exigirão decisões e testes próprios. O seletor de cenários deve permanecer restrito à demonstração quando houver análise real.
