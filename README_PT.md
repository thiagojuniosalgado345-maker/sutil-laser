# Sútil Laser — loja e painel

Site estático para GitHub Pages, sem Supabase e sem banco externo. O catálogo é um arquivo JSON no próprio repositório; as fotos adicionadas pelo painel são salvas na pasta `uploads/`.

## Publicar
Abra **Settings → Pages**, selecione **Deploy from a branch**, branch `main`, pasta `/(root)` e salve. Endereço esperado: https://thiagojuniosalgado345-maker.github.io/sutil-laser/ após a publicação.

## Painel
Abra `/admin.html`. Crie um Fine-grained personal access token no GitHub, selecione apenas o repositório `sutil-laser` e conceda **Contents: Read and write**. Use validade curta e não compartilhe. O token fica somente na memória da aba do navegador. O painel permite adicionar, editar, ocultar e excluir produtos; enviar foto em JPG/PNG/WEBP (convertida para WebP) e atualizar preço e descrição. Cada atualização cria um commit no GitHub.

## Limites e cuidados
- Mesmo restrito ao repositório, o token é uma credencial de escrita entregue ao navegador enquanto a sessão está aberta. Uma extensão ou script comprometido poderia capturá-lo. Use dispositivo confiável, token de curta duração e revogue-o se houver suspeita. Uma solução de login administrativo mais forte exigiria backend/OAuth.
- Não há checkout, pagamento nem cálculo de frete. O visitante consulta a empresa pelo Instagram.
- A prévia é uma ilustração CSS 3D, não um modelo CAD exato nem prova de gravação.
- Os 11 produtos são exemplos iniciais de catálogo. Os valores e fotos de referência precisam ser validados e substituídos por material oficial antes da venda.
- O GitHub Pages pode levar alguns minutos para publicar commits novos.

Não salve tokens nem senhas no código ou nos arquivos do repositório.
