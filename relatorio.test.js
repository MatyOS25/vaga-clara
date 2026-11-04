import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analisar } from './analisar.js'
import { montarRelatorio, resumir } from './relatorio.js'

test('relatório sem achados traz o aviso de leitura final', () => {
  assert.match(montarRelatorio([]), /Nenhum termo das regras foi encontrado/)
})

test('relatório lista trechos com nível, categoria, motivo e base legal', () => {
  const relatorio = montarRelatorio(analisar('Vaga para o sexo masculino, até 30 anos.'))
  assert.match(relatorio, /2 trechos para revisar/)
  assert.match(relatorio, /1\. \[Risco legal: Sexo\] "sexo masculino"/)
  assert.match(relatorio, /Restringe a vaga por sexo\./)
  assert.match(relatorio, /373-A/)
  assert.match(relatorio, /2\. \[Risco legal: Idade\] "até 30 anos"/)
})

test('relatório no singular com um achado só, sem base legal', () => {
  const relatorio = montarRelatorio(analisar('Exigimos boa aparência.'))
  assert.match(relatorio, /1 trecho para revisar/)
  assert.match(relatorio, /\[Vale revisar: Aparência\] "boa aparência"/)
  assert.doesNotMatch(relatorio, /Base:/)
})

test('relatório preserva a ordem dos trechos no anúncio', () => {
  const relatorio = montarRelatorio(analisar('Pele clara, sexo feminino.'))
  assert.ok(relatorio.indexOf('Pele clara') < relatorio.indexOf('sexo feminino'))
})

test('resumo orienta quando o campo está vazio ou sem achados', () => {
  assert.equal(resumir('   ', []), 'Cole um anúncio para começar a revisão.')
  assert.match(resumir('texto', []), /Nenhum termo das regras foi encontrado/)
})

test('resumo conta os achados por nível de risco', () => {
  const achados = analisar('Sexo feminino, boa aparência e perfil jovem.')
  assert.match(resumir('x', achados), /3 trechos para revisar: 2 com risco legal e 1 vale revisar/)
})

test('resumo no singular', () => {
  assert.match(resumir('x', analisar('Exigimos boa aparência.')), /1 trecho para revisar: 1 vale revisar/)
})
