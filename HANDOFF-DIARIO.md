# Diário de Bordo — handoff

**De:** Leandro Bengochea · **Para:** Mattheus Faleiro · **Data:** 22/09/2026

Estado: **em produção desde 18/09/2026**, usado pelos 23 farmers dos quatro times.

---

## 1. O que é

Ferramenta de planejamento diário da carteira do farmer, replicando o ritual do diário do time comercial. Três ideias sustentam o desenho:

1. **A lista é o compromisso, não uma sugestão.** O farmer não escolhe quais empresas atacar — recebe 20 por dia (+3 extras) e decide *como* abordar cada uma.
2. **Planejar e registrar é manual; acompanhar é automático.** De manhã o farmer define a abordagem. Ao longo do dia, a efetividade é derivada da atividade registrada no HubSpot, sem ninguém digitar duas vezes.
3. **Problema aparece onde alguém resolve.** Empresa travada, ticket atrasado e carteira errada sobem para o líder com contexto e um botão de ação — não viram relatório para ninguém ler.

## 2. Onde vive

| | |
|---|---|
| Repositório | `github.com/leandrobengochea-boop/farmers-dashboard`, branch `main` |
| Rota | `/diario` dentro do farmers-dashboard (mesmo projeto Vercel, `prj_fOibzn6jaCrImvz4GvOALSiJlx3Q`) |
| Link | `https://farmers-dashboard-git-main-leandrobengochea-boops-projects.vercel.app/diario` |
| Banco | Neon/Vercel Postgres (`DATABASE_URL`) |
| CRM | HubSpot REST API v3/v4 com private app token (`HUBSPOT_PAT`) |

> **O link é longo de propósito?** Não. É o alias da branch `main`, que funciona. O alias curto dá `redirect_uri_mismatch` porque a URI cadastrada no Google para ele ficou corrompida. Encurtar exige recadastrar `https://NOVO/api/diario/auth/callback` no Google Cloud Console. Ficou parado.

## 3. Quem entra e o que vê

Login é **só Google**, domínio `@profissionaissa.com`. Não existe senha nem PIN. O e-mail é resolvido no dono da carteira pela lista de owners do HubSpot.

| Papel | Vê |
|---|---|
| Farmer | a própria carteira e o próprio dia |
| Líder de time | os farmers da própria formação |
| Gerência | os 23 farmers dos quatro times |

Gerência hoje: Leandro `80454585`, Márcio Spagnolo `80436289`, Ana Machado `86256444`, **Mattheus Faleiro `91810791`**.

> ⚠️ **Seu login tem um detalhe.** No HubSpot seu owner está cadastrado como `mattheus.santos@profissionaissa.com`, mas você entra com `mattheus.faleiro@`. O mapa `EMAIL_DO_DIARIO` (em `lib/diario/constants.ts`) cobre isso. Ao incluir alguém novo, **confira na API de owners qual e-mail está cadastrado** — não presuma que é o do Google, ou o login morre em "conta não vinculada a uma carteira".

## 4. As telas

Quatro abas, definidas em `components/diario/Cabecalho.tsx` (adicionar uma é uma linha no array `ABAS`).

### Agenda do dia — `/diario/agenda`
Para líder e gerência. O farmer vê a mesma tela como **"Meu dia"**.

Duas vistas: **Hoje** (um card por farmer, com placar e as empresas) e **Evolução** (o gráfico). Gerência tem chips de filtro por time, pelo nome do líder.

Painéis que sobem ao topo quando existem:
- **Pedidos de auxílio** (laranja) — empresa com 3 tentativas sem contato. O líder escreve uma orientação que aparece no card da empresa para o farmer.
- **Trocas de segmento** (vermelho) — empresa na carteira errada, esperando decisão.

### Diário de bordo — `/diario`
A lista do dia do farmer, em duas abas: **Plano do dia** (abordagem + contexto, de manhã) e **Fechamento** (resultado + observação).

### Tramitações — `/diario/tramitacoes`
Os tickets de CS que pedem ação hoje, com baixa em duas mãos: o farmer marca, o líder **confirma ou nega**.

### Como funciona — `/diario/ajuda`
Documentação das regras para o time. **Ela lê as constantes do código** (cotas, cooldowns, prazos, resultados), então afinar uma regra atualiza o texto junto. Não editar números à mão lá.

## 5. As regras

### Composição do dia
5 recompra + 3 nutrição + 12 reativação = **20 empresas**, mais 3 extras "entre eventos" fora da conta. Baldes por tempo desde a última compra: até 3 meses = entre eventos · 3 a 8 = nutrição · 8 a 12 = recompra · 12+ = reativação.

