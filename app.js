import { analisar, segmentar } from './analisar.js'
import { montarRelatorio, montarDenuncia, resumir, CATEGORIAS, NIVEIS } from './relatorio.js'
import { linksDeVagas, linksDeAlerta } from './busca.js'
import { CONFIG } from './config.js'
import { criarPlataforma } from './plataforma.js'

const campo = document.querySelector('#anuncio')
const marcas = document.querySelector('#marcas')
const resumo = document.querySelector('#resumo')
const lista = document.querySelector('#lista')

const api = criarPlataforma(CONFIG)
const CHAVE = 'vaga-clara'
const armazenamento = {
  ler: () => {
    try {
      return localStorage.getItem(CHAVE)
    } catch {
      return null
    }
  },
  gravar: (texto) => {
    try {
      localStorage.setItem(CHAVE, texto)
    } catch {
      // Sem espaço ou permissão: a revisão segue sem guardar o texto.
    }
  },
}

const elemento = (tag, propriedades = {}) => Object.assign(document.createElement(tag), propriedades)

const criarMarca = ({ texto, achado }) =>
  achado ? elemento('mark', { className: achado.nivel, textContent: texto }) : document.createTextNode(texto)

const criarNota = (achado, indice) => {
  const botao = elemento('button', { type: 'button', className: 'nota' })
  botao.dataset.nivel = achado.nivel
  botao.append(
    elemento('span', { className: 'nivel', textContent: `${NIVEIS[achado.nivel]}: ${CATEGORIAS[achado.categoria]}` }),
    elemento('strong', { textContent: achado.trecho }),
    elemento('span', { textContent: `${achado.motivo} ${achado.sugestao}` }),
    ...(achado.base ? [elemento('span', { className: 'base', textContent: achado.base })] : []),
  )
  botao.addEventListener('click', () => {
    campo.focus()
    campo.setSelectionRange(achado.inicio, achado.fim)
    // A camada de marcas tem a mesma disposição do campo, então informa a altura do trecho.
    campo.scrollTop = marcas.querySelectorAll('mark')[indice].offsetTop - campo.clientHeight / 3
  })
  const item = elemento('li')
  item.append(botao)
  return item
}

const sincronizarRolagem = () => {
  marcas.scrollTop = campo.scrollTop
  marcas.scrollLeft = campo.scrollLeft
}

const atualizar = () => {
  const normalizado = campo.value.normalize('NFC')
  if (campo.value !== normalizado) {
    const cursor = campo.value.slice(0, campo.selectionStart).normalize('NFC').length
    campo.value = normalizado
    campo.setSelectionRange(cursor, cursor)
  }
  const achados = analisar(normalizado)
  // A quebra final mantém a altura igual à do campo quando o texto termina em linha vazia.
  marcas.replaceChildren(...segmentar(normalizado, achados).map(criarMarca), document.createTextNode('\n'))
  lista.replaceChildren(...achados.map(criarNota))
  const novoResumo = resumir(normalizado, achados)
  // Só troca quando muda, para o leitor de tela não repetir o aviso a cada tecla.
  if (resumo.textContent !== novoResumo) resumo.textContent = novoResumo
  armazenamento.gravar(normalizado)
  sincronizarRolagem()
}

campo.addEventListener('input', atualizar)
campo.addEventListener('scroll', sincronizarRolagem)

// Devolve um avisador que troca o texto do botão por um instante.
const criarAviso = (botao, rotulo) => {
  let espera
  return (texto) => {
    botao.textContent = texto
    clearTimeout(espera)
    espera = setTimeout(() => {
      botao.textContent = rotulo
    }, 2000)
  }
}

const avisoCopiar = criarAviso(document.querySelector('#copiar'), 'Copiar relatório')
const avisoDenuncia = criarAviso(document.querySelector('#copiar-denuncia'), 'Copiar texto da denúncia')

const copiarTexto = async (texto, avisar, sucesso) => {
  try {
    await navigator.clipboard.writeText(texto)
    avisar(sucesso)
  } catch {
    avisar('Não foi possível copiar')
  }
}

document.querySelector('#copiar').addEventListener('click', () =>
  copiarTexto(montarRelatorio(analisar(campo.value)), avisoCopiar, 'Relatório copiado!'),
)

document.querySelector('#copiar-denuncia').addEventListener('click', () => {
  const denuncia = montarDenuncia(analisar(campo.value), campo.value)
  if (!denuncia) return avisoDenuncia('Nenhum trecho apontado')
  return copiarTexto(denuncia, avisoDenuncia, 'Denúncia copiada!')
})

const avisoProcurar = criarAviso(document.querySelector('#procurar'), 'Procurar este anúncio no Google')

document.querySelector('#procurar').addEventListener('click', () => {
  const inicio = campo.value.trim().split(/\s+/).slice(0, 12).join(' ')
  if (!inicio) return avisoProcurar('Cole um anúncio primeiro')
  return window.open(`https://www.google.com/search?q=${encodeURIComponent(`"${inicio}"`)}`, '_blank', 'noopener')
})

const criarLinks = (links) =>
  links.map(({ nome, url }) => {
    const link = elemento('a', { href: url, target: '_blank', rel: 'noopener', textContent: nome })
    const item = elemento('li')
    item.append(link)
    return item
  })

