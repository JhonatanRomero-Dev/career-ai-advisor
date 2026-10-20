# Melhorias do produto

## Funcionalidades

- **Vagas:** combinações de palavra-chave/cargo, cidade, área, nível, empresa, fonte, contrato, modalidade, salário, data e compatibilidade. Ordenação por compatibilidade, data, salário, cargo ou empresa. Opções mostram contagens para os filtros atuais. Pesquisas nomeadas ficam no banco por conta (até 30), e as 10 buscas recentes podem ser retomadas ou apagadas.
- **Busca inteligente:** a partir de 2 caracteres, consulta novas vagas por palavra-chave após 450 ms sem digitação, mesmo sem currículo analisado. Enter, o botão Buscar, sugestões e pesquisas salvas também acionam a busca. O endpoint autenticado `GET /api/jobs/search?q=React&location=Curitiba` consulta as fontes integradas e combina os anúncios encontrados com as recomendações já carregadas; a aba Minha jornada filtra somente as vagas salvas. Consultas repetidas compartilham cache e respostas de termos anteriores não substituem a busca atual. Cargos são comparados com o título, e competências e empresas também podem ser pesquisadas. Sugestões toleram erros de digitação e têm navegação por teclado. Os destaques representam apenas as vagas carregadas, não todo o mercado. Anúncios sem análise de currículo aparecem como encontrados por palavra-chave, sem percentual inventado de compatibilidade; links para buscas externas ficam separados dos novos anúncios.
- **Salário:** valores em BRL com período explícito. Salários anuais são divididos por 12 para comparação; valores sem moeda/período não são presumidos. Nem todas as fontes fornecem esses dados. Modalidade desconhecida não é tratada como presencial. Área e senioridade podem ser inferidas pelo texto do anúncio.
- **Perfil:** competências, GitHub, experiências, projetos, certificados e conquistas, com descrição, organização, datas e links. Prévia profissional e publicação opcional em `/p/:publicId`. O link só funciona depois de ativar a opção e salvar. Desativar e salvar retira o acesso imediatamente. A API pública usa uma lista explícita de campos e omite telefone, e-mail e identificadores da conta.
- **Foto de perfil:** adicionar, trocar ou remover a foto, com prévia antes de Salvar perfil. Aceita JPG, PNG e WebP de até 5 MB; o navegador recorta ao centro e converte para JPEG de até 512 × 512 pixels, sem os metadados do arquivo original. A API valida o formato, tamanho e dimensões, e a imagem fica no perfil da conta no banco. Ela aparece também no menu e, quando a publicação está ativada, no perfil público. Sem foto, o avatar mostra as iniciais.
- **Habilidades:** autocomplete a partir de três caracteres (`PYT` sugere Python e PyTorch), com seleção por clique, setas e Enter. Reconhece maiúsculas, acentos e aliases como `nodejs`; evita duplicatas e permite habilidades próprias. As escolhas ficam em etiquetas removíveis e são persistidas ao salvar o perfil.
- **Login:** Google e LinkedIn preservados; GitHub implementado com e-mail verificado, inclusive quando o e-mail principal é privado. O navegador exibe a disponibilidade dos provedores. O retorno OAuth valida estado assinado, expiração e vínculo com o navegador. Login por e-mail, código, recuperação de senha e revogação de sessões continuam disponíveis.
- **Feedback:** avaliação de 1 a 5 estrelas, categoria, relato, momento profissional opcional, interesse voluntário em testes e resultados por tarefa. Cada usuário acompanha seus envios. Administradores podem revisar e marcar como recebido, em análise, planejado ou resolvido.
- **Suporte:** base de conhecimento do produto, orientação concreta mesmo sem provedor de IA, links para as telas relevantes, mensagens limitadas a 1.200 caracteres e avaliação por resposta. Métricas administrativas incluem tempo médio, respostas locais e utilidade. O servidor guarda métricas e avaliações, sem persistir o conteúdo das conversas nessa funcionalidade. O histórico do chat continua no navegador, separado por conta.

Os novos dados integram a exportação e a exclusão da conta existentes. As tabelas SQLite são criadas automaticamente na inicialização, sem apagar dados anteriores.

## Configuração de login social

Configure no `backend/.env` os pares `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` e `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`.

Cadastre no respectivo provedor a URL de retorno correspondente ao backend. Exemplos locais:

```text
http://localhost:3000/api/auth/oauth/google/callback
http://localhost:3000/api/auth/oauth/linkedin/callback
http://localhost:3000/api/auth/oauth/github/callback
```

Em implantação, ajuste `FRONTEND_URL`, `CORS_ORIGIN`, `OAUTH_REDIRECT_BASE_URL` e `OAUTH_STATE_SECRET`, conforme a configuração existente. Google, LinkedIn e GitHub só ficam disponíveis quando ambos os campos do provedor estão preenchidos. Isso indica configuração presente, não certifica a validade das credenciais. Configure SMTP para entregar códigos de login e recuperação a usuários reais.

A implementação GitHub segue a [documentação de autorização OAuth](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps) e o [endpoint de e-mails verificados](https://docs.github.com/en/rest/users/emails). A validação automatizada simula o provedor; o login completo com uma conta real exige credenciais válidas.

## Roteiro de testes com pessoas

1. Convide, com autorização, pessoas em primeiro emprego, transição de carreira, profissionais experientes e recrutadores. Use os interessados registrados em Feedback para formar grupos; nenhum convite é enviado automaticamente.
2. Explique o objetivo e peça que verbalizem o que esperam encontrar. Reserve cerca de 20 minutos por sessão. Não peça senhas nem códigos.
3. Peça para localizar uma vaga e salvar uma pesquisa com dois filtros; adicionar uma habilidade e projeto ao perfil; avaliar login/recuperação; e pedir uma orientação ao suporte.
4. Registre se cada tarefa foi concluída sem dificuldade, com dificuldade ou se ficou bloqueada. Anote o ponto de bloqueio e o comportamento esperado. A tela Feedback já oferece essas tarefas e campos.
5. Na área administrativa, priorize bloqueios de tarefas, recorrência dos relatos, avaliações baixas e respostas do suporte pouco úteis. Agrupe relatos semelhantes antes de planejar uma correção.
6. Marque o andamento do feedback, implemente a correção e repita a tarefa com os participantes para verificar se a dificuldade foi resolvida. Não marque como resolvido apenas por receber o relato.

Testes automatizados não substituem sessões com usuários reais. Recrutamento, sessões e análise de relatos reais ainda dependem da participação das pessoas.

## Validação

```bash
npm run lint
npm run typecheck
npm run build:check
npm run test:backend
npm run test:e2e
```

No PowerShell com scripts bloqueados, use `npm.cmd` nos mesmos comandos.

`backend/tests/product-improvements.test.js` verifica filtros combinados, salários, localização, sugestões, persistência, isolamento entre contas, validação de payloads, proteção CSRF, perfil público, feedback administrativo, qualidade da resposta local, avaliações e OAuth GitHub.

`tests/e2e/product-improvements.spec.js` percorre vagas, perfil público, feedback e suporte nos projetos desktop e mobile. As vagas usadas nesses testes são fixtures; cadastro, salvamento de pesquisas, perfil, feedback e suporte usam a API de teste e banco isolado. Os testes também verificam ausência de rolagem horizontal e acessibilidade do conteúdo de feedback.
