import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analisar } from './analisar.js'
import { montarRelatorio } from './relatorio.js'

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