const SITE_ADZUNA = 'https://www.adzuna.com.br'
const areaEncontradas = document.querySelector('#area-encontradas')
const estadoVagas = document.querySelector('#estado-vagas')
const listaVagas = document.querySelector('#vagas-encontradas')
const formDenuncia = document.querySelector('#form-denuncia')
const estadoDenuncia = document.querySelector('#estado-denuncia')

const revisarVaga = (vaga) => {
  campo.value = [vaga.titulo, vaga.trecho].filter(Boolean).join('\n\n')
  atualizar()
  formDenuncia.elements.empresa.value = vaga.empresa ?? ''
  formDenuncia.elements.cidade.value = vaga.local ?? ''
  formDenuncia.elements.link.value = vaga.link ?? ''
  campo.focus()
}

const criarVaga = (vaga) => {
  const item = elemento('li')
  const revisar = elemento('button', { type: 'button', className: 'discreto', textContent: 'Revisar este trecho' })
  revisar.addEventListener('click', () => revisarVaga(vaga))
  const proibidas = vaga.achados.filter((a) => a.nivel === 'proibida').length
  const alerta = vaga.achados.length
    ? [elemento('p', {
        className: proibidas ? 'alerta-vaga proibida' : 'alerta-vaga atencao',
        textContent: vaga.achados.length === 1 ? '1 trecho para revisar' : `${vaga.achados.length} trechos para revisar`,
      })]
    : []
  const fonte = elemento('a', { href: SITE_ADZUNA, target: '_blank', rel: 'noopener', className: 'selo-fonte', textContent: 'Adzuna' })
  item.append(
    vaga.link
      ? elemento('a', { href: vaga.link, target: '_blank', rel: 'noopener', className: 'titulo-vaga', textContent: vaga.titulo })
      : elemento('p', { className: 'titulo-vaga', textContent: vaga.titulo }),
    elemento('p', { className: 'meta-vaga', textContent: [vaga.empresa, vaga.local].filter(Boolean).join(', ') }),
    ...alerta,
    elemento('p', { className: 'trecho-vaga', textContent: vaga.trecho }),
    revisar,
    fonte,
  )
  return item
}

// Só a última busca desenha: uma resposta atrasada não pode trocar a lista mais nova.
let buscaAtual = 0

const procurarDentroDoSite = async (pedido) => {
  buscaAtual += 1
  const estaBusca = buscaAtual
  areaEncontradas.hidden = false
  listaVagas.replaceChildren()
  estadoVagas.textContent = 'Procurando vagas...'
  const { dados, erro } = await api.buscarVagas(pedido)
  if (estaBusca !== buscaAtual) return
  if (erro) {
    estadoVagas.textContent = erro
    return
  }
  estadoVagas.textContent = dados.vagas.length === 0
    ? 'Nenhuma vaga encontrada. Tente outro cargo ou os sites abaixo.'
    : `${dados.total} vagas. Mostrando as ${dados.vagas.length} primeiras.`
  listaVagas.replaceChildren(...dados.vagas.map(criarVaga))
}

formDenuncia.hidden = !api.disponivel

formDenuncia.addEventListener('submit', async (evento) => {
  evento.preventDefault()
  const botao = formDenuncia.querySelector('button[type=submit]')
  botao.disabled = true
  estadoDenuncia.textContent = 'Enviando...'
  const campos = formDenuncia.elements
  const { erro } = await api.enviarDenuncia({
    texto: campo.value,
    empresa: campos.empresa.value,
    cidade: campos.cidade.value,
    link: campos.link.value,
    dataVista: campos.dataVista.value,
    site_web: campos.site_web.value,
  })
  botao.disabled = false
  if (erro) {
    estadoDenuncia.textContent = erro
    return
  }
  estadoDenuncia.textContent = 'Denúncia recebida. Ela só aparece no mural depois da moderação.'
  formDenuncia.reset()
})

const formBusca = document.querySelector('#form-busca')
const erroBusca = document.querySelector('#erro-busca')

formBusca.addEventListener('submit', (evento) => {
  evento.preventDefault()
  const pedido = { cargo: formBusca.elements.cargo.value, cidade: formBusca.elements.cidade.value }
  const vagas = linksDeVagas(pedido)
  erroBusca.hidden = vagas.length > 0
  formBusca.elements.cargo.setAttribute('aria-invalid', String(vagas.length === 0))
  document.querySelector('#resultados').hidden = vagas.length === 0
  if (vagas.length === 0) return formBusca.elements.cargo.focus()
  document.querySelector('#links-vagas').replaceChildren(...criarLinks(vagas))
  document.querySelector('#links-alerta').replaceChildren(...criarLinks(linksDeAlerta(pedido)))
  return api.disponivel ? procurarDentroDoSite(pedido) : undefined
})

document.querySelector('#limpar').addEventListener('click', () => {
  campo.value = ''
  atualizar()
  campo.focus()
})

// Se havia uma revisão em andamento, volta com ela; senão, mantém o exemplo.
const salvo = armazenamento.ler()
if (salvo !== null) campo.value = salvo

atualizar()
