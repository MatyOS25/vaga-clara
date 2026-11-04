// Cada termo precisa ser detectado pelo revisor: busca.test.js confere isso.
export const TERMOS_DE_ALERTA = {
  Sexo: ['sexo feminino', 'sexo masculino', 'somente mulheres', 'somente homens'],
  Idade: ['idade máxima', 'perfil jovem', 'até 30 anos', 'até 35 anos'],
  Família: ['sem filhos', 'solteira', 'solteiro'],
  'Cor ou raça': ['pele clara', 'cabelo liso', 'traços finos'],
  Aparência: ['boa aparência'],
  Deficiência: ['não aceitamos PCD'],
}

const limpar = (valor) => (valor ?? '').trim()
const juntar = (...partes) => partes.filter(Boolean).join(' ')
const endereco = (base, parametros) => `${base}?${new URLSearchParams(parametros)}`

export function linksDeVagas({ cargo, cidade }) {
  const oQue = limpar(cargo)
  const onde = limpar(cidade)
  if (!oQue) return []
  const tudo = juntar(oQue, onde)
  return [
    { nome: 'Indeed', url: endereco('https://br.indeed.com/jobs', { q: oQue, l: onde }) },
    { nome: 'LinkedIn', url: endereco('https://www.linkedin.com/jobs/search/', { keywords: oQue, location: onde }) },
    { nome: 'InfoJobs', url: endereco('https://www.infojobs.com.br/empregos.aspx', { palabra: tudo }) },
    { nome: 'Catho', url: endereco('https://www.catho.com.br/vagas/', { q: tudo }) },
    { nome: 'Google', url: endereco('https://www.google.com/search', { q: juntar('vagas', tudo) }) },
  ]
}

export function linksDeAlerta({ cargo, cidade }) {
  const oQue = limpar(cargo)
  if (!oQue) return []
  return Object.entries(TERMOS_DE_ALERTA).map(([nome, termos]) => {
    const alternativas = termos.map((termo) => `"${termo}"`).join(' OR ')
    const q = `${juntar('vaga', oQue, limpar(cidade))} (${alternativas})`
    return { nome, url: endereco('https://www.google.com/search', { q, tbs: 'qdr:m' }) }
  })
}
