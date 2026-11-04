import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analisar, segmentar } from './analisar.js'

const ids = (texto) => analisar(texto).map((a) => a.categoria)
const trechos = (texto) => analisar(texto).map((a) => a.trecho)

test('anúncio neutro não gera nenhum achado', () => {
  assert.deepEqual(analisar('Buscamos pessoa desenvolvedora com experiência em JavaScript.'), [])
})

test('texto vazio não gera achado', () => {
  assert.deepEqual(analisar(''), [])
})

test('acha termo mesmo com caixa diferente e sem acento, preservando o trecho original', () => {
  assert.deepEqual(trechos('Exigimos BOA APARENCIA.'), ['BOA APARENCIA'])
  assert.deepEqual(trechos('Exigimos boa aparência.'), ['boa aparência'])
})

test('posições apontam para o trecho exato no texto', () => {
  const texto = 'Exigimos boa aparência e foco.'
  const [achado] = analisar(texto)
  assert.equal(texto.slice(achado.inicio, achado.fim), 'boa aparência')
})

test('acento decomposto (NFD) não desloca as posições', () => {
  const texto = 'Exigimos boa aparência e foco.'.normalize('NFD')
  const [achado] = analisar(texto)
  assert.equal(achado.trecho, 'boa aparência')
})

test('não casa pedaço de palavra', () => {
  assert.deepEqual(analisar('Trabalho com casadores de padrões e rapazinhos não.').filter((a) => a.trecho === 'casado'), [])
  assert.deepEqual(ids('Atuar com casados de uso em testes'.replace('casados', 'descasados')), [])
})

test('exigência de sexo é proibida e cita a CLT', () => {
  const [achado] = analisar('Vaga para o sexo masculino.')
  assert.equal(achado.categoria, 'genero')
  assert.equal(achado.nivel, 'proibida')
  assert.match(achado.base, /373-A/)
})

test('idade: limite é apontado', () => {
  assert.deepEqual(ids('Candidatos com até 35 anos.'), ['idade'])
  assert.deepEqual(ids('Idade entre 20 e 35 anos.'), ['idade'])
  assert.deepEqual(ids('Procuramos perfil jovem.'), ['idade'])
})

test('idade: tempo de experiência, maioridade e jovem aprendiz não são apontados', () => {
  assert.deepEqual(analisar('Até 10 anos de experiência em vendas.'), [])
  assert.deepEqual(analisar('Ter mais de 18 anos.'), [])
  assert.deepEqual(analisar('Programa jovem aprendiz.'), [])
})

test('situação familiar e gravidez são apontadas', () => {
  assert.deepEqual(ids('Preferência por solteiras sem filhos.'), ['familia', 'familia'])
  assert.deepEqual(ids('Pedimos teste de gravidez.'), ['familia'])
})

test('cor e traços físicos são apontados', () => {
  assert.deepEqual(ids('Pessoa de pele clara e cabelo liso.'), ['raca', 'raca'])
})

test('deficiência e religião são apontadas', () => {
  assert.deepEqual(ids('Não aceitamos PCD.'), ['deficiencia'])
  assert.deepEqual(ids('De preferência evangélico.'), ['religiao'])
})

test('vaga afirmativa não é apontada, mas outra frase do mesmo texto é', () => {
  assert.deepEqual(analisar('Vaga afirmativa exclusiva para mulheres.'), [])
  assert.deepEqual(analisar('Esta é uma ação afirmativa: apenas mulheres.'), [])
  assert.deepEqual(trechos('Vaga afirmativa para mulheres. Exigimos boa aparência.'), ['boa aparência'])
  assert.deepEqual(trechos('Apenas mulheres. Depois haverá ação afirmativa.'), ['Apenas mulheres'])
})

test('achados saem em ordem e sem sobreposição', () => {
  const achados = analisar('Pele clara, sexo feminino, até 30 anos.')
  assert.deepEqual(achados.map((a) => a.inicio), [...achados.map((a) => a.inicio)].sort((a, b) => a - b))
  achados.slice(1).forEach((a, i) => assert.ok(a.inicio >= achados[i].fim))
})

