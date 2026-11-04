import { test } from 'node:test'
import assert from 'node:assert/strict'
import { anonimizar } from './anonimizar.js'
import { prepararDenuncia } from './denunciar.js'
import { buscarVagas } from './vagas.js'
import { tratar, chaveDeLimite, ipDoCliente, dentroDosLimites, origensPermitidas } from './http.js'

const AGORA = new Date('2026-11-04T12:00:00Z')
const ANUNCIO = 'Contratamos recepcionista do sexo feminino com boa aparência para a recepção.'

test('anonimizar remove e-mail, telefone e CPF', () => {
  const texto = 'Envie para maria.silva@empresa.com.br ou (21) 99999-8888. CPF 123.456.789-09.'
  const limpo = anonimizar(texto)
  assert.doesNotMatch(limpo, /maria|99999|123\.456/)
  assert.match(limpo, /\[e-mail removido\]/)
  assert.match(limpo, /\[telefone removido\]/)
  assert.match(limpo, /\[CPF removido\]/)
})

test('anonimizar aceita telefone com código do país e sem separador', () => {
  assert.equal(anonimizar('Ligue +55 21 3333-4444'), 'Ligue [telefone removido]')
  assert.equal(anonimizar('Zap 21999998888'), 'Zap [telefone removido]')
})

test('anonimizar mantém salário, ano e carga horária', () => {
  const texto = 'Salário de R$ 1.500,00, desde 2024, 44 horas semanais.'
  assert.equal(anonimizar(texto), texto)
})

test('denúncia válida guarda texto sem dados pessoais e trechos calculados no servidor', () => {
  const { linha, erros } = prepararDenuncia({ texto: `${ANUNCIO} Contato: rh@empresa.com`, empresa: ' ACME ', link: 'https://exemplo.com/vaga', dataVista: '2026-11-01' }, AGORA)
  assert.deepEqual(erros, {})
  assert.doesNotMatch(linha.texto_anuncio, /rh@empresa/)
  assert.equal(linha.empresa, 'ACME')
  assert.equal(linha.data_vista, '2026-11-01')
  assert.deepEqual(linha.achados.map((a) => a.categoria), ['genero', 'aparencia'])
})

test('denúncia ignora achados enviados pelo navegador', () => {
  const { linha } = prepararDenuncia({ texto: ANUNCIO, achados: [{ categoria: 'falso' }], status: 'aprovada' }, AGORA)
  assert.ok(linha.achados.every((a) => a.categoria !== 'falso'))
  assert.equal(linha.status, undefined)
})

test('denúncia sem trecho apontado é recusada', () => {
  const { erros } = prepararDenuncia({ texto: 'Procuramos pessoa desenvolvedora com experiência em JavaScript.' }, AGORA)
  assert.ok(erros.texto)
})

test('denúncia recusa texto curto, longo ou de tipo errado', () => {
  assert.ok(prepararDenuncia({ texto: 'curto' }, AGORA).erros.texto)
  assert.ok(prepararDenuncia({ texto: `${ANUNCIO}${'a'.repeat(10001)}` }, AGORA).erros.texto)
  assert.ok(prepararDenuncia({ texto: 123 }, AGORA).erros.texto)
  assert.ok(prepararDenuncia(null, AGORA).erros.texto)
})

test('denúncia recusa link que não seja http ou https', () => {
  assert.ok(prepararDenuncia({ texto: ANUNCIO, link: 'javascript:alert(1)' }, AGORA).erros.link)
  assert.ok(prepararDenuncia({ texto: ANUNCIO, link: 'nao é link' }, AGORA).erros.link)
})

test('denúncia recusa data futura ou inválida', () => {
  assert.ok(prepararDenuncia({ texto: ANUNCIO, dataVista: '2026-11-05' }, AGORA).erros.dataVista)
  assert.ok(prepararDenuncia({ texto: ANUNCIO, dataVista: '2026-13-40' }, AGORA).erros.dataVista)
})

test('denúncia preenchida no campo oculto é tratada como robô', () => {
  assert.equal(prepararDenuncia({ texto: ANUNCIO, site_web: 'http://spam' }, AGORA).robo, true)
})

