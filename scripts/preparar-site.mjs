import { cpSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')

// Lista fechada: arquivo novo só vai ao ar se entrar aqui. preparar-site.test.js confere se nada faltou.
export const ARQUIVOS_DO_SITE = [
  'index.html',
  'mural.html',
  'moderacao.html',
  'estilo.css',
  'icone.svg',
  'app.js',
  'mural.js',
  'moderacao.js',
  'analisar.js',
  'regras.js',
  'relatorio.js',
  'busca.js',
  'plataforma.js',
  'config.js',
  'vendor/supabase.js',
]

export function prepararSite(destino = join(RAIZ, 'publico')) {
  rmSync(destino, { recursive: true, force: true })
  ARQUIVOS_DO_SITE.forEach((arquivo) => cpSync(join(RAIZ, arquivo), join(destino, arquivo)))
  return destino
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${prepararSite()}\n`)
}
