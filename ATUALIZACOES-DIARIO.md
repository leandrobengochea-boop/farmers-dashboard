# Diário de Bordo — o que mudou desde o handoff

**De:** Leandro · **Para:** Mattheus · **Período:** 22/09 a 10/11/2026

O handoff original (`HANDOFF-DIARIO.md`) está atualizado e continua sendo a referência completa. Este documento é só o **delta**: o que mudou de regra, o que descobrimos de armadilha no HubSpot e quais padrões valem puxar para o Negócios Ativos B2B.

---

## 1. Armadilhas do HubSpot que valem para qualquer painel

Estas custaram tempo e **falham em silêncio** — nenhuma dá erro na tela.

### Os ids das etapas do funil B2B mentem
O Funil de Vendas B2B é o pipeline padrão do HubSpot renomeado, e ninguém trocou os ids:

| id | o que parece | o que é | fechada? |
|---|---|---|---|
| `closedwon` | ganho | **Proposta enviada** | não |
| `closedlost` | perdido | **Em negociação** | não |
| `1076664460` | — | Ganho / Contrato assinado | **não** |

Nunca deduza o significado pelo id. No diário isso vive em `ETAPAS_FUNIL_ATIVO`.

Consequência prática: dos 479 negócios que o HubSpot marcava como "abertos", **283 estavam em "Ganho / Contrato assinado"** — ganhos esperando contrato, contados como negociação em andamento.

### 429 engolido por `catch` vira número zerado
A busca do HubSpot tem limite **por segundo**. Ao paralelizar, o 429 cai no `.catch(() => [])` e a tela mostra **"0 oportunidades"** sem nenhum erro.

> **Regra que adotamos:** desconfie de todo número zerado. E prefira `throw` a devolver coleção vazia — quem chama decide o que fazer. Fizemos isso depois de um filtro esconder 100% dos selos de auxílio porque o PAT estava inválido.

Contagens em lote vão **em fila**, não em paralelo.

### Filtros de data só aceitam timestamp em milissegundos
Passar `"2026-09-01"` devolve 400. O conector MCP converte sozinho; a REST não. Isso já zerou um "% contato efetivo" sem avisar.

### `teste_carteiras`: o value não é o label
A propriedade que guarda a carteira (rótulo "Novas Carteiras") tem **value diferente do label** em 10 das 30 opções — a empresa guarda `"Indústria"` onde a lista de farmers diz `"Indústria I"`. Comparar texto com texto dá zero resultado para metade das pessoas.

E três segmentos têm nome diferente dos dois lados; sem um mapa de apelidos, **632 empresas** pareciam estar no segmento errado.

### Mapa de segmento por pessoa desatualiza sozinho
Quando alguém sai, a carteira é redistribuída no CRM e o mapa hardcoded fica mentindo. Em out/26 três pessoas estavam com segmento errado, e o efeito era **zero negociações** no diário delas, sem erro visível.

> **Conferência que vale rodar a cada mudança de time:** contar empresas por `hubspot_owner_id` e comparar o valor majoritário de `teste_carteiras` com o mapa do código.

### WhatsApp não é `call`
A automação grava a conversa no objeto **`communications`** (`hs_communication_channel_type = WHATS_APP`), não em `calls`. Eram ~780 mensagens/dia invisíveis para o diário.

E **não existe campo de direção**: nenhuma das 55 propriedades diz se a mensagem foi enviada ou recebida. Tentamos três formas de inferir pelo HTML do corpo e nenhuma passou de ~60% de precisão. Por isso WhatsApp conta como **tentativa**, nunca como efetivo.

---

## 2. Regras do diário que mudaram

### A derivação automática sobe, mas nunca desce
O resultado do dia não é um fato estático: é o **melhor que aconteceu até agora**. Marcar "tentei" de manhã não congela o dia — se o cliente responde à tarde e a ligação entra conectada, vira efetivo sozinho.

O caminho inverso é proibido, e a assimetria é medida: em 4 dias, **18 linhas mereciam subir e 144 seriam rebaixadas por engano** — gente que marcou efetivo por conversa que o CRM não viu.

Não toca em: troca de segmento, linha editada pelo líder, dia já revisado.

### Dia não útil fica fora
Sábado, domingo e feriado entravam no relatório com a lista cheia e zero resultado. Eram 5 dias assim em set/out, custando **3 pontos** de efetividade. Os feriados móveis saem do cálculo da Páscoa — não é tabela para atualizar todo ano.

A exceção protege trabalho real: dia não útil **com** resultado registrado continua contando.

A janela do relatório conta **dias úteis**, não dias de calendário.

### Negociação e tramitação são informação, não tarefa
Empresa com negócio aberto no funil, ou com evento sendo montado pelo CS, **sai do rodízio de abordagem** e aparece num bloco próprio. Chegaram a virar tarefa do dia; duplicava o acompanhamento que já acontece dentro do negócio.

