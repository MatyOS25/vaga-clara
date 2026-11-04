import { tratar } from '../../../servidor/http.js'
import { buscarVagas } from '../../../servidor/vagas.js'
import { ORIGENS, dentroDoLimite } from '../../../servidor/borda.js'

const BUSCAS_POR_HORA = 30

Deno.serve((pedido) =>
  tratar(pedido, {
    origens: ORIGENS,
    executar: async (corpo, original) => {
      if (!(await dentroDoLimite(Deno.env, original, 'vagas', BUSCAS_POR_HORA, 3600))) {
        return { status: 429, erro: 'Muitas buscas em pouco tempo. Tente de novo mais tarde.' }
      }
      return buscarVagas(corpo, { appId: Deno.env.get('ADZUNA_APP_ID'), appKey: Deno.env.get('ADZUNA_APP_KEY') })
    },
  }),
)
