import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analisar } from './analisar.js'
import { montarRelatorio, montarDenuncia, resumir } from './relatorio.js'

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

test('sem achados não há denúncia a fazer', () => {
  assert.equal(montarDenuncia([]), null)
})

test('denúncia traz trechos, categorias, bases legais e campos para preencher', () => {
  const denuncia = montarDenuncia(analisar('Sexo feminino, até 30 anos.'))
  assert.match(denuncia, /1\. "Sexo feminino" — Restringe a vaga por sexo\. \(Sexo\)/)
  assert.match(denuncia, /2\. "até 30 anos" — Limita a vaga por idade\. \(Idade\)/)
  assert.match(denuncia, /373-A/)
  assert.match(denuncia, /Empresa: \[preencher\]/)
  assert.match(denuncia, /Site ou local onde foi publicada: \[preencher\]/)
})

test('denúncia omite a linha de base quando a regra não cita lei', () => {
  const denuncia = montarDenuncia(analisar('Exigimos boa aparência.'))
  assert.doesNotMatch(denuncia, /CLT|Lei /)
})
