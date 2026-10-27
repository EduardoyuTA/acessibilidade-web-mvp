# Segurança

O modo demonstrativo não busca páginas externas. A API real valida protocolo, credenciais, porta e resolução DNS; bloqueia redes internas/reservadas e intercepta os destinos requisitados pelo navegador. Há limites de corpo, tempo e concorrência. Esses controles reduzem risco de SSRF, mas a implantação também deve isolar o serviço e restringir sua rede de saída sempre que a plataforma permitir.

O localStorage não é um cofre. Não inserir credenciais, URLs com tokens ou dados sensíveis em observações. Definir acesso e retenção antes de persistência remota.

Relatar vulnerabilidades ao mantenedor por canal privado acordado. Se o reporte privado estiver disponível na aba Security, ele pode ser utilizado; sua ativação não é pressuposta aqui. Não publicar segredos ou detalhes sensíveis em issues.

Se uma credencial vazar, revogá-la/rotacioná-la com o responsável: excluir o arquivo não remove o segredo do histórico.
