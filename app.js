import { analisar, segmentar } from './analisar.js'
import { montarRelatorio, montarDenuncia, resumir, CATEGORIAS, NIVEIS } from './relatorio.js'

const campo = document.querySelector('#anuncio')
const marcas = document.querySelector('#marcas')
const resumo = document.querySelector('#resumo')
const lista = document.querySelector('#lista')

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
  const denuncia = montarDenuncia(analisar(campo.value))
  if (!denuncia) return avisoDenuncia('Nada a denunciar')
  return copiarTexto(denuncia, avisoDenuncia, 'Denúncia copiada!')
})

document.querySelector('#procurar').addEventListener('click', () => {
  const inicio = campo.value.trim().split(/\s+/).slice(0, 12).join(' ')
  if (!inicio) return
  window.open(`https://www.google.com/search?q=${encodeURIComponent(`"${inicio}"`)}`, '_blank', 'noopener')
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
