import { CONFIG } from './config.js'
import { CATEGORIAS, NIVEIS } from './relatorio.js'

const aviso = document.querySelector('#aviso')
const formulario = document.querySelector('#entrar')
const fila = document.querySelector('#fila')
const sair = document.querySelector('#sair')

const elemento = (tag, propriedades = {}) => Object.assign(document.createElement(tag), propriedades)

const linkSeguro = (link) => {
  try {
    return ['http:', 'https:'].includes(new URL(link).protocol) ? link : null
  } catch {
    return null
  }
}

const criarItem = (cliente, denuncia, aoModerar) => {
  const item = elemento('li')
  const link = denuncia.link && linkSeguro(denuncia.link)
  const textoEditavel = elemento('textarea', { value: denuncia.texto_anuncio, rows: 6, maxLength: 10000 })
  const rotuloTexto = elemento('label', { textContent: 'Texto que será publicado (retire nomes e contatos) ' })
  rotuloTexto.append(textoEditavel)
  const motivo = elemento('input', { maxLength: 500 })
  const rotulo = elemento('label', { textContent: 'Motivo (opcional) ' })
  rotulo.append(motivo)

  const decidir = async (situacao) => {
    const { error } = await cliente.rpc('moderar', {
      denuncia: denuncia.id,
      nova_situacao: situacao,
      novo_motivo: motivo.value.trim() || null,
      texto_publicado: situacao === 'aprovada' ? textoEditavel.value.trim() : null,
    })
    if (error) {
      aviso.textContent = 'Não foi possível salvar a decisão. Tente de novo.'
      return
    }
    aviso.textContent = situacao === 'aprovada' ? 'Denúncia aprovada e publicada no mural.' : 'Denúncia rejeitada.'
    aoModerar()
  }

  const aprovar = elemento('button', { type: 'button', textContent: 'Aprovar e publicar' })
  const rejeitar = elemento('button', { type: 'button', className: 'discreto', textContent: 'Rejeitar' })
  aprovar.addEventListener('click', () => decidir('aprovada'))
  rejeitar.addEventListener('click', () => decidir('rejeitada'))

  const acoes = elemento('div', { className: 'acoes-moderacao' })
  acoes.append(aprovar, rejeitar)

  const detalhes = [denuncia.empresa, denuncia.cidade, denuncia.data_vista].filter(Boolean).join(', ')
  item.append(
    elemento('p', { className: 'meta-mural', textContent: detalhes || 'Sem empresa ou cidade informadas' }),
    ...(link ? [elemento('a', { href: link, target: '_blank', rel: 'noopener noreferrer', textContent: 'Abrir o anúncio' })] : []),
    rotuloTexto,
    elemento('p', {
      className: 'meta-mural',
      textContent: denuncia.achados.map((a) => `${NIVEIS[a.nivel]}, ${CATEGORIAS[a.categoria] ?? a.categoria}: "${a.trecho}"`).join('; '),
    }),
    rotulo,
    acoes,
  )
  return item
}

const criarPublicada = (cliente, denuncia, aoRetirar) => {
  const item = elemento('li')
  const retirar = elemento('button', { type: 'button', className: 'discreto', textContent: 'Retirar do mural' })
  retirar.addEventListener('click', async () => {
    if (!window.confirm('Retirar esta denúncia do mural? Ela não poderá ser publicada de novo.')) return
    const { error } = await cliente.rpc('moderar', { denuncia: denuncia.id, nova_situacao: 'rejeitada', novo_motivo: 'Retirada do mural', texto_publicado: null })
    aviso.textContent = error ? 'Não foi possível retirar. Tente de novo.' : 'Denúncia retirada do mural.'
    if (!error) aoRetirar()
  })
  const acoes = elemento('div', { className: 'acoes-moderacao' })
  acoes.append(retirar)
  item.append(
    elemento('p', { className: 'meta-mural', textContent: [denuncia.empresa, denuncia.cidade].filter(Boolean).join(', ') || 'Sem empresa ou cidade informadas' }),
    elemento('p', { className: 'anuncio-mural', textContent: denuncia.texto_anuncio }),
    acoes,
  )
  return item
}

const carregarPublicadas = async (cliente) => {
  const { data, error } = await cliente
    .from('denuncias')
    .select('id, empresa, cidade, texto_anuncio')
    .eq('status', 'aprovada')
    .order('moderado_em', { ascending: false })
    .limit(50)
  const area = document.querySelector('#area-publicadas')
  area.hidden = Boolean(error) || data.length === 0
  if (!error) {
    document.querySelector('#publicadas').replaceChildren(...data.map((d) => criarPublicada(cliente, d, () => carregarFila(cliente))))
  }
}

const carregarFila = async (cliente) => {
  const { data: moderador, error: erroPapel } = await cliente.rpc('eh_moderador')
  if (erroPapel || !moderador) {
    fila.replaceChildren()
    aviso.textContent = 'Esta conta não tem permissão de moderação.'
    return
  }
  const { data, error } = await cliente
    .from('denuncias')
    .select('id, criado_em, empresa, cidade, link, data_vista, texto_anuncio, achados')
    .eq('status', 'pendente')
    .order('criado_em', { ascending: true })
    .limit(50)
  if (error) {
    aviso.textContent = 'Não foi possível carregar a fila. Tente de novo.'
    return
  }
  if (data.length === 0 && !aviso.textContent) aviso.textContent = 'Nenhuma denúncia aguardando revisão.'
  fila.replaceChildren(...data.map((denuncia) => criarItem(cliente, denuncia, () => carregarFila(cliente))))
  await carregarPublicadas(cliente)
}

const iniciar = async () => {
  if (!CONFIG.supabaseUrl || !CONFIG.chavePublica) {
    aviso.textContent = 'A moderação ainda não está disponível.'
    return
  }
  if (!window.supabase) {
    aviso.textContent = 'Não foi possível carregar a página. Recarregue e tente de novo.'
    return
  }
  const cliente = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.chavePublica)

  const mostrar = async (sessao) => {
    formulario.hidden = Boolean(sessao)
    sair.hidden = !sessao
    if (sessao) {
      await carregarFila(cliente)
    } else {
      fila.replaceChildren()
      document.querySelector('#area-publicadas').hidden = true
    }
  }

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault()
    aviso.textContent = ''
    const { data, error } = await cliente.auth.signInWithPassword({
      email: formulario.elements.email.value.trim(),
      password: formulario.elements.senha.value,
    })
    formulario.elements.senha.value = ''
    if (error) {
      aviso.textContent = 'E-mail ou senha incorretos.'
      return
    }
    await mostrar(data.session)
  })

  sair.addEventListener('click', async () => {
    await cliente.auth.signOut()
    aviso.textContent = ''
    await mostrar(null)
  })

  const { data } = await cliente.auth.getSession()
  await mostrar(data.session)
}

iniciar()