const respostaAdzuna = {
  count: 2,
  results: [
    { id: '1', title: '<strong>Recepcionista</strong>', company: { display_name: 'ACME' }, location: { display_name: 'Niterói, RJ' }, description: 'Vaga para <b>sexo feminino</b> na recepção…', redirect_url: 'https://www.adzuna.com.br/land/1', created: '2026-11-01T10:00:00Z', salary_min: 2000, salary_max: 2500 },
    { id: '2', title: 'Auxiliar', description: 'Atendimento ao público.', redirect_url: 'javascript:alert(1)', created: '2026-11-02T10:00:00Z' },
  ],
}

const fetchFalso = (corpo, status = 200, registro = []) => async (url) => {
  registro.push(new URL(url))
  return new Response(JSON.stringify(corpo), { status })
}

const CHAVES = { appId: 'id-teste', appKey: 'chave-teste' }

test('busca monta o pedido à Adzuna para o Brasil', async () => {
  const pedidos = []
  await buscarVagas({ cargo: ' recepcionista ', cidade: 'Niterói', pagina: 2 }, { ...CHAVES, fetch: fetchFalso(respostaAdzuna, 200, pedidos) })
  const [url] = pedidos
  assert.match(url.pathname, /\/jobs\/br\/search\/2$/)
  assert.equal(url.searchParams.get('what'), 'recepcionista')
  assert.equal(url.searchParams.get('where'), 'Niterói')
  assert.equal(url.searchParams.get('app_key'), 'chave-teste')
})

test('busca limpa HTML, analisa o trecho e descarta link inseguro', async () => {
  const { dados } = await buscarVagas({ cargo: 'recepcionista' }, { ...CHAVES, fetch: fetchFalso(respostaAdzuna) })
  assert.equal(dados.total, 2)
  const [primeira, segunda] = dados.vagas
  assert.equal(primeira.titulo, 'Recepcionista')
  assert.equal(primeira.empresa, 'ACME')
  assert.doesNotMatch(primeira.trecho, /</)
  assert.deepEqual(primeira.achados.map((a) => a.categoria), ['genero'])
  assert.equal(primeira.link, 'https://www.adzuna.com.br/land/1')
  assert.equal(segunda.link, null)
  assert.equal(segunda.empresa, null)
  assert.deepEqual(segunda.achados, [])
})

test('busca sem cargo não chama a fonte', async () => {
  const pedidos = []
  const { erro, status } = await buscarVagas({ cargo: ' ' }, { ...CHAVES, fetch: fetchFalso({}, 200, pedidos) })
  assert.ok(erro)
  assert.equal(status, 400)
  assert.equal(pedidos.length, 0)
})

test('busca limita a página e o tamanho dos termos', async () => {
  const pedidos = []
  await buscarVagas({ cargo: 'a'.repeat(500), pagina: 9999 }, { ...CHAVES, fetch: fetchFalso({ results: [] }, 200, pedidos) })
  assert.match(pedidos[0].pathname, /\/search\/20$/)
  assert.equal(pedidos[0].searchParams.get('what').length, 100)
  const outros = []
  await buscarVagas({ cargo: 'caixa', pagina: 'abc' }, { ...CHAVES, fetch: fetchFalso({ results: [] }, 200, outros) })
  assert.match(outros[0].pathname, /\/search\/1$/)
})

test('falha da fonte vira erro claro, sem vazar a chave', async () => {
  const fora = await buscarVagas({ cargo: 'caixa' }, { ...CHAVES, fetch: fetchFalso({ error: 'x' }, 500) })
  assert.equal(fora.status, 502)
  const rede = await buscarVagas({ cargo: 'caixa' }, { ...CHAVES, fetch: async () => { throw new Error('falhou chave-teste') } })
  assert.equal(rede.status, 502)
  assert.doesNotMatch(JSON.stringify(rede), /chave-teste/)
})

test('sem chave configurada a busca avisa que está indisponível', async () => {
  const { status } = await buscarVagas({ cargo: 'caixa' }, { appId: '', appKey: '', fetch: fetchFalso({}) })
  assert.equal(status, 503)
})

const pedido = (metodo, corpo, origem = 'https://matyos25.github.io') =>
  new Request('https://x.supabase.co/functions/v1/vagas', { method: metodo, headers: { origin: origem, 'content-type': 'application/json' }, body: corpo })

