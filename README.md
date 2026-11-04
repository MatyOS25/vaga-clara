# Vaga Clara

Revisa anúncios de emprego e aponta termos que podem discriminar por sexo, idade, cor, família, deficiência, religião ou origem. O texto fica no navegador.

- Rodar: `python -m http.server 8731` nesta pasta e abrir http://127.0.0.1:8731
- Testar: `npm test` ou `npm run cobertura` (requer Node 22+)
- Regras: `regras.js`. Para incluir um termo, adicione um teste em `analisar.test.js` e o padrão em minúsculas e sem acento.
- Relatório: o botão "Copiar relatório" monta um resumo em texto da revisão, pronto para colar em e-mail ou documento.
- Denunciar: "Copiar texto da denúncia" gera o texto pronto para os canais oficiais (MPT, Disque 100); "Procurar o anúncio na internet" abre uma busca com o trecho entre aspas para localizar a publicação.

As regras são fixas: podem apontar um uso legítimo e deixar passar outro problema. Não substituem orientação jurídica.