A lista é gerada **na primeira abertura do dia e congela** — dar refresh não reembaralha. Se um balde não tem empresas suficientes, a cascata completa (reativação → nutrição → recompra → primeiro contato) para nunca entregar menos de 20.

> **Por que existe cooldown:** numa carteira típica de ~296 empresas, só ~37% têm histórico de compra. Sem descanso, o pool elegível inteiro se esgota em cerca de uma semana e o farmer recebe a mesma lista toda vez. Ao mexer em `COTA_DIARIA`, recalcule se o pool sustenta o ritmo.

### Negociações no funil B2B
Empresa com negócio aberto **não entra na lista de abordagem** — já existe conversa na mesa. As que estão nas quatro etapas ativas do funil B2B aparecem num bloco à parte no diário, com a etapa e há quantos dias estão nela. Passando de 15 dias sem mudar de etapa, a negociação entra como **extra do dia** (abordagem `ACOMPANHAR NEGOCIAÇÃO`), na frente de "entre eventos".

> ⚠️ **Os ids das etapas do funil B2B são mentirosos.** O funil foi montado sobre o pipeline padrão do HubSpot e ninguém trocou os ids: `closedwon` é **"Proposta enviada"** e `closedlost` é **"Em negociação"** — ambas etapas ABERTAS. Nunca deduza o significado pelo id; use `ETAPAS_FUNIL_ATIVO` em `lib/diario/constants.ts`.

> **O responsável pelo negócio nem sempre é o dono da empresa.** Das 54 negociações paradas medidas em 25/09, **37 estavam em empresas da carteira de outra pessoa**. Os extras seguem o `sdrfarmer_responsavel` do negócio, não o dono da empresa: quem negocia é quem acompanha. Puxar da carteira mostraria só 15 das 54.

### Quando a empresa volta
| Último resultado | Volta em |
|---|---|
| Não abordei | 1 dia |
| Tentei, sem sucesso | 3 dias |
| Contato efetivo | 30 dias |
| Dia sem fechamento | 1 dia (trata como não abordada) |
| Trocar de segmento | **não volta** até o líder decidir |

O "dia sem fechamento volta amanhã" é proposital: senão bastaria não fechar o dia para zerar a lista.

### Auxílio do líder
Três tentativas frustradas seguidas dão à empresa o selo **AUXÍLIO DO LÍDER**. Ela **não sai do rodízio** — continua na lista, vai na frente do próprio balde, e o líder responde com uma orientação que aparece no card.

> A primeira versão tirava a empresa da lista e mandava para uma lista do líder. Estava errado: tirava o problema de onde ele é trabalhado. Se for mexer nisso, é bom saber que já tentamos.

### Trocar de segmento
Resultado em vermelho, **fora do placar**. A empresa está na carteira errada; o pedido vai para o líder, que troca no HubSpot ou devolve a empresa ao rodízio.

> Existe porque farmers marcavam **contato efetivo** só para a empresa parar de aparecer — inflando a efetividade de todo mundo. O caminho honesto tinha que ser mais fácil que o desvio.

### Observação obrigatória
Mínimo **50 caracteres**, exigida em *contato efetivo* (o que saiu da conversa), *não abordei* (por quê) e *trocar de segmento* (para onde ela deveria ir). Em *tentativa* não se pede: a ligação registrada no CRM já é a evidência.

### Tramitações
Três pendências calculadas das datas do HubSpot (pipeline CS `748675953`):

| Pendência | Prazo |
|---|---|
| Enviar minuta contratual | 1 dia útil após a realização do onboarding |
| Assinatura do contrato | 20 dias após o onboarding (só entra na lista faltando 5) |
| Checklist do evento | 2 dias antes do evento |

Tickets já em **Pagamento pós-palestra** ou **Aguardando NF palestrante** não entram: o evento aconteceu, e o que resta é nota e pagamento — trabalho do CS. (Eles continuam contando no cartão "Tickets ativos", que mede execução do CS, não tramitação do farmer.)

Baixa em duas mãos: o farmer marca como feito, fica com o selo AGUARDANDO LÍDER e só sai quando o líder confirma. **Negar** devolve a pendência ao board com o prazo original — vencida volta vencida — com o selo DEVOLVIDA PELO LÍDER e o motivo no card. Exceção: assinatura baixa sozinha quando `status_do_contrato = Assinado`, o que também baixa a minuta.

### Selo de relacionamento
Empresa onde o proprietário **atual** registrou um negócio **e** já realizou 2+ reuniões do tipo "Reunião de Relacionamento". Raro de propósito: 11 empresas no time inteiro. Provavelmente reflete sub-registro do tipo de atividade, não a realidade — decisão consciente de manter raro.

## 6. O que é automático

`lib/diario/atividade.ts` lê ligações, reuniões, e-mails e notas do farmer no dia e propõe o resultado por empresa:

- ligação com disposição conectada, ou reunião realizada → **efetivo**
- sem resposta, ocupado, caixa postal → **tentativa**
- **mensagem de WhatsApp → tentativa, nunca efetivo** (ver abaixo)
- nenhuma atividade → fica em branco
- a anotação da ligação (`hs_call_body`) vira a observação

> **WhatsApp é o objeto `communications`, não `calls`.** A automação grava a conversa ali, com `hs_communication_channel_type = WHATS_APP` — foi um ponto cego do diário até 23/09. São ~780 mensagens/dia no time, tocando 139 empresas, 47 delas na lista do dia.
>
> Fica sempre como **tentativa** porque **não existe campo de direção no HubSpot** (verifiquei as 55 propriedades do objeto). O único sinal é o HTML que a automação escreve, e ele aparece em pelo menos três formatos — inclusive export de WhatsApp com o nome de perfil do próprio farmer ("Curador de Palestras na PSA"), que um detector lê como estranho. Três tentativas de classificar a resposta do cliente deram 786, 21 e 444 positivos sobre a mesma base de ~930 registros: nenhuma confiável.
>
> **Para destravar isso, a correção é na automação, não no código:** gravar a direção num campo (ou separar mensagem recebida de enviada em tipos distintos). Aí "cliente respondeu → efetivo" vira uma leitura de campo.

Isso roda em `/api/diario/dia` **e** em `/api/diario/agenda` — o placar do líder evolui sem o farmer reabrir a tela. **Nunca sobrescreve escolha feita à mão:** só preenche campo vazio.

> **Consequência a vigiar:** a qualidade do dado agora depende do farmer marcar a disposição certa da ligação. Quem encerra sem escolher "Conectado" aparece como tentativa mesmo tendo falado com o cliente. Se aparecer, o ajuste é de processo no HubSpot, não de código.

## 7. O relatório de Evolução — leia antes de cobrar alguém

Barra de 100% por dia com a composição das empresas setadas: **efetivo / tentativa / não abordei / sem registro**. O número grande é **contato efetivo sobre as empresas setadas**, não sobre as preenchidas.

A escolha do denominador foi discutida e é opinativa. Medir só o que foi preenchido premiaria quem trabalha menos (atacar 3 das 20 e conectar em 2 daria 67%). Em troca, a faixa cinza de "sem registro" fica visível, porque é ela que explica o número.

**O que os dados de 21/09 mostraram, e que muda como o gráfico deve ser lido:**

| time | % sobre setadas | % sobre preenchidas | sem registro |
|---|---|---|---|
| Camila | 35% | 42% | 17% |
| Letícia | 20% | 38% | 48% |
| Katyeli | 19% | 22% | 13% |
| Daniel | 8% | 33% | 75% |

As duas leituras **invertem o ranking**. Daniel sai de último para terceiro; Katyeli, que preencheu 87% da lista, parece pior do que é.

A causa está fora do diário: **43% de todo o trabalho registrado no HubSpot naquele dia foi em empresa fora das 20** (146 dentro, 108 fora). Alguns trabalham quase só fora — uma farmer registrou atividade em 8 empresas, nenhuma da lista dela.

**Ou seja: o número mede aderência à lista tanto quanto capacidade de conectar.** Isso pode ser exatamente o que se quer cobrar — desde que seja lido assim, e não como "esse time não sabe ligar".

## 8. Mapa do código

```
app/diario/                     telas (page.tsx por rota)
app/api/diario/                 12 rotas
  dia · agenda · item · briefing · orientacao
  tramitacoes · troca · evolucao · resumo
  auth/google · auth/callback · logout
components/diario/              DiarioClient · AgendaClient · TramitacoesClient
                                Evolucao · Cabecalho · LoginForm · Marca
lib/diario/
  constants.ts    ⭐ regras, cotas, prazos, times, líderes, mapas de exceção
  carteira.ts     busca a carteira no HubSpot e monta a lista do dia
  atividade.ts    deriva a efetividade da atividade do CRM
  tramitacoes.ts  calcula as pendências dos tickets
  relacionamento.ts  selo
  metrics.ts      números do mês (cabeçalho)
  db.ts           Postgres + driver local em JSON
  google.ts       OAuth e e-mail → owner
  session.ts      cookie assinado (HMAC)
```

**`lib/diario/constants.ts` é o arquivo que importa.** Quase toda regra de negócio está lá, e a página de ajuda lê dele.

### Tabelas
`diario_item` · `diario_briefing` · `diario_orientacao` · `diario_troca_segmento` · `diario_tramitacao_status` · `diario_tramitacao_dia`

