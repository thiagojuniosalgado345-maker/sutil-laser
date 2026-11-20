# Sútil Laser — catálogo e painel administrável

Projeto de vitrine digital para produtos personalizados. O site público é hospedado no GitHub Pages; produtos, identidade da loja, autenticação administrativa e fotos ficam em um projeto Supabase exclusivo.

O código foi separado em arquivos pequenos para facilitar manutenção e transferência:
- `index.html`: vitrine pública
- `assets/site.css` e `assets/site.js`: visual, catálogo e personalizador
- `admin.html`, `assets/admin.css` e `assets/admin.js`: painel privado
- `config.js`: conexão pública com o Supabase
- `supabase/SETUP.sql`: tabelas, políticas, armazenamento e catálogo inicial

## O que o site já faz

- Catálogo responsivo com busca e filtros por categoria.
- Produtos com fotos, descrição, preço ou indicação para consultar.
- Painel com login, cadastro, edição, publicação, ocultação e exclusão de produtos.
- Upload de fotos para o armazenamento Supabase.
- Produtos em destaque e ordenação da vitrine.
- Personalização visual sobre a foto do produto: texto, imagem de referência, fonte, cor ilustrativa, tamanho e altura.
- Identidade editável no painel: nome, iniciais/símbolo, logotipo, cor de destaque, frase, Instagram, WhatsApp e e-mail.
- Botão de contato: abre WhatsApp com a mensagem preenchida quando o número estiver cadastrado; sem WhatsApp, copia o resumo e abre o Instagram.

## Instalação inicial

### 1. Criar o backend da loja

1. Crie uma conta/projeto Supabase dedicado à Sútil Laser. O ideal é que a conta fique sob controle do proprietário da loja, não de um prestador temporário.
2. Abra **SQL Editor → New query**.
3. Copie todo o conteúdo de `supabase/SETUP.sql`, cole e execute.
4. O script cria as tabelas, políticas RLS, bucket de fotos e 11 registros iniciais de produtos. As fotos e os preços começam sem valor para não publicar imagens de marketplace nem preços antigos sem validação.

### 2. Criar o administrador

1. No Supabase, abra **Authentication → Users → Add user**.
2. Cadastre o e-mail e uma senha forte do proprietário.
3. Copie o UUID do usuário criado.
4. No SQL Editor, execute esta instrução, substituindo o UUID pelo valor real:

```sql
insert into public.user_roles (user_id, role)
values ('UUID-REAL-DO-USUARIO', 'admin')
on conflict (user_id) do update set role = 'admin';
```

Crie usuários individuais para pessoas que precisem administrar o catálogo. Não compartilhe a mesma senha entre várias pessoas.

### 3. Conectar o site ao Supabase

1. No Supabase, abra **Project Settings → API** (ou a área equivalente de API keys).
2. Copie a **Project URL** e a chave pública **publishable** (ou a chave antiga **anon**).
3. Abra o arquivo `config.js` no GitHub e substitua os dois textos de exemplo:

```js
window.SUPABASE_CONFIG = {
  url: "https://SEU-PROJETO.supabase.co",
  anonKey: "SUA_CHAVE_PUBLICA"
};
```

A chave publicável/anon é própria para uso no navegador, desde que as políticas RLS tenham sido instaladas corretamente. **Nunca** coloque a chave `service_role`, senha do banco ou qualquer segredo administrativo em `config.js`, HTML ou JavaScript público.

### 4. Publicar no GitHub Pages

No repositório, abra **Settings → Pages**:
- Source: **Deploy from a branch**
- Branch: **main**
- Folder: **/(root)**
- Salve.

O endereço padrão deste repositório será:
https://thiagojuniosalgado345-maker.github.io/sutil-laser/

A publicação pode levar alguns minutos após salvar as configurações ou fazer alterações.

### 5. Entrar e configurar a loja

Acesse `/admin.html` no domínio publicado e entre com o usuário administrador criado no Supabase.

No painel:
1. Abra **Dados da loja** e confirme nome, símbolo, logo, cor e canais de contato.
2. Abra **Produtos** e troque as imagens de demonstração por fotos próprias e autorizadas.
3. Confirme nome, categoria, descrição, preço, estoque/disponibilidade e opções aceitas para cada produto.
4. Oculte produtos que não estejam disponíveis.

## Segurança e privacidade

- O site público usa apenas a chave publishable/anon do Supabase e depende de RLS para separar acesso público de acesso administrativo.
- O painel exige login Supabase e verifica a função `admin` na tabela `user_roles`.
- Não existe cadastro público de administradores.
- As imagens do catálogo são públicas para que possam aparecer na vitrine; somente administradores autenticados podem enviar, alterar ou excluir arquivos.
- Não armazene dados de cartão, senhas ou documentos de clientes neste catálogo.
- Antes de colocar a loja em operação, verifique as políticas RLS no Supabase e mantenha os usuários administradores atualizados.

## Limites atuais — importante antes de vender como e-commerce

Este projeto é uma **vitrine com geração de contatos/orçamentos**, não um checkout completo. Ainda não inclui carrinho, pagamento online, cálculo de frete, controle de estoque, emissão fiscal, pedidos ou integração com transportadoras.

A personalização é uma **prévia de composição sobre a foto real**. Não é renderização 3D, prova técnica, CAD ou garantia de como a gravação ficará no material. O arquivo de logo escolhido no personalizador fica no dispositivo do visitante e precisa ser anexado pelo cliente na conversa de atendimento.

Os 11 produtos iniciais são um ponto de partida, não um catálogo comercial validado. Preços e fotos foram intencionalmente deixados para cadastro pelo proprietário. Não publique a loja comercialmente antes de preencher as fotos reais, preços e condições.

## Preparar para vender ou transferir o site

Para uma transferência profissional, o comprador deve receber controle de **todos** os ativos — não apenas uma cópia dos arquivos:

1. Combine a transferência do repositório GitHub para a conta/organização do comprador (ou transfira a propriedade da organização que controla o repositório). Depois, o comprador deve conferir e ativar o GitHub Pages na própria conta.
2. Transfira o controle administrativo do projeto Supabase ou, preferencialmente, crie o backend na organização do comprador, execute `supabase/SETUP.sql`, crie os administradores e atualize `config.js` com a URL e a chave pública do novo projeto.
3. Faça uma exportação/importação dos produtos e arquivos de imagem, ou recadastre-os pelo painel. Confirme se todas as fotos continuam acessíveis após a transferência.
4. Transfira o domínio e configure os DNS na conta do comprador, caso exista domínio próprio.
5. Atualize os dados de marca e contato no painel. Instagram, WhatsApp, e-mail e demais contas da empresa são ativos separados e precisam ser transferidos pelo proprietário.
6. Remova acessos de ex-prestadores e revogue chaves antigas depois de testar o novo ambiente.

A venda não deve depender de uma conta pessoal do desenvolvedor, de token GitHub particular ou de uma chave `service_role` embutida no site. Guarde também uma cópia de segurança do banco e das imagens no momento da entrega.

## Manutenção

- Textos e aparência: `index.html` e `assets/site.css`.
- Lógica do catálogo e personalizador: `assets/site.js`.
- Painel: `admin.html`, `assets/admin.css`, `assets/admin.js`.
- Configuração do backend: `config.js`.
- Estrutura e políticas do banco: `supabase/SETUP.sql`.

Antes de alterações comerciais, teste em celular e computador e confirme que o formulário de contato, as fotos, o login e as permissões funcionam no ambiente publicado.
