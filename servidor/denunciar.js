import { analisar } from '../analisar.js'
import { anonimizar } from './anonimizar.js'

const TEXTO_MINIMO = 20
const TEXTO_MAXIMO = 10000
const LINK_MAXIMO = 500
const EMPRESA_MAXIMA = 200
const CIDADE_MAXIMA = 120

const textoCurto = (valor, maximo) => (typeof valor === 'string' && valor.trim() ? valor.trim().slice(0, maximo) : null)

const linkValido = (link) => {
  if (link.length > LINK_MAXIMO) return false
  try {
    return ['http:', 'https:'].includes(new URL(link).protocol)
  } catch {
    return false
  }
}

const dataValida = (data, agora) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false
  const convertida = new Date(`${data}T00:00:00Z`)
  return !Number.isNaN(convertida.getTime()) && convertida.toISOString().startsWith(data) && convertida <= agora
}

// Tudo que vem do navegador é refeito aqui: só estes campos chegam ao banco.
export function prepararDenuncia(entrada, agora = new Date()) {
  const dados = entrada && typeof entrada === 'object' ? entrada : {}
  if (dados.site_web) return { robo: true, erros: {}, linha: null }

  const bruto = typeof dados.texto === 'string' ? dados.texto.normalize('NFC').trim() : ''
  // O tamanho vem antes da análise: texto enorme não pode custar processamento.
  if (bruto.length < TEXTO_MINIMO || bruto.length > TEXTO_MAXIMO) {
    return { erros: { texto: `Cole o anúncio com ${TEXTO_MINIMO} a ${TEXTO_MAXIMO} caracteres.` }, linha: null }
  }
  const empresa = textoCurto(dados.empresa, EMPRESA_MAXIMA)
  const cidade = textoCurto(dados.cidade, CIDADE_MAXIMA)
  const texto = anonimizar(bruto, { empresa })
  const achados = analisar(texto).map(({ categoria, nivel, trecho }) => ({ categoria, nivel, trecho }))
  const link = textoCurto(dados.link, LINK_MAXIMO + 1)
  const dataVista = textoCurto(dados.dataVista, 10)

  const erros = {
    ...(achados.length === 0 ? { texto: 'A revisão não apontou nenhum trecho neste anúncio.' } : {}),
    ...(link && !linkValido(link) ? { link: 'Informe o endereço completo, começando com https://.' } : {}),
    ...(dataVista && !dataValida(dataVista, agora) ? { dataVista: 'Informe uma data válida, que não esteja no futuro.' } : {}),
  }
  if (Object.keys(erros).length > 0) return { erros, linha: null }

  return {
    erros,
    linha: {
      texto_anuncio: texto,
      empresa,
      cidade: cidade && anonimizar(cidade),
      link,
      data_vista: dataVista,
      achados,
    },
  }
}