const ORIGENS = ['https://matyos25.github.io']

test('http responde ao preflight só para origem permitida', async () => {
  const ok = await tratar(pedido('OPTIONS'), { origens: ORIGENS, executar: async () => ({ status: 200, dados: {} }) })
  assert.equal(ok.status, 204)
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://matyos25.github.io')
  const outra = await tratar(pedido('OPTIONS', undefined, 'https://mal.example'), { origens: ORIGENS, executar: async () => ({ status: 200 }) })
  assert.equal(outra.status, 403)
})

test('http recusa origem de fora sem executar', async () => {
  let executou = false
  const r = await tratar(pedido('POST', '{}', 'https://mal.example'), { origens: ORIGENS, executar: async () => { executou = true; return { status: 200 } } })
  assert.equal(r.status, 403)
  assert.equal(executou, false)
})

test('http só aceita POST com JSON válido', async () => {
  const executar = async () => ({ status: 200, dados: {} })
  assert.equal((await tratar(new Request('https://x/f', { headers: { origin: ORIGENS[0] } }), { origens: ORIGENS, executar })).status, 405)
  assert.equal((await tratar(pedido('POST', '{quebrado'), { origens: ORIGENS, executar })).status, 400)
})

test('http usa o envelope de resposta e esconde erro interno', async () => {
  const certo = await tratar(pedido('POST', '{"a":1}'), { origens: ORIGENS, executar: async (corpo) => ({ status: 200, dados: corpo }) })
  assert.deepEqual(await certo.json(), { success: true, data: { a: 1 }, error: null })
  const recusa = await tratar(pedido('POST', '{}'), { origens: ORIGENS, executar: async () => ({ status: 400, erro: 'Falta o cargo.' }) })
  assert.deepEqual(await recusa.json(), { success: false, data: null, error: 'Falta o cargo.' })
  const logs = []
  const quebrou = await tratar(pedido('POST', '{}'), { origens: ORIGENS, registrar: (e) => logs.push(e), executar: async () => { throw new Error('segredo do banco') } })
  assert.equal(quebrou.status, 500)
  assert.doesNotMatch(await quebrou.text(), /segredo/)
  assert.equal(logs.length, 1)
})

test('http recusa corpo grande demais', async () => {
  const r = await tratar(pedido('POST', JSON.stringify({ texto: 'a'.repeat(40000) })), { origens: ORIGENS, executar: async () => ({ status: 200 }) })
  assert.equal(r.status, 413)
})

test('chave de limite não guarda o IP', async () => {
  const chave = await chaveDeLimite('denunciar', '203.0.113.9', 'sal-teste')
  assert.doesNotMatch(chave, /203\.0/)
  assert.notEqual(chave, await chaveDeLimite('denunciar', '203.0.113.9', 'outro-sal'))
  assert.equal(chave, await chaveDeLimite('denunciar', '203.0.113.9', 'sal-teste'))
})

test('IP do cliente ignora o valor que o próprio cliente pode forjar', () => {
  const plataforma = new Request('https://x/f', { headers: { 'cf-connecting-ip': '198.51.100.7', 'x-forwarded-for': '1.1.1.1, 203.0.113.9' } })
  assert.equal(ipDoCliente(plataforma), '198.51.100.7')
  const encaminhado = new Request('https://x/f', { headers: { 'x-forwarded-for': '1.1.1.1, 203.0.113.9' } })
  assert.equal(ipDoCliente(encaminhado), '203.0.113.9')
  assert.equal(ipDoCliente(new Request('https://x/f')), 'desconhecido')
})

for (const [nome, texto] of [
  ['celular sem DDD', 'Ligue 98888-7777 hoje'],
  ['celular sem separador', 'Ligue 988887777 hoje'],
  ['telefone com pontos', 'Ligue 11.98888.7777 hoje'],
  ['dígitos de largura total', 'Ligue １１９８８８８７７７７ hoje'],
  ['caractere invisível', 'Ligue 11 9\u200b8888-7777 hoje'],
  ['dígitos espaçados', 'Ligue 1 1 9 8 8 8 8 7 7 7 7 hoje'],
  ['CPF espaçado', 'CPF: 123 456 789 10 hoje'],
]) {
  test(`anonimizar remove número: ${nome}`, () => {
    assert.doesNotMatch(anonimizar(texto).normalize('NFKC'), /\d/)
  })
}