test('segmentar reconstrói o texto e separa os achados', () => {
  const texto = 'Exigimos boa aparência e foco.'
  const partes = segmentar(texto, analisar(texto))
  assert.equal(partes.map((p) => p.texto).join(''), texto)
  assert.deepEqual(partes.map((p) => Boolean(p.achado)), [false, true, false])
})

test('segmentar sem achados devolve o texto inteiro', () => {
  assert.deepEqual(segmentar('Olá', []), [{ texto: 'Olá' }])
  assert.deepEqual(segmentar('', []), [])
})

test('venda casada não é estado civil', () => {
  assert.deepEqual(analisar('Sem venda casada de produtos.'), [])
  assert.deepEqual(ids('Pessoa casada.'), ['familia'])
})

test('frase inclusiva sobre deficiência não é apontada', () => {
  assert.deepEqual(analisar('Vagas para pessoas com ou sem deficiência.'), [])
  assert.deepEqual(ids('Somente pessoas sem deficiência.'), ['deficiencia'])
})

test('variações comuns de restrição por sexo são apontadas', () => {
  for (const texto of ['Vaga para mulheres', 'Vaga para homens', 'Apenas para mulheres', 'Somente para homens', 'Exclusivo para homens', 'Sexo: feminino', 'Preferência por mulheres', 'Preferência por candidatas']) {
    assert.deepEqual(ids(texto), ['genero'], texto)
  }
})

test('tempo de experiência não é confundido com idade', () => {
  for (const texto of ['Experiência de até 10 anos em vendas', 'Até 15 anos na função', 'Entre 10 e 15 anos de experiência', 'Menos de 10 anos de experiência']) {
    assert.deepEqual(analisar(texto), [], texto)
  }
})

test('variações comuns de limite de idade são apontadas', () => {
  for (const texto of ['Idade: 18 a 35 anos', 'Procuramos jovens dinâmicos', 'Ter menos de 35 anos']) {
    assert.deepEqual(ids(texto), ['idade'], texto)
  }
})

test('cor de uniforme não é tratada como raça, mas cor da pele é', () => {
  assert.deepEqual(analisar('Uniforme: camisa de cor branca.'), [])
  assert.deepEqual(ids('Pessoa de pele branca.'), ['raca'])
})

test('vendas casadas no plural não é estado civil', () => {
  assert.deepEqual(analisar('Evitar vendas casadas.'), [])
})

test('apresentação de resultados não é aparência', () => {
  assert.deepEqual(analisar('Boa apresentação de resultados.'), [])
  assert.deepEqual(ids('Ter boa apresentação.'), ['aparencia'])
})

test('afirmativa negada não isenta a restrição', () => {
  assert.deepEqual(ids('Esta não é uma vaga afirmativa, apenas homens.'), ['genero'])
})

test('afirmativa vale com espaço duplo, valor em reais e título em outra linha', () => {
  assert.deepEqual(analisar('Vaga  afirmativa: apenas mulheres.'), [])
  assert.deepEqual(analisar('Vaga afirmativa: salário R$ 1.500, apenas mulheres.'), [])
  assert.deepEqual(analisar('Vaga afirmativa\nExclusiva para mulheres.'), [])
})

test('orientação sexual ou identidade de gênero como critério é apontada', () => {
  assert.deepEqual(ids('Não aceitamos pessoas trans.'), ['orientacao'])
  assert.deepEqual(ids('Somente héteros.'), ['orientacao'])
  assert.match(analisar('Não aceitamos gays.')[0].base, /7\.716/)
})

test('exigir nacionalidade é discriminar por origem', () => {
  assert.deepEqual(ids('Não aceitamos estrangeiros.'), ['origem'])
  assert.deepEqual(ids('Somente brasileiros natos.'), ['origem'])
})

test('altura mínima vale revisar', () => {
  assert.deepEqual(ids('Altura mínima de 1,65m.'), ['aparencia'])
})

test('"no máximo X anos" é limite de idade, exceto como experiência', () => {
  assert.deepEqual(ids('No máximo 40 anos.'), ['idade'])
  assert.deepEqual(analisar('No máximo 10 anos de experiência.'), [])
})
