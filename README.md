# Vaga Clara

Procura vagas nos sites de emprego e revisa anúncios, apontando termos que podem discriminar por sexo, idade, cor, família, deficiência, religião ou origem. O texto fica no navegador.

- Rodar: `python -m http.server 8731` nesta pasta e abrir http://127.0.0.1:8731
- Testar: `npm test` ou `npm run cobertura` (requer Node 22+)
- Regras: `regras.js`. Para incluir um termo, adicione um teste em `analisar.test.js` e o padrão em minúsculas e sem acento.
- Relatório: o botão "Copiar relatório" monta um resumo em texto da revisão, pronto para colar em e-mail ou documento.
- Procurar vagas: abre a busca nos próprios sites de emprego, com cargo e cidade. Não há cópia de vagas para dentro do site: a Gupy, por exemplo, proíbe agregar vagas nos termos de uso.
- Anúncios para conferir: abre buscas no Google, no último mês, por termos que o revisor detecta. Aparecer na busca não prova discriminação.
- Denunciar: "Copiar texto da denúncia" gera o texto com o anúncio, os trechos e as bases legais para os canais oficiais (MPT, Disque 100). Revise antes de enviar.

As regras são fixas: podem apontar um uso legítimo e deixar passar outro problema. Não substituem orientação jurídica.

## Plataforma

O site continua estático; os dados ficam no Supabase.

- `supabase/migrations/`: tabelas, permissões e funções. Denúncias entram só pelo servidor e viram públicas só depois da moderação. O mural não mostra empresa nem link.
- `supabase/functions/`: `vagas` consulta a Adzuna sem expor a chave; `denunciar` valida, remove dados pessoais e aplica limite por IP.
- `servidor/`: a lógica dessas funções, testada sem rede. `servidor/banco.test.js` testa as permissões em um Postgres real (PGlite).
- `moderacao.html`: fila de revisão, com login. Antes de aprovar, a moderação pode corrigir o texto que será publicado.
- `vendor/supabase.js`: cópia do cliente oficial (`@supabase/supabase-js`, licença MIT), servida daqui para a página com login não depender de código de terceiros. Para atualizar, troque a versão em `package.json` e copie `dist/umd/supabase.js`.

Para ativar: aplique a migração, publique as funções sem verificação de JWT, defina os segredos `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` e `LIMITE_SAL`, preencha `config.js`, desative novos cadastros no Supabase, ative MFA e cadastre o moderador na tabela `moderadores`.

Depois de publicar, confira em produção: com um `X-Forwarded-For` forjado, o limite por IP precisa continuar valendo; e `has_function_privilege('anon', 'public.moderar(uuid,text,text,text)', 'execute')` e `has_table_privilege('anon', 'public.denuncias', 'select')` precisam ser falsos.
