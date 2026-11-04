import { analisar } from '../analisar.js'

const BASE = 'https://api.adzuna.com/v1/api/jobs/br/search'
const POR_PAGINA = 20
const PAGINA_MAXIMA = 20
const TERMO_MAXIMO = 100

const semHtml = (texto) => (typeof texto === 'string' ? texto.replace(/<[^>]*>/g, '').trim() : '')
const termo = (valor) => (typeof valor === 'string' ? valor.trim().slice(0, TERMO_MAXIMO) : '')

const paginaValida = (pagina) => {
  const numero = Number.parseInt(pagina, 10)
  return Number.isInteger(numero) && numero >= 1 ? Math.min(numero, PAGINA_MAXIMA) : 1
}

const linkSeguro = (link) => {
  try {
    return ['http:', 'https:'].includes(new URL(link).protocol) ? link : null
  } catch {
    return null
  }
}

// A fonte entrega só um trecho da descrição: a análise vale para esse trecho, não para o anúncio inteiro.
const paraVaga = (bruta) => {
  const trecho = semHtml(bruta.description)
  return {
    id: String(bruta.id),
    titulo: semHtml(bruta.title),
    empresa: semHtml(bruta.company?.display_name) || null,
    local: semHtml(bruta.location?.display_name) || null,
    trecho,
    link: linkSeguro(bruta.redirect_url),
    criada_em: bruta.created ?? null,
    salario_min: bruta.salary_min ?? null,
    salario_max: bruta.salary_max ?? null,
    achados: analisar(trecho).map(({ categoria, nivel, trecho: parte }) => ({ categoria, nivel, trecho: parte })),
  }
}

export async function buscarVagas(pedido, { appId, appKey, fetch: buscar = fetch }) {
  const cargo = termo(pedido?.cargo)
  if (!cargo) return { status: 400, erro: 'Digite o cargo ou a área que você procura.' }
  if (!appId || !appKey) return { status: 503, erro: 'A busca de vagas está indisponível no momento.' }

  const parametros = new URLSearchParams({ app_id: appId, app_key: appKey, results_per_page: String(POR_PAGINA), what: cargo })
  const cidade = termo(pedido?.cidade)
  if (cidade) parametros.set('where', cidade)

  try {
    const resposta = await buscar(`${BASE}/${paginaValida(pedido?.pagina)}?${parametros}`)
    if (!resposta.ok) return { status: 502, erro: 'A fonte de vagas não respondeu. Tente de novo em instantes.' }
    const corpo = await resposta.json()
    return { status: 200, dados: { total: corpo.count ?? 0, vagas: (corpo.results ?? []).map(paraVaga) } }
  } catch {
    return { status: 502, erro: 'A fonte de vagas não respondeu. Tente de novo em instantes.' }
  }
}
