const INVISIVEIS = /[­​-‍⁠﻿]/g
const EMAIL = /[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@.,;:!?)]{1,63}/g
const EMAIL_DISFARCADO = /[\w.+-]{1,64}\s*(?:\(at\)|\[at\]|\barroba\b)\s*[\w-]{1,255}(?:\.[\w-]{1,63})*/gi
const LINK = /\b(?:https?:\/\/|www\.)\S{1,500}|\b(?:wa\.me|t\.me|bit\.ly)\/\S{1,500}/gi
const PERFIL = /(?<![\w@.])@[\w.]{2,30}/g
const CPF = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g
// Qualquer sequência com 8 dígitos ou mais, com ou sem separador: telefone, CPF, CEP.
const NUMERO_LONGO = /(?:\+|\(\s?)?\d(?:[\s.\-()]{0,3}\d){7,40}/g
const INTERVALO_DE_ANOS = /^(?:19|20)\d{2}[\s-]+(?:19|20)\d{2}$/
const EMPRESA_MINIMA = 3

const escapar = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const semEmpresa = (texto, empresa) => {
  const nome = (empresa ?? '').trim()
  if (nome.length < EMPRESA_MINIMA) return texto
  return texto.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapar(nome)}(?![\\p{L}\\p{N}])`, 'giu'), '[empresa]')
}

// Filtro de melhor esforço, antes de guardar: a moderação continua sendo a revisão final.
export const anonimizar = (texto, { empresa } = {}) =>
  semEmpresa(
    texto
      .normalize('NFKC')
      .replace(INVISIVEIS, '')
      .replace(LINK, '[link removido]')
      .replace(EMAIL, '[e-mail removido]')
      .replace(EMAIL_DISFARCADO, '[e-mail removido]')
      .replace(PERFIL, '[perfil removido]')
      .replace(CPF, '[CPF removido]')
      .replace(NUMERO_LONGO, (trecho) => (INTERVALO_DE_ANOS.test(trecho) ? trecho : '[telefone removido]')),
    empresa,
  )
