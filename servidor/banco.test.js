import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const MODERADOR = '11111111-1111-1111-1111-111111111111'
const COMUM = '22222222-2222-2222-2222-222222222222'

// O PGlite não traz o esquema do Supabase: criamos só o que a migração usa.
const AMBIENTE = `
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  insert into auth.users values ('${MODERADOR}'), ('${COMUM}');
`

let banco

const como = async (papel, uid, sql, parametros) => {
  await banco.exec(`set role ${papel}; select set_config('app.uid', '${uid ?? ''}', false);`)
  try {
    return await banco.query(sql, parametros)
  } finally {
    await banco.exec('reset role;')
  }
}

const criarDenuncia = async (empresa = 'ACME') => {
  const { rows } = await como('service_role', null,
    `insert into public.denuncias (texto_anuncio, empresa, link, achados)
     values ('Vaga para sexo feminino', $1, 'https://exemplo.com/1', '[{"categoria":"genero","nivel":"proibida","trecho":"sexo feminino"}]') returning id`, [empresa])
  return rows[0].id
}

before(async () => {
  banco = new PGlite()
  await banco.exec(AMBIENTE)
  await banco.exec(readFileSync(new URL('../supabase/migrations/001_plataforma.sql', import.meta.url), 'utf8'))
  await banco.query('insert into public.moderadores (user_id) values ($1)', [MODERADOR])
})

test('visitante não lê nem grava a tabela de denúncias', async () => {
  await criarDenuncia()
  await assert.rejects(como('anon', null, 'select * from public.denuncias'), /permission denied/)
  await assert.rejects(como('anon', null, `insert into public.denuncias (texto_anuncio, achados) values ('x', '[]')`), /permission denied/)
})

test('usuário logado comum não vê a fila nem modera', async () => {
  const id = await criarDenuncia()
  const { rows } = await como('authenticated', COMUM, 'select * from public.denuncias')
  assert.equal(rows.length, 0)
  await assert.rejects(como('authenticated', COMUM, `select public.moderar($1, 'aprovada', null)`, [id]), /moderador/)
  await assert.rejects(como('authenticated', COMUM, `update public.denuncias set status = 'aprovada'`), /permission denied/)
})

test('usuário comum não consegue virar moderador', async () => {
  await assert.rejects(como('authenticated', COMUM, 'insert into public.moderadores (user_id) values ($1)', [COMUM]), /permission denied/)
})

test('moderador vê a fila e aprova, registrando quem aprovou', async () => {
  const id = await criarDenuncia()
  const fila = await como('authenticated', MODERADOR, `select id from public.denuncias where status = 'pendente'`)
  assert.ok(fila.rows.some((r) => r.id === id))
  await como('authenticated', MODERADOR, `select public.moderar($1, 'aprovada', null)`, [id])
  const { rows } = await como('service_role', null, 'select status, moderado_por, moderado_em from public.denuncias where id = $1', [id])
  assert.equal(rows[0].status, 'aprovada')
  assert.equal(rows[0].moderado_por, MODERADOR)
  assert.ok(rows[0].moderado_em)
})

test('moderar recusa situação inválida', async () => {
  const id = await criarDenuncia()
  await assert.rejects(como('authenticated', MODERADOR, `select public.moderar($1, 'pendente', null)`, [id]), /situação/)
})

test('mural público só traz aprovadas e nunca a empresa ou o link', async () => {
  const aprovada = await criarDenuncia('Empresa Aprovada')
  const pendente = await criarDenuncia('Empresa Pendente')
  await como('authenticated', MODERADOR, `select public.moderar($1, 'aprovada', null)`, [aprovada])
  const { rows } = await como('anon', null, 'select * from public.mural_denuncias(100)')
  const ids = rows.map((r) => r.id)
  assert.ok(ids.includes(aprovada))
  assert.ok(!ids.includes(pendente))
  assert.ok(!('empresa' in rows[0]))
  assert.ok(!('link' in rows[0]))
})

test('mural limita a quantidade pedida', async () => {
  for (let i = 0; i < 3; i += 1) {
    await como('authenticated', MODERADOR, `select public.moderar($1, 'aprovada', null)`, [await criarDenuncia()])
  }
  const { rows } = await como('anon', null, 'select * from public.mural_denuncias(1)')
  assert.equal(rows.length, 1)
  const muitos = await como('anon', null, 'select * from public.mural_denuncias(100000)')
  assert.ok(muitos.rows.length <= 100)
})

test('estatísticas contam só aprovadas, por categoria', async () => {
  const antes = (await como('anon', null, 'select public.estatisticas_denuncias() as e')).rows[0].e
  await criarDenuncia()
  const semMudar = (await como('anon', null, 'select public.estatisticas_denuncias() as e')).rows[0].e
  assert.deepEqual(semMudar, antes)
  await como('authenticated', MODERADOR, `select public.moderar($1, 'aprovada', null)`, [await criarDenuncia()])
  const depois = (await como('anon', null, 'select public.estatisticas_denuncias() as e')).rows[0].e
  assert.equal(depois.total, antes.total + 1)
  assert.equal(depois.por_categoria.genero, (antes.por_categoria?.genero ?? 0) + 1)
})

test('limite de envios bloqueia depois do máximo e só o servidor usa', async () => {
  const consumir = () => como('service_role', null, `select public.consumir_limite('ip-1', 2, 3600) as ok`)
  assert.equal((await consumir()).rows[0].ok, true)
  assert.equal((await consumir()).rows[0].ok, true)
  assert.equal((await consumir()).rows[0].ok, false)
  await assert.rejects(como('anon', null, `select public.consumir_limite('ip-2', 2, 3600)`), /permission denied/)
})

test('limite recomeça quando a janela acaba', async () => {
  const consumir = () => como('service_role', null, `select public.consumir_limite('ip-3', 1, 3600) as ok`)
  assert.equal((await consumir()).rows[0].ok, true)
  assert.equal((await consumir()).rows[0].ok, false)
  await banco.query(`update public.limites set inicio = now() - interval '2 hours' where chave = 'ip-3'`)
  assert.equal((await consumir()).rows[0].ok, true)
})

test('banco recusa texto vazio ou longo demais mesmo vindo do servidor', async () => {
  await assert.rejects(como('service_role', null, `insert into public.denuncias (texto_anuncio, achados) values ('', '[]')`), /check/)
  await assert.rejects(como('service_role', null, `insert into public.denuncias (texto_anuncio, achados) values (repeat('a', 10001), '[]')`), /check/)
})
