# Editor de Links Úteis

As páginas filhas de `/app/links-uteis` usam uma grade compartilhada de 12 colunas. O menu contextual à esquerda é montado somente com destinos autorizados pelo catálogo de páginas.

## Uso

- Usuários autorizados consultam o conteúdo em modo somente leitura.
- `admin` e `master` podem adicionar, editar, mover e redimensionar cards.
- O botão **Aplicar ao rascunho** valida o card localmente; **Salvar alterações** publica a revisão compartilhada da página.
- Um conflito de revisão não sobrescreve o trabalho de outra pessoa: o editor preserva o rascunho e exige recarregar a versão atual.
- Em **Grupos WhatsApp**, o card de organograma aceita integrantes, cargo, liderança, telefone e link. A liderança define a relação vertical; integrantes sob a mesma liderança aparecem lateralmente.

## Persistência e autorização

O conteúdo estático versionado é a contingência de leitura antes da primeira gravação ou quando a consulta compartilhada falha. A persistência usa `public.useful_links_documents` somente pelas RPCs autenticadas `get_useful_links_document` e `save_useful_links_document`.

A tabela não concede acesso direto a `anon`, `authenticated` ou `service_role`. As RPCs exigem MFA, usuário ativo e permissão específica da página. Gravações também exigem papel `admin` ou `master`, documento estritamente validado e revisão otimista correspondente.

## Validação

Validar o schema TypeScript, a API, o canvas, a navegação contextual e o contrato pgTAP em `supabase/tests/useful_links_documents.test.sql`. Depois da publicação, conferir sidebar, leitura e edição autenticadas, persistência após recarregar, temas, celular e proteção anônima.
