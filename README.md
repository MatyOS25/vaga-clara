# Vaga Clara

Revisa anúncios de emprego e aponta termos que podem discriminar por sexo, idade, cor, família, deficiência, religião ou origem. O texto fica no navegador.

- Rodar: `python -m http.server 8731` nesta pasta e abrir http://127.0.0.1:8731
- Testar: `npm test` ou `npm run cobertura` (requer Node 22+)
- Regras: `regras.js`. Para incluir um termo, adicione um teste em `analisar.test.js` e o padrão em minúsculas e sem acento.

As regras são fixas: podem apontar um uso legítimo e deixar passar outro problema. Não substituem orientação jurídica.
