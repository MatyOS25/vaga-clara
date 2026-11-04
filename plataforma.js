const SEM_CONEXAO = 'Não foi possível falar com o servidor. Confira sua conexão e tente de novo.'
const INDISPONIVEL = 'Este recurso ainda não está disponível.'

export function criarPlataforma({ supabaseUrl, chavePublica }, buscar = (...args) => fetch(...args)) {
  const disponivel = Boolean(supabaseUrl && chavePublica)

  const chamarFuncao = async (nome, corpo) => {
    if (!disponivel) return { erro: INDISPONIVEL }
    try {
      const resposta = await buscar(`${supabaseUrl}/functions/v1/${nome}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(corpo),
      })
      const { success, data, error } = await resposta.json()
      return success ? { dados: data } : { erro: error ?? SEM_CONEXAO }
    } catch {
      return { erro: SEM_CONEXAO }
    }
  }

  const chamarBanco = async (funcao, corpo = {}) => {
    if (!disponivel) return { erro: INDISPONIVEL }
    try {
      const resposta = await buscar(`${supabaseUrl}/rest/v1/rpc/${funcao}`, {
        method: 'POST',
        headers: { apikey: chavePublica, 'content-type': 'application/json' },
        body: JSON.stringify(corpo),
      })
      return resposta.ok ? { dados: await resposta.json() } : { erro: SEM_CONEXAO }
    } catch {
      return { erro: SEM_CONEXAO }
    }
  }

  return {
    disponivel,
    buscarVagas: (pedido) => chamarFuncao('vagas', pedido),
    enviarDenuncia: (denuncia) => chamarFuncao('denunciar', denuncia),
    carregarMural: (limite = 30) => chamarBanco('mural_denuncias', { limite }),
    carregarEstatisticas: () => chamarBanco('estatisticas_denuncias'),
  }
}
