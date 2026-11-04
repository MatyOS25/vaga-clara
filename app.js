import { analisar, segmentar } from './analisar.js'
import { montarRelatorio, resumir, CATEGORIAS, NIVEIS } from './relatorio.js'

const campo = document.querySelector('#anuncio')
const marcas = document.querySelector('#marcas')
const resumo = document.querySelector('#resumo')
const lista = document.querySelector('#lista')

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
  sincronizarRolagem()
}

campo.addEventListener('input', atualizar)
campo.addEventListener('scroll', sincronizarRolagem)

const copiar = document.querySelector('#copiar')
let avisoCopia

copiar.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(montarRelatorio(analisar(campo.value)))
    copiar.textContent = 'Relatório copiado!'
  } catch {
    copiar.textContent = 'Não foi possível copiar'
  }
  clearTimeout(avisoCopia)
  avisoCopia = setTimeout(() => {
    copiar.textContent = 'Copiar relatório'
  }, 2000)
})

document.querySelector('#limpar').addEventListener('click', () => {
  campo.value = ''
  atualizar()
  campo.focus()
})

atualizar()
