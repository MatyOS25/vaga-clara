const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@.,;:!?)]+/g
// Onze dígitos soltos são quase sempre celular; sem pontuação, só vira CPF quando vem depois da palavra.
const CPF = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|(?<=CPF\D{0,5})\d{11}\b/gi
const TELEFONE = /(?:\+?55[\s-]?)?(?:\(\d{2}\)|\b\d{2})[\s-]?(?:9\s?)?\d{4}[\s-]?\d{4}\b/g

// Roda antes de guardar: o mural público não pode expor contato de ninguém.
export const anonimizar = (texto) =>
  texto
    .replace(EMAIL, '[e-mail removido]')
    .replace(CPF, '[CPF removido]')
    .replace(TELEFONE, '[telefone removido]')
