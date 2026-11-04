import { tratar } from '../../../servidor/http.js'
import { prepararDenuncia } from '../../../servidor/denunciar.js'
import { ORIGENS, dentroDoLimite, gravarDenuncia } from '../../../servidor/borda.js'

const ENVIOS_POR_HORA = 5

Deno.serve((pedido) =>
  tratar(pedido, {
    origens: ORIGENS,
    executar: async (corpo, original) => {
      const { robo, erros, linha } = prepararDenuncia(corpo)
      // Ao robô respondemos como se tivesse dado certo, para ele não aprender a contornar.
      if (robo) return { status: 202, dados: { recebida: true } }
      if (Object.keys(erros).length > 0) return { status: 400, erro: Object.values(erros)[0] }
      if (!(await dentroDoLimite(Deno.env, original, 'denunciar', ENVIOS_POR_HORA, 3600))) {
        return { status: 429, erro: 'Muitos envios em pouco tempo. Tente de novo mais tarde.' }
      }
      await gravarDenuncia(Deno.env, linha)
      return { status: 202, dados: { recebida: true } }
    },
  }),
)
