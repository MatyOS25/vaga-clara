import { tratar } from '../../../servidor/http.js'
import { prepararDenuncia } from '../../../servidor/denunciar.js'
import { origens, respeitaLimites, gravarDenuncia } from '../../../servidor/borda.js'

const LIMITES = { porIp: 10, porDia: 200 }

Deno.serve((pedido) =>
  tratar(pedido, {
    origens: origens(Deno.env),
    executar: async (corpo, original) => {
      // O limite vem antes da análise, a parte cara do pedido.
      if (!(await respeitaLimites(Deno.env, original, 'denunciar', LIMITES))) {
        return { status: 429, erro: 'Muitos envios em pouco tempo. Tente de novo mais tarde.' }
      }
      const { robo, erros, linha } = prepararDenuncia(corpo)
      // Ao robô respondemos como se tivesse dado certo, para ele não aprender a contornar.
      if (robo) return { status: 202, dados: { recebida: true } }
      if (Object.keys(erros).length > 0) return { status: 400, erro: Object.values(erros)[0] }
      await gravarDenuncia(Deno.env, linha)
      return { status: 202, dados: { recebida: true } }
    },
  }),
)