test('anonimizar remove e-mail disfarçado, link e perfil', () => {
  assert.doesNotMatch(anonimizar('Fale com fulano (at) gmail.com agora'), /fulano|gmail/)
  assert.doesNotMatch(anonimizar('Fale com fulano arroba gmail agora'), /fulano|gmail/)
  assert.doesNotMatch(anonimizar('Veja wa.me/5511988887777 agora'), /wa\.me|5511/)
  assert.doesNotMatch(anonimizar('Veja https://empresa.com/vaga/1 agora'), /empresa\.com/)
  assert.doesNotMatch(anonimizar('Siga @perfil_da_loja agora'), /perfil_da_loja/)
})

test('anonimizar mantém intervalo de anos e endereço de e-mail vira aviso', () => {
  assert.equal(anonimizar('Atuou de 2022-2024 na área'), 'Atuou de 2022-2024 na área')
  assert.equal(anonimizar('Atuou de 2022 2024 na área'), 'Atuou de 2022 2024 na área')
})

test('anonimizar tira o nome da empresa do texto, sem diferenciar maiúsculas', () => {
  assert.equal(anonimizar('A ACME contrata. Vaga na acme.', { empresa: 'Acme' }), 'A [empresa] contrata. Vaga na [empresa].')
  assert.equal(anonimizar('A (A+B) contrata', { empresa: '(A+B)' }), 'A [empresa] contrata')
  assert.equal(anonimizar('Texto igual', { empresa: '  ' }), 'Texto igual')
})

test('denúncia tira a empresa do texto e anonimiza a cidade', () => {
  const { linha } = prepararDenuncia({ texto: `A ACME procura. ${ANUNCIO}`, empresa: 'ACME', cidade: 'Niterói, ligue 98888-7777' }, AGORA)
  assert.doesNotMatch(linha.texto_anuncio, /ACME/)
  assert.equal(linha.empresa, 'ACME')
  assert.doesNotMatch(linha.cidade, /98888/)
})

test('texto hostil grande é recusado rápido, antes de qualquer análise', () => {
  const inicio = performance.now()
  const { erros } = prepararDenuncia({ texto: 'a-'.repeat(15500) }, AGORA)
  assert.ok(erros.texto)
  assert.ok(performance.now() - inicio < 50)
})

test('anonimizar não degrada com texto hostil dentro do limite', () => {
  const inicio = performance.now()
  for (const texto of ['a-'.repeat(5000), 'x.'.repeat(5000), '1'.repeat(10000), '@'.repeat(10000), 'a@'.repeat(5000)]) anonimizar(texto)
  assert.ok(performance.now() - inicio < 300, `demorou ${performance.now() - inicio} ms`)
})

test('limites combinam o IP com um teto geral, e param no primeiro que estourar', async () => {
  const consumidas = []
  const consumir = (resposta) => async (chave, maximo, janela) => { consumidas.push({ chave, maximo, janela }); return resposta(chave) }
  const pedidoIp = new Request('https://x/f', { headers: { 'cf-connecting-ip': '198.51.100.7' } })
  assert.equal(await dentroDosLimites(consumir(() => true), pedidoIp, 'vagas', { porIp: 30, porDia: 200 }, 'sal'), true)
  assert.deepEqual(consumidas[1], { chave: 'vagas:geral', maximo: 200, janela: 86400 })
  assert.match(consumidas[0].chave, /^vagas:[0-9a-f]{64}$/)
  consumidas.length = 0
  assert.equal(await dentroDosLimites(consumir(() => false), pedidoIp, 'vagas', { porIp: 30, porDia: 200 }, 'sal'), false)
  assert.equal(consumidas.length, 1)
})

test('origens de desenvolvimento só valem quando configuradas', () => {
  assert.deepEqual(origensPermitidas(''), ['https://matyos25.github.io'])
  assert.deepEqual(origensPermitidas(undefined), ['https://matyos25.github.io'])
  assert.deepEqual(origensPermitidas('http://127.0.0.1:8730'), ['https://matyos25.github.io', 'http://127.0.0.1:8730'])
})
