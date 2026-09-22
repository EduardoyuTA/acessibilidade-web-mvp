# Segurança

O protótipo não busca páginas externas. A validação de URL no cliente é ilustrativa, não proteção completa. Antes da análise real, implementar e testar bloqueio de redes internas/reservadas, resolução de destinos e redirecionamentos, isolamento do navegador e limites de tempo, tamanho e concorrência.

O localStorage não é um cofre. Não inserir credenciais, URLs com tokens ou dados sensíveis em observações. Definir acesso e retenção antes de persistência remota.

Relatar vulnerabilidades ao mantenedor por canal privado acordado. Se o reporte privado estiver disponível na aba Security, ele pode ser utilizado; sua ativação não é pressuposta aqui. Não publicar segredos ou detalhes sensíveis em issues.

Se uma credencial vazar, revogá-la/rotacioná-la com o responsável: excluir o arquivo não remove o segredo do histórico.