### Histórico é por data, não por formação atual
Três correções do mesmo tipo:

- O relatório agrupa pelo time **daquele dia** (`dealInTeam`). Sem isso, uma troca de time movia 173 empresas de dono no gráfico retroativamente.
- A janela inclui quem **esteve** no time no período, não só quem está hoje. Sem isso, a saída de uma pessoa apagava 100 empresas do histórico da líder e mudava a taxa dela de 14% para 16%.
- Exclusão de pessoa virou **data-aware**: quem voltou à formação não traz o passado junto.

### Papéis separados: farmer e BDR
Desde 03/11 há dois tipos de rotina:

| | base | com histórico de compra | dia |
|---|---|---|---|
| Farmer (8) | ~270 empresas | 60–93% | 20 + 3 extras |
| BDR (3) | ~950 empresas | 1% | **50** |

No relatório os dois são contados **separados** — somados davam 35% e 8%, e a média não descrevia nenhum. Para BDR, "não abordei" dispensa observação (seriam ~1.800 caracteres por dia só para fechar).

---

## 3. Bugs que valem conhecer pelo formato

Mais úteis como **classe de problema** do que como correção pontual.

### A tela otimista na frente do servidor
Relato: "fecho o dia e ele volta a ficar aberto". No banco, **nenhum dia tinha sido reaberto**.

Causa: o campo de observação salva 600ms depois da última tecla. Quem digitava e clicava no mesmo segundo tinha o fechamento recusado — o servidor ainda não tinha o texto — enquanto a tela já mostrava tudo preenchido.

> **Antes de culpar o estado no banco, conferir se a tela está adiante do servidor.** A query que descartou a hipótese do banco: `decidido_em IS NOT NULL AND status IN ('rascunho','planejado')` → zero.

### Aba velha agindo na data de ontem
A rota de fechamento nunca checava se a data era hoje. Aba deixada aberta de um dia para o outro continuava achando que era ontem e o clique caía no dia errado — **11 ocorrências com 7 pessoas**.

> Diagnóstico: comparar a data do registro com `(timestamp AT TIME ZONE 'America/Sao_Paulo')::date`.

### Corrida entre a lista do dia e o resultado de ontem
Empresa atendida ontem voltava hoje. O descanso é calculado do resultado gravado, e o resultado chega atrasado: num caso real, a lista nasceu **17 minutos antes** de o resultado do dia anterior ser gravado.

> Toda regra que lê histórico precisa lembrar que o histórico é preenchido por um processo assíncrono.

### O recorte do líder era diferente do da gerência
Líder de time via gente que passou pelo time em formação antiga. **Gerência não era afetada**, porque lá o filtro já era aplicado — por isso passou nos testes, todos feitos como gerência.

> **Testar todo recorte como gerência E como líder de time.** São caminhos diferentes no código.

### Derivado não se limpa, se filtra
O selo "auxílio do líder" vem do histórico, que não sabe de troca de carteira: 49 de 60 empresas marcadas já eram de outra pessoa. Não havia o que apagar — a correção foi filtrar por dono atual, e ela se mantém sozinha nas próximas trocas.

---

## 4. Padrões que valem puxar

1. **Formações versionadas por data.** Cada mudança de time vira uma formação nova com data de início, nunca uma edição da anterior. Histórico fica intacto e `dealInTeam(pessoa, data, time)` responde "de quem era isso naquele dia".

2. **A página de regras lê as constantes do código.** Afinar um número atualiza o texto junto — documentação que não desatualiza.

3. **Medir antes de construir.** Quase toda decisão aqui tem um número atrás: a cota não cabia no pool (51/dia sustentáveis contra 360 pedidos), o denominador do relatório invertia o ranking dos times, a detecção de resposta no WhatsApp não passava de 60%. Várias features mudaram de forma — ou não foram feitas — por causa da medição.

4. **Falhar do lado seguro.** Filtro que não consegue checar não deve esconder tudo; melhor mostrar a mais e avisar.

---

## 5. Onde está cada coisa

```
lib/diario/constants.ts    ⭐ regras, cotas, papéis, times, mapas de exceção
lib/diario/carteira.ts     carteira + montagem da lista do dia
lib/diario/atividade.ts    derivação do resultado a partir do CRM
lib/diario/calendario.ts   dia útil e feriados (Páscoa calculada)
lib/diario/tramitacoes.ts  pendências de ticket
app/api/diario/*           14 rotas
app/diario/ajuda           a página de regras que lê as constantes
```

O `git log` da `main` é o registro mais completo: as mensagens explicam o que mudou **e por quê**, e várias registram a alternativa que foi descartada.
