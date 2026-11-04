const CORPO_MAXIMO = 32000

const cabecalhos = (origem) => ({
  'access-control-allow-origin': origem,
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  vary: 'origin',
})

const responder = (status, corpo, origem) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cabecalhos(origem), 'content-type': 'application/json' } })

const falha = (status, erro, origem) => responder(status, { success: false, data: null, error: erro }, origem)

export async function tratar(pedido, { origens, executar, registrar = console.error }) {
  const origem = pedido.headers.get('origin') ?? ''
  if (!origens.includes(origem)) return new Response(null, { status: 403 })
  if (pedido.method === 'OPTIONS') return new Response(null, { status: 204, headers: cabecalhos(origem) })
  if (pedido.method !== 'POST') return falha(405, 'Método não permitido.', origem)

  const texto = await pedido.text()
  if (texto.length > CORPO_MAXIMO) return falha(413, 'O texto enviado é grande demais.', origem)

  let corpo
  try {
    corpo = JSON.parse(texto)
  } catch {
    return falha(400, 'O pedido não pôde ser lido.', origem)
  }

  try {
    const { status, dados, erro } = await executar(corpo, pedido)
    return erro ? falha(status, erro, origem) : responder(status, { success: true, data: dados ?? null, error: null }, origem)
  } catch (causa) {
    registrar(causa)
    return falha(500, 'Não foi possível concluir agora. Tente de novo em instantes.', origem)
  }
}

// O primeiro valor de x-forwarded-for vem do cliente e pode ser forjado; o último foi escrito pela infraestrutura.
export const ipDoCliente = (pedido) =>
  pedido.headers.get('cf-connecting-ip')?.trim() ||
  pedido.headers.get('x-forwarded-for')?.split(',').at(-1).trim() ||
  'desconhecido'

export const origensPermitidas = (extra) => ['https://matyos25.github.io', ...(extra ? extra.split(',').map((o) => o.trim()) : [])]

// Guarda só um hash com sal: o limite de envios não precisa saber o IP de ninguém.
export async function chaveDeLimite(acao, ip, sal) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${sal}:${ip}`))
  const hash = [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${acao}:${hash}`
}

// O teto geral protege a cota da fonte de vagas mesmo se alguém conseguir trocar de IP a cada pedido.
export async function dentroDosLimites(consumir, pedido, acao, { porIp, porDia }, sal) {
  const chave = await chaveDeLimite(acao, ipDoCliente(pedido), sal)
  if (!(await consumir(chave, porIp, 3600))) return false
  return consumir(`${acao}:geral`, porDia, 86400)
}
