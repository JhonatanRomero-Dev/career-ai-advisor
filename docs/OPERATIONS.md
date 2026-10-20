# Operação e resposta a incidentes

## Indicadores mínimos

- Disponibilidade de `/api/health/ready` e latência p95 da API.
- Fila de análises parada, tentativas e taxa de falha/fallback da IA.
- Webhooks `failed` ou `review_required`, assinaturas `past_due` e divergência de valor.
- Conversão cadastro → análise → vaga aberta → checkout → assinatura ativa.

Alertas devem usar `x-request-id` para correlacionar logs. Nunca registrar currículo, token, código de autenticação ou payload completo de usuário no alerta.

## Backup SQLite

Execute `npm run backup` no diretório `backend`. O comando valida o banco, cria um snapshot consistente com `VACUUM INTO` e valida novamente o arquivo criado. Copie os backups para armazenamento externo criptografado e teste restauração mensalmente.

Restauração exige janela de manutenção: pare a API, preserve o banco atual, valide o snapshot com `PRAGMA integrity_check`, substitua o arquivo explicitamente configurado em `SQLITE_DB_PATH` e execute smoke tests antes de reabrir o tráfego. Não restaure sobre um processo ativo.

## Pagamentos

No Mercado Pago, habilite `payment`, `subscription_preapproval` e `subscription_authorized_payment`. Em caso de divergência, não ative manualmente antes de conferir `external_reference`, valor, moeda e ID da assinatura. Webhooks são idempotentes e podem ser reenviados.

## Incidentes

1. Ative manutenção em `public/maintenance.json` se houver risco de corrupção ou cobrança incorreta.
2. Registre início, impacto, request IDs e decisões sem dados sensíveis.
3. Contenha o problema (pausar deploy/worker ou desabilitar o provedor afetado).
4. Corrija, rode a suíte completa e monitore recuperação.
5. Produza revisão sem culpabilização, com ações, responsáveis e prazo.

## Rotação e retenção

- Rotacione segredos de autenticação, analytics, SMTP, IA e Mercado Pago por procedimento controlado.
- Retenha eventos de produto somente pelo período necessário; eles não contêm e-mail nem conteúdo do currículo.
- Execute semanalmente a auditoria de dependências e CodeQL configurados em `.github/workflows/security.yml`.
