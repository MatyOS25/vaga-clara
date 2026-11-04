import { tratar } from '../../../servidor/http.js'
import { buscarVagas } from '../../../servidor/vagas.js'
import { origens, respeitaLimites } from '../../../servidor/borda.js'

// O teto diário fica abaixo da cota gratuita informada para a chave da fonte de vagas.
const LIMITES = { porIp: 30, porDia: 200 }

Deno.serve((pedido) =>
  tratar(pedido, {
    origens: origens(Deno.env),
    executar: async (corpo, original) => {
      if (!(await respeitaLimites(Deno.env, original, 'vagas', LIMITES))) {
        return { status: 429, erro: 'Muitas buscas em pouco tempo. Tente de novo mais tarde.' }
      }
      return buscarVagas(corpo, { appId: Deno.env.get('ADZUNA_APP_ID'), appKey: Deno.env.get('ADZUNA_APP_KEY') })
    },
  }),
)
