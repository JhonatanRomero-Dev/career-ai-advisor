# Revisao de curriculo e jornada de candidatura

## Fluxo implementado

1. Abra uma analise e escolha **Editar curriculo e versoes**.
2. Edite o texto, escolha um trecho e solicite uma proposta. A proposta pode ser ajustada, aprovada ou descartada; ela nunca substitui o texto automaticamente.
3. Compare a versao aberta com o rascunho, salve uma nova versao e baixe o curriculo em PDF ou DOCX. O PDF do relatorio continua sendo uma exportacao separada.
4. Em Vagas, escolha **Adaptar curriculo**, selecione uma analise existente e revise os requisitos no editor. Ao salvar, a versao fica vinculada a vaga salva.
5. Em **Minha jornada**, abra **Candidatura** para editar etapa, data de envio, entrevista, anotacoes, proxima acao, versao e lembrete.

O sistema registra a versao vinculada quando a candidatura passa para enviada. Novos rascunhos nao substituem esse registro. A exclusao da versao remove sua disponibilidade, inclusive na candidatura.

Os lembretes aparecem dentro de Vagas quando vencem. Nao ha envio automatico por e-mail ou notificacao com o navegador fechado. A lista atualiza a cada minuto enquanto aberta.

As versoes salvas explicitamente sao independentes da retencao temporaria do texto extraido. Integram a exportacao de dados e sao removidas ao excluir a analise ou a conta. O editor indica quando o original ja nao esta disponivel.

## Qualidade da analise

Novas analises registram se foram produzidas por IA ou regras locais. Analises antigas mostram metodo desconhecido. Notas sao estimativas textuais, nao testes de um ATS especifico ou previsoes de entrevista.

Termos fracos e palavras-chave classificadas como encontradas precisam aparecer no curriculo. O relatorio mostra trechos reais para os termos fracos, obtidos do texto original enquanto ele estiver disponivel. A revisao por vaga instrui o modelo a preservar fatos e nao transformar requisitos da vaga em habilidades do candidato.

Comandos:

```text
npm run eval:ai
npm run eval:ai:live
npm run test:backend
npm run test:e2e
```

O primeiro comando avalia as regras locais. O segundo usa o provedor configurado, consome sua API e testa respostas reais com curriculos ficticios: contrato das notas, habilidades e termos com evidencia e ausencia de vagas inventadas. Provedor ausente, falha ou fallback fazem essa avaliacao falhar. Essa verificacao automatica nao substitui revisao humana de utilidade e fidelidade das sugestoes.

## Teste com 5 a 10 participantes

Recrute voluntarios com consentimento e diferentes momentos profissionais. A funcionalidade Feedback ja permite registrar interesse; nenhum convite e enviado automaticamente.

Em sessoes de aproximadamente 20 minutos, observe as tarefas de analisar, revisar/salvar, exportar e registrar uma candidatura. A pessoa registra cada tarefa como concluida, com dificuldade ou bloqueada na pagina Feedback. Pergunte onde hesitou, qual resultado esperava e se usaria o documento exportado. Nao solicite senhas ou codigos de acesso.

Priorize bloqueios recorrentes e confirme a correcao repetindo a tarefa com participantes. Sessoes reais e seus resultados dependem da participacao das pessoas; nao sao gerados pelos testes automatizados.

## Metricas

O painel administrativo apresenta pessoas que, no periodo selecionado, concluem em ordem: upload concluido, versao salva, curriculo exportado e candidatura marcada como enviada. Exportacoes fora dessa sequencia continuam nos eventos individuais, mas nao contam nas etapas seguintes do funil. Etapas podem corresponder a documentos diferentes da mesma pessoa.

O retorno conta uma nova abertura entre 24 horas e 7 dias depois da primeira abertura observada. O denominador inclui apenas pessoas cuja primeira abertura no periodo ja tem sete dias completos de observacao. Identificacao pseudonima, troca de navegador, limpeza de dados e opt-out podem afetar as contagens. A coleta respeita a preferencia existente e Do Not Track.

Eventos novos: resume_editor_opened, resume_revision_applied, resume_version_saved, resume_exported, job_adaptation_started e application_updated. Textos, nomes de versoes, notas e descricoes de vagas nao sao propriedades de analytics.
