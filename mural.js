import { CONFIG } from './config.js'
import { criarPlataforma } from './plataforma.js'
import { analisar, segmentar } from './analisar.js'
import { CATEGORIAS } from './relatorio.js'

const api = criarPlataforma(CONFIG)
const aviso = document.querySelector('#mural-aviso')

const elemento = (tag, propriedades = {}) => Object.assign(document.createElement(tag), propriedades)

const criarTexto = (texto) => {
  const paragrafo = elemento('p', { className: 'anuncio-mural' })
  paragrafo.append(
    ...segmentar(texto, analisar(texto)).map(({ texto: parte, achado }) =>
      achado ? elemento('mark', { className: achado.nivel, textContent: parte }) : document.createTextNode(parte),
    ),
  )
  return paragrafo
}

const criarItem = ({ criado_em: criadoEm, cidade, texto_anuncio: texto }) => {
  const item = elemento('li')
  const data = new Date(criadoEm).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  item.append(elemento('p', { className: 'meta-mural', textContent: cidade ? `${data}, ${cidade}` : data }), criarTexto(texto))
  return item
}

const mostrarEstatisticas = ({ total, por_categoria: porCategoria }) => {
  if (!total) return
  document.querySelector('#estatisticas').hidden = false
  document.querySelector('#total').textContent = total === 1 ? '1 denúncia aprovada até agora.' : `${total} denúncias aprovadas até agora.`
  document.querySelector('#categorias').replaceChildren(
    ...Object.entries(porCategoria)
      .sort(([, a], [, b]) => b - a)
      .map(([categoria, quantidade]) => elemento('li', { textContent: `${CATEGORIAS[categoria] ?? categoria}: ${quantidade}` })),
  )
}

const carregar = async () => {
  const [mural, estatisticas] = await Promise.all([api.carregarMural(), api.carregarEstatisticas()])
  if (mural.erro) {
    aviso.textContent = mural.erro
    return
  }
  if (estatisticas.dados) mostrarEstatisticas(estatisticas.dados)
  aviso.textContent = mural.dados.length === 0 ? 'Nenhuma denúncia foi aprovada ainda.' : ''
  document.querySelector('#mural').replaceChildren(...mural.dados.map(criarItem))
}

carregar()
