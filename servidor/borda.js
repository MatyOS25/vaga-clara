import { chaveDeLimite, ipDoCliente } from './http.js'

export const ORIGENS = ['https://matyos25.github.io', 'http://127.0.0.1:8730']

const obrigatoria = (ambiente, nome) => {
  const valor = ambiente.get(nome)
  if (!valor) throw new Error(`Variável ausente: ${nome}`)
  return valor
}

const chamarBanco = (ambiente, caminho, corpo, extras = {}) =>
  fetch(`${obrigatoria(ambiente, 'SUPABASE_URL')}/rest/v1/${caminho}`, {
    method: 'POST',
    headers: {
      apikey: obrigatoria(ambiente, 'SUPABASE_SERVICE_ROLE_KEY'),
      authorization: `Bearer ${obrigatoria(ambiente, 'SUPABASE_SERVICE_ROLE_KEY')}`,
      'content-type': 'application/json',
      ...extras,
    },
    body: JSON.stringify(corpo),
  })

export async function dentroDoLimite(ambiente, pedido, acao, maximo, janela) {
  const chave = await chaveDeLimite(acao, ipDoCliente(pedido), obrigatoria(ambiente, 'LIMITE_SAL'))
  const resposta = await chamarBanco(ambiente, 'rpc/consumir_limite', { chave_pedido: chave, maximo, janela_segundos: janela })
  if (!resposta.ok) throw new Error(`Limite falhou: ${resposta.status}`)
  return (await resposta.json()) === true
}

export async function gravarDenuncia(ambiente, linha) {
  const resposta = await chamarBanco(ambiente, 'denuncias', linha, { prefer: 'return=minimal' })
  if (!resposta.ok) throw new Error(`Gravação falhou: ${resposta.status}`)
}
