import { REGRAS } from './regras.js'

const compilar = ({ padrao, ...regra }) => ({
  ...regra,
  regex: new RegExp(String.raw`(?<![\p{L}\p{N}])(?:${padrao.replaceAll(' ', String.raw`\s+`)})(?![\p{L}\p{N}])`, 'gu'),
})

const COMPILADAS = REGRAS.map(compilar)
const AFIRMATIVA = /(?<!nao\s+(e\s+)?(uma\s+)?)(vaga|acao|acoes|programa)\s+afirmativ/
const FIM_DE_FRASE = /[!?;]|[.](?![0-9])/g

// Sem acento e em minúsculas, mantendo o comprimento para as posições baterem com o original.
const dobrar = (texto) => Array.from({ length: texto.length }, (_, i) => texto[i].normalize('NFD')[0].toLowerCase()).join('')

const frase = (dobrado, inicio, fim) => {
  const fins = [...dobrado.matchAll(FIM_DE_FRASE)].map((m) => m.index)
  const antes = fins.findLast((posicao) => posicao < inicio) ?? -1
  const depois = fins.find((posicao) => posicao >= fim) ?? dobrado.length
  return dobrado.slice(antes + 1, depois)
}

const semSobreposicao = (achados) =>
  achados.reduce((aceitos, achado) => {
    const ultimo = aceitos.at(-1)
    return ultimo && achado.inicio < ultimo.fim ? aceitos : [...aceitos, achado]
  }, [])

export function analisar(entrada) {
  const texto = entrada.normalize('NFC')
  const dobrado = dobrar(texto)
  const achados = COMPILADAS.flatMap(({ regex, ...regra }) =>
    [...dobrado.matchAll(regex)].map((m) => ({
      categoria: regra.categoria,
      nivel: regra.nivel,
      motivo: regra.motivo,
      sugestao: regra.sugestao,
      base: regra.base,
      trecho: texto.slice(m.index, m.index + m[0].length),
      inicio: m.index,
      fim: m.index + m[0].length,
    })),
  )
    .filter((a) => a.categoria !== 'genero' || !AFIRMATIVA.test(frase(dobrado, a.inicio, a.fim)))
    .sort((a, b) => a.inicio - b.inicio || b.fim - a.fim)
  return semSobreposicao(achados)
}

export function segmentar(entrada, achados) {
  const texto = entrada.normalize('NFC')
  const { partes, cursor } = achados.reduce(
    ({ partes, cursor }, achado) => ({
      partes: [
        ...partes,
        ...(achado.inicio > cursor ? [{ texto: texto.slice(cursor, achado.inicio) }] : []),
        { texto: achado.trecho, achado },
      ],
      cursor: achado.fim,
    }),
    { partes: [], cursor: 0 },
  )
  return cursor < texto.length ? [...partes, { texto: texto.slice(cursor) }] : partes
}
