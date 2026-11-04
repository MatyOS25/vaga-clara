import { build } from 'esbuild'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const FUNCOES = ['vagas', 'denunciar']

// Junta cada função em um arquivo só: a publicação não leva a pasta servidor/ junto.
export async function empacotar(destino = join(RAIZ, 'dist-funcoes')) {
  return Promise.all(
    FUNCOES.map(async (nome) => {
      const arquivo = join(destino, nome, 'index.mjs')
      await build({
        entryPoints: [join(RAIZ, 'supabase', 'functions', nome, 'index.js')],
        outfile: arquivo,
        bundle: true,
        format: 'esm',
        platform: 'neutral',
        target: 'es2022',
        charset: 'utf8',
        logLevel: 'silent',
      })
      return { nome, arquivo }
    }),
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const gerados = await empacotar()
  gerados.forEach(({ arquivo }) => process.stdout.write(`${arquivo}\n`))
}