Criadas sozinhas por `garanteSchema()` na primeira consulta. Migrações são `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, sempre **depois** do `CREATE TABLE` correspondente.

### Variáveis de ambiente (Vercel)
`HUBSPOT_PAT` · `DATABASE_URL` · `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` · `DIARIO_SECRET`

## 9. Rodando local

```bash
npm install && npm run dev
```

Com `.env.local` contendo só `HUBSPOT_PAT`, o app usa um **driver local em JSON** (`.diario-data/diario.json`) no lugar do Postgres — dá para desenvolver sem tocar em produção. Sem `DIARIO_SECRET`, a sessão usa um segredo de desenvolvimento.

Para entrar sem passar pelo Google em ambiente local, gere o cookie:

```bash
node -e "const{createHmac}=require('crypto');const id='80454585';console.log('diario_sessao='+id+'.'+createHmac('sha256','psa-diario-dev-secret').update(id).digest('hex').slice(0,32))"
```

> Não rode `npm run build` com o dev server ligado: os dois escrevem em `.next` e a página quebra com "Cannot find module './276.js'". Pare o servidor, ou apague `.next` e suba de novo.

## 10. Armadilhas que já custaram tempo

1. **Filtros de data na REST do HubSpot só aceitam timestamp em milissegundos.** Passar `"2026-09-01"` devolve 400. O conector MCP converte sozinho; a REST não. Esse bug já zerou o "% contato efetivo" silenciosamente.

2. **429 engolido por `catch` vira número zerado na tela.** A busca do HubSpot tem limite *por segundo*. Ao paralelizar chamadas, o 429 cai no `.catch(() => [])` e o usuário vê "0 oportunidades" sem nenhum erro. **Desconfie de todo número zerado.** Contagens em lote vão em fila, não em paralelo.

3. **Medir a rota antes e depois de somar chamadas.** Juntar os resumos dos 4 times ao `/api/diario/agenda` levou a rota de 9s para 17s. Virou endpoint separado sob demanda (`/api/diario/resumo`).

4. **Componente declarado dentro de outro componente remonta a cada render** e o campo perde o foco a cada letra digitada. Já aconteceu com o textarea das tramitações. Componente auxiliar mora no escopo do módulo.

5. **Conta duplicada no HubSpot.** `CONTA_DO_DIARIO` resolve quem tem duas contas: no diário vale a que **detém a carteira e faz login**, não a canônica do histórico de negócios. Caso real: Sotoriva. O alias em `lib/constants.ts` aponta ao contrário de propósito, porque lá serve ao histórico de deals.

6. **Vercel:** o campo *Key* de uma variável não pode ser renomeado depois de criada — para corrigir um nome errado, apagar e criar de novo. E mudança de variável só vale em **deploy novo**: precisa dar Redeploy.

7. **Saída de farmer** segue o padrão do repo: remover de `TEAMS_SEP14`, de `FARMER_SEGMENTS` e de `ALL_FARMERS` em `lib/salao.ts`, e pôr `untilDate` em `FARMER_DATE_RESTRICTIONS`. **Manter** no mapa `FARMERS`, nas formações antigas, em `lib/rampagem.ts` e `lib/recordes.ts` — isso é histórico.

## 11. Em aberto

| Item | Situação |
|---|---|
| **Link curto** | Parado. Opções: subdomínio grátis `psa-diario.vercel.app` ou `diario.profissionaissa.com` (exige DNS). Qualquer domínio novo precisa da URI `https://NOVO/api/diario/auth/callback` cadastrada no Google Cloud. |
| **Criar tarefa/nota no HubSpot a partir do diário** | Parado por decisão ("vamos dar um passo atrás"). Tecnicamente possível — o escopo de escrita existe. A pergunta aberta é *quando* criar: 20 empresas/dia × 23 farmers ≈ 460 tarefas/dia. |
| **Escrever de volta em `ultimo_contato_efetivo`** | Não implementado. Não sabemos quem mantém esse campo hoje. |
| **"Contexto" da manhã** | Continua opcional, sem mínimo de caracteres. A observação do fechamento é que é obrigatória. |
| **43% do trabalho fora da lista** | Questão de processo, não de código. Precisa de uma conversa com os líderes antes de virar regra no sistema. |
| **Disposição da ligação** | A efetividade automática depende de o farmer marcar a disposição certa no HubSpot. Vale acompanhar na primeira semana. |

## 12. Onde estão as respostas

- **Regras de negócio:** `lib/diario/constants.ts` — comentado, e o *porquê* está junto de cada número.
- **Para o time:** a página `/diario/ajuda`, que lê aquelas constantes.
- **Histórico das decisões:** `git log` na `main`. As mensagens de commit explicam o que mudou **e por quê** — vários registram a alternativa que foi descartada.
