# Como publicar o Vaga Clara

Tudo abaixo usa planos gratuitos. O site fica na Cloudflare e os dados, no Supabase.

## Por que não usar só o GitHub Pages

As regras do GitHub Pages proíbem enviar dados sensíveis, como senhas. A página de moderação tem login, então o site com backend fica na Cloudflare. O Currículo Justo não tem login e pode continuar no GitHub Pages.

## 1. Banco de dados (Supabase)

1. Crie uma organização nova e gratuita em https://supabase.com/dashboard e um projeto nela, na região de São Paulo.
2. Aplique `supabase/migrations/001_plataforma.sql`.
3. Em Authentication, desative novos cadastros e crie a conta de moderação, com MFA.
4. Cadastre essa conta em `public.moderadores`.

## 2. Funções do servidor

1. Crie a chave em https://developer.adzuna.com.
2. No painel do Supabase, defina os segredos `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `LIMITE_SAL` (um texto aleatório) e `ORIGENS_EXTRAS` (o endereço do site na Cloudflare).
3. Gere os pacotes com `npm run empacotar` e publique `dist-funcoes/vagas` e `dist-funcoes/denunciar` sem verificação de JWT.

## 3. Site (Cloudflare)

1. Preencha `config.js` com o endereço e a chave pública do Supabase.
2. Rode `npm run preparar`, que monta a pasta `publico/` só com os arquivos do site.
3. Rode `npx wrangler login` e depois `npx wrangler deploy`.
4. O site fica em um endereço `vaga-clara.<sua-conta>.workers.dev`.

## 4. Conferência

- Com um `X-Forwarded-For` forjado, o limite por IP precisa continuar valendo.
- `has_function_privilege('anon', 'public.moderar(uuid,text,text,text)', 'execute')` e `has_table_privilege('anon', 'public.denuncias', 'select')` precisam ser falsos.

## Limites do plano gratuito

- **Supabase:** projeto pausa depois de 1 semana sem atividade. Se pausar, a busca e o mural param, mas a revisão e os links de busca continuam funcionando. Reative pelo painel antes de uma apresentação.
- **Cloudflare:** arquivos estáticos não têm limite de pedidos.
- **Adzuna:** a chave gratuita é para avaliação. Cada vaga exibida precisa do selo da Adzuna.
