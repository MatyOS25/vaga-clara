export const CATEGORIAS = {
  genero: 'Sexo',
  orientacao: 'Orientação sexual',
  idade: 'Idade',
  familia: 'Família',
  raca: 'Cor ou raça',
  aparencia: 'Aparência',
  deficiencia: 'Deficiência',
  religiao: 'Religião',
  origem: 'Origem',
}

export const NIVEIS = { proibida: 'Risco legal', atencao: 'Vale revisar' }

const CABECALHO = 'Vaga Clara — revisão de anúncio'

const contar = (quantidade, singular, plural) => (quantidade === 1 ? `1 ${singular}` : `${quantidade} ${plural}`)

export function resumir(texto, achados) {
  if (!texto.trim()) return 'Cole um anúncio para começar a revisão.'
  if (achados.length === 0) return 'Nenhum termo das regras foi encontrado. Vale fazer uma leitura final mesmo assim.'
  const proibidas = achados.filter((achado) => achado.nivel === 'proibida').length
  const atencao = achados.length - proibidas
  const partes = [
    ...(proibidas ? [contar(proibidas, 'com risco legal', 'com risco legal')] : []),
    ...(atencao ? [contar(atencao, 'vale revisar', 'valem revisar')] : []),
  ]
  return `${contar(achados.length, 'trecho para revisar', 'trechos para revisar')}: ${partes.join(' e ')}. Selecione um item para localizar o trecho no anúncio.`
}

export function montarRelatorio(achados) {
  if (achados.length === 0) {
    return `${CABECALHO}\nNenhum termo das regras foi encontrado. Vale fazer uma leitura final mesmo assim.`
  }
  const total = achados.length === 1 ? '1 trecho para revisar' : `${achados.length} trechos para revisar`
  const itens = achados.map((achado, indice) => {
    const linhas = [
      `${indice + 1}. [${NIVEIS[achado.nivel]}: ${CATEGORIAS[achado.categoria]}] "${achado.trecho}"`,
      `   ${achado.motivo} ${achado.sugestao}`,
    ]
    if (achado.base) linhas.push(`   Base: ${achado.base}`)
    return linhas.join('\n')
  })
  return [CABECALHO, total, '', ...itens].join('\n')
}
