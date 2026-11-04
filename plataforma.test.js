import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarPlataforma } from './plataforma.js'

const CONFIG = { supabaseUrl: 'https://x.supabase.co', chavePublica: 'sb_publishable_teste' }

const responderCom = (corpo, status = 200, registro = []) => async (url, opcoes) => {
  registro.push({ url, opcoes })
  return new Response(JSON.stringify(corpo), { status })
}

test('sem configuração, a plataforma se declara indisponível e não chama a rede', async () => {
  const chamadas = []
  const api = criarPlataforma({ supabaseUrl: '', chavePublica: '' }, responderCom({}, 200, chamadas))
  assert.equal(api.disponivel, false)
  const { erro } = await api.buscarVagas({ cargo: 'caixa' })
  assert.ok(erro)
  assert.equal(chamadas.length, 0)
})

test('busca chama a função de vagas e devolve os dados', async () => {
  const chamadas = []
  const api = criarPlataforma(CONFIG, responderCom({ success: true, data: { total: 1, vagas: [] }, error: null }, 200, chamadas))
  const { dados } = await api.buscarVagas({ cargo: 'caixa', cidade: 'Niterói' })
  assert.equal(dados.total, 1)
  assert.equal(chamadas[0].url, 'https://x.supabase.co/functions/v1/vagas')
  assert.deepEqual(JSON.parse(chamadas[0].opcoes.body), { cargo: 'caixa', cidade: 'Niterói' })
})

test('erro do servidor chega como mensagem para a pessoa', async () => {
  const api = criarPlataforma(CONFIG, responderCom({ success: false, data: null, error: 'Muitas buscas.' }, 429))
  assert.deepEqual(await api.enviarDenuncia({ texto: 'x' }), { erro: 'Muitas buscas.' })
})

test('falha de rede ou resposta estranha vira mensagem clara', async () => {
  const semRede = criarPlataforma(CONFIG, async () => { throw new Error('offline') })
  assert.match((await semRede.buscarVagas({ cargo: 'caixa' })).erro, /conexão/)
  const estranha = criarPlataforma(CONFIG, async () => new Response('<html>', { status: 500 }))
  assert.match((await estranha.buscarVagas({ cargo: 'caixa' })).erro, /conexão/)
})

test('mural e estatísticas usam a chave pública nas funções do banco', async () => {
  const chamadas = []
  const api = criarPlataforma(CONFIG, responderCom([{ id: '1' }], 200, chamadas))
  const { dados } = await api.carregarMural(10)
  assert.deepEqual(dados, [{ id: '1' }])
  assert.equal(chamadas[0].url, 'https://x.supabase.co/rest/v1/rpc/mural_denuncias')
  assert.equal(chamadas[0].opcoes.headers.apikey, 'sb_publishable_teste')
  assert.deepEqual(JSON.parse(chamadas[0].opcoes.body), { limite: 10 })
  await api.carregarEstatisticas()
  assert.equal(chamadas[1].url, 'https://x.supabase.co/rest/v1/rpc/estatisticas_denuncias')
})

test('falha ao carregar o mural vira mensagem', async () => {
  const api = criarPlataforma(CONFIG, responderCom({ message: 'interno' }, 500))
  const { erro } = await api.carregarMural()
  assert.ok(erro)
  assert.doesNotMatch(erro, /interno/)
})
