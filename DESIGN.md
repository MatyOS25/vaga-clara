# DESIGN.md: Vaga Clara

## Produto
- **Quem usa:** quem procura emprego ou quer conferir um anúncio, no computador ou no celular.
- **Trabalho:** procurar vagas, revisar o texto de um anúncio e denunciar o que estiver errado.

## Direção
Reading this as: bancada de revisão para quem procura emprego, operate surface, linguagem de texto marcado à mão. V5 M2 D6.

- A marca-texto é o único gesto visual: aparece no nome, nos trechos do anúncio e no hover.
- As colunas seguem a ordem do trabalho: procurar, revisar, denunciar.
- Sem cards, sem sombras e sem faixa lateral. Separação com linha de 1px.

```design-tokens
fonts: Besley, Atkinson Hyperlegible
colors: #f1f2ee, #ffffff, #15181c, #525a63, #c9cdc6, #ffdf3d, #ffb3c1, #8a0f33, #5f4600
radii: 0, 2px
```

## Tipografia
- A fonte Besley (clarendon, a voz dos classificados) no nome, nos títulos e no anúncio.
- A fonte Atkinson Hyperlegible na interface, feita para leitura com baixa visão.

## Cor
- Amarelo `#ffdf3d`: marca-texto e trechos para revisar.
- Rosa `#ffb3c1` com sublinhado `#8a0f33`: trechos com risco legal. O sublinhado e o rótulo garantem que a diferença não dependa só da cor.
