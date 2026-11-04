export const CATEGORIAS = {
  genero: 'Sexo',
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
