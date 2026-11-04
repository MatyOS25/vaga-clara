import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ARQUIVOS_DO_SITE, prepararSite } from './preparar-site.mjs'

const referenciasLocais = (arquivo, conteudo) => {
  const padroes = arquivo.endsWith('.html')
    ? [/(?:src|href)="(?!https?:|data:|mailto:|\.\/")([^"#]+)"/g]
    : [/from '\.\/([^']+)'/g]
  return padroes.flatMap((padrao) => [...conteudo.matchAll(padrao)].map((m) => m[1]))
}

test('toda página e script só referencia arquivos que vão ao ar', () => {
  ARQUIVOS_DO_SITE.filter((a) => /\.(html|js)$/.test(a) && !a.startsWith('vendor/')).forEach((arquivo) => {
    referenciasLocais(arquivo, readFileSync(arquivo, 'utf8')).forEach((referencia) => {
      assert.ok(ARQUIVOS_DO_SITE.includes(referencia), `${arquivo} usa ${referencia}, fora da lista`)
    })
  })
})

test('a pasta publicada leva só a lista, sem código de servidor ou dependências', () => {
  const destino = prepararSite(join(mkdtempSync(join(tmpdir(), 'site-')), 'publico'))
  const encontrados = readdirSync(destino, { recursive: true, withFileTypes: true })
    .filter((item) => item.isFile())
    .map((item) => join(item.parentPath, item.name).slice(destino.length + 1).replaceAll('\\', '/'))
    .sort()
  assert.deepEqual(encontrados, [...ARQUIVOS_DO_SITE].sort())
  assert.ok(!existsSync(join(destino, 'node_modules')))
})
