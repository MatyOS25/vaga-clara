import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { empacotar } from '../scripts/empacotar-funcoes.mjs'

const ORIGEM = 'https://matyos25.github.io'
const AMBIENTE = {
  SUPABASE_URL: 'https://projeto.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'chave-de-servico',
  LIMITE_SAL: 'sal',
  ADZUNA_APP_ID: 'id',
  ADZUNA_APP_KEY: 'chave-adzuna',
}
const fetchOriginal = globalThis.fetch
let contador = 0

afterEach(() => {
  globalThis.fetch = fetchOriginal
  delete globalThis.Deno
})

// Carrega o arquivo real da função, com o mínimo do Deno, e devolve o tratador registrado.
const carregar = async (caminho, ambiente, rede) => {
  let tratador
  globalThis.Deno = { serve: (funcao) => { tratador = funcao }, env: { get: (nome) => ambiente[nome] } }
  const chamadas = []
  globalThis.fetch = async (url, opcoes) => {
    chamadas.push({ url: String(url), opcoes })
    return rede(String(url), opcoes)
  }
  contador += 1
  await import(`${caminho}?teste=${contador}`)
  return { tratador, chamadas }
}

const json = (corpo, status = 200) => new Response(JSON.stringify(corpo), { status })

const pedido = (corpo) =>
  new Request('https://projeto.supabase.co/functions/v1/x', {
    method: 'POST',
    headers: { origin: ORIGEM, 'content-type': 'application/json', 'cf-connecting-ip': '198.51.100.7' },
    body: JSON.stringify(corpo),
  })

const VAGAS = new URL('../supabase/functions/vagas/index.js', import.meta.url).href
const DENUNCIAR = new URL('../supabase/functions/denunciar/index.js', import.meta.url).href
const ANUNCIO = 'Procuramos recepcionista do sexo feminino. A ACME responde em rh@acme.com ou 98888-7777.'

const redeVagas = (limite = true) => (url) =>
  url.includes('/rpc/consumir_limite')
    ? json(limite)
    : json({ count: 1, results: [{ id: 1, title: 'Caixa', description: 'Apenas mulheres.', redirect_url: 'https://www.adzuna.com.br/land/1' }] })

test('função de vagas consulta o limite, a fonte e devolve a análise', async () => {
  const { tratador, chamadas } = await carregar(VAGAS, AMBIENTE, redeVagas())
  const resposta = await tratador(pedido({ cargo: 'caixa' }))
  const corpo = await resposta.json()
  assert.equal(resposta.status, 200)
  assert.equal(corpo.data.vagas[0].achados[0].categoria, 'genero')
  assert.equal(chamadas.filter((c) => c.url.includes('consumir_limite')).length, 2)
  assert.ok(chamadas.some((c) => c.url.includes('api.adzuna.com')))
  assert.doesNotMatch(JSON.stringify(corpo), /chave-adzuna|chave-de-servico/)
})

test('função de vagas não gasta a cota quando o limite estoura', async () => {
  const { tratador, chamadas } = await carregar(VAGAS, AMBIENTE, redeVagas(false))
  const resposta = await tratador(pedido({ cargo: 'caixa' }))
  assert.equal(resposta.status, 429)
  assert.ok(!chamadas.some((c) => c.url.includes('api.adzuna.com')))
})

test('função recusa origem de fora antes de tocar no banco', async () => {
  const { tratador, chamadas } = await carregar(VAGAS, AMBIENTE, redeVagas())
  const resposta = await tratador(new Request('https://x/f', { method: 'POST', headers: { origin: 'https://mal.example' }, body: '{}' }))
  assert.equal(resposta.status, 403)
  assert.equal(chamadas.length, 0)
})

test('sem segredo configurado a função falha com mensagem genérica', async () => {
  const registrar = console.error
  console.error = () => {}
  try {
    const { tratador } = await carregar(VAGAS, { ...AMBIENTE, LIMITE_SAL: '' }, redeVagas())
    const resposta = await tratador(pedido({ cargo: 'caixa' }))
    assert.equal(resposta.status, 500)
    assert.doesNotMatch(await resposta.text(), /LIMITE_SAL/)
  } finally {
    console.error = registrar
  }
})

test('função de denúncia grava sem dados pessoais e nunca aprovada', async () => {
  const rede = (url) => (url.includes('consumir_limite') ? json(true) : new Response(null, { status: 201 }))
  const { tratador, chamadas } = await carregar(DENUNCIAR, AMBIENTE, rede)
  const resposta = await tratador(pedido({ texto: ANUNCIO, empresa: 'ACME', status: 'aprovada', moderado_por: 'x' }))
  assert.equal(resposta.status, 202)
  const gravacao = chamadas.find((c) => c.url.endsWith('/rest/v1/denuncias'))
  const linha = JSON.parse(gravacao.opcoes.body)
  assert.doesNotMatch(linha.texto_anuncio, /ACME|rh@acme|98888/)
  assert.equal(linha.status, undefined)
  assert.equal(linha.moderado_por, undefined)
  assert.equal(gravacao.opcoes.headers.authorization, 'Bearer chave-de-servico')
})

test('função de denúncia não grava robô nem texto inválido', async () => {
  const rede = (url) => (url.includes('consumir_limite') ? json(true) : new Response(null, { status: 201 }))
  const { tratador, chamadas } = await carregar(DENUNCIAR, AMBIENTE, rede)
  assert.equal((await tratador(pedido({ texto: ANUNCIO, site_web: 'spam' }))).status, 202)
  assert.equal((await tratador(pedido({ texto: 'curto' }))).status, 400)
  assert.ok(!chamadas.some((c) => c.url.endsWith('/rest/v1/denuncias')))
})

test('função de denúncia consome o limite antes de analisar', async () => {
  const { tratador, chamadas } = await carregar(DENUNCIAR, AMBIENTE, () => json(false))
  const resposta = await tratador(pedido({ texto: ANUNCIO }))
  assert.equal(resposta.status, 429)
  assert.equal(chamadas.length, 1)
})

test('falha ao gravar vira erro genérico', async () => {
  const registrar = console.error
  console.error = () => {}
  try {
    const rede = (url) => (url.includes('consumir_limite') ? json(true) : json({ message: 'detalhe interno' }, 500))
    const { tratador } = await carregar(DENUNCIAR, AMBIENTE, rede)
    const resposta = await tratador(pedido({ texto: ANUNCIO }))
    assert.equal(resposta.status, 500)
    assert.doesNotMatch(await resposta.text(), /detalhe interno/)
  } finally {
    console.error = registrar
  }
})

test('pacote de cada função roda sozinho, sem importar outros arquivos', async () => {
  const destino = mkdtempSync(join(tmpdir(), 'funcoes-'))
  const gerados = await empacotar(destino)
  assert.deepEqual(gerados.map((g) => g.nome).sort(), ['denunciar', 'vagas'])
  const vagas = gerados.find((g) => g.nome === 'vagas')
  const { tratador } = await carregar(pathToFileURL(vagas.arquivo).href, AMBIENTE, redeVagas())
  const resposta = await tratador(pedido({ cargo: 'caixa' }))
  assert.equal(resposta.status, 200)
  assert.equal((await resposta.json()).data.vagas[0].achados[0].categoria, 'genero')
})
