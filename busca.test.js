import { test } from 'node:test'
import assert from 'node:assert/strict'
import { linksDeVagas, linksDeAlerta, TERMOS_DE_ALERTA } from './busca.js'
import { analisar } from './analisar.js'

test('sem cargo não gera links', () => {
  assert.deepEqual(linksDeVagas({ cargo: '  ', cidade: 'Niterói' }), [])
  assert.deepEqual(linksDeAlerta({ cargo: '', cidade: '' }), [])
})

test('links de vagas levam cargo e cidade codificados para cada site', () => {
  const links = linksDeVagas({ cargo: ' Auxiliar & caixa ', cidade: 'Niterói' })
  assert.deepEqual(links.map((l) => l.nome), ['Indeed', 'LinkedIn', 'InfoJobs', 'Catho', 'Google'])
  const indeed = new URL(links[0].url)
  assert.equal(indeed.searchParams.get('q'), 'Auxiliar & caixa')
  assert.equal(indeed.searchParams.get('l'), 'Niterói')
  assert.equal(new URL(links[1].url).searchParams.get('keywords'), 'Auxiliar & caixa')
})

test('sites que só buscam por palavra recebem a cidade junto do cargo', () => {
  const links = linksDeVagas({ cargo: 'caixa', cidade: 'Niterói' })
  assert.equal(new URL(links[2].url).searchParams.get('palabra'), 'caixa Niterói')
  assert.equal(new URL(links[3].url).searchParams.get('q'), 'caixa Niterói')
  assert.equal(new URL(links[4].url).searchParams.get('q'), 'vagas caixa Niterói')
})

test('cidade é opcional', () => {
  const [indeed] = linksDeVagas({ cargo: 'caixa', cidade: '' })
  assert.equal(new URL(indeed.url).searchParams.get('l'), '')
  assert.equal(new URL(linksDeVagas({ cargo: 'caixa' })[4].url).searchParams.get('q'), 'vagas caixa')
})

test('links de alerta buscam termos entre aspas no último mês', () => {
  const links = linksDeAlerta({ cargo: 'recepcionista', cidade: 'Niterói' })
  assert.equal(links.length, Object.keys(TERMOS_DE_ALERTA).length)
  const sexo = new URL(links.find((l) => l.nome === 'Sexo').url)
  assert.equal(sexo.searchParams.get('tbs'), 'qdr:m')
  assert.equal(sexo.searchParams.get('q'), 'vaga recepcionista Niterói ("sexo feminino" OR "sexo masculino" OR "somente mulheres" OR "somente homens")')
})

test('todo termo de alerta é detectado pelo revisor', () => {
  Object.values(TERMOS_DE_ALERTA).flat().forEach((termo) => {
    assert.equal(analisar(`Vaga: ${termo}.`).length, 1, termo)
  })
})
