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

// Texto pronto para os canais oficiais (MPT, Disque 100). Sem achados, não há o que denunciar.
export function montarDenuncia(achados, texto = '') {
  if (achados.length === 0) return null
  const itens = achados.map((achado, indice) => {
    const linha = `${indice + 1}. "${achado.trecho}" — ${achado.motivo} (${CATEGORIAS[achado.categoria]})`
    return { nivel: achado.nivel, texto: achado.base ? `${linha}\n   ${achado.base}` : linha }
  })
  // Critério vago não é afirmado como descumprimento da lei: fica para quem apura avaliar.
  const grupo = (titulo, nivel) => {
    const doNivel = itens.filter((item) => item.nivel === nivel).map((item) => item.texto)
    return doNivel.length ? [titulo, '', ...doNivel, ''] : []
  }
  return [
    'Denúncia de anúncio de emprego com possível discriminação',
    '',
    ...grupo('Trechos que podem descumprir a lei:', 'proibida'),
    ...grupo('Outros trechos para avaliação:', 'atencao'),
    ...(texto.trim() ? ['Texto do anúncio:', '', texto.trim(), ''] : []),
    'Peço a apuração. Informações sobre a publicação:',
    'Empresa: [preencher]',
    'Site ou local onde foi publicada: [preencher]',
    'Data em que foi vista: [preencher]',
  ].join('\n')
}
