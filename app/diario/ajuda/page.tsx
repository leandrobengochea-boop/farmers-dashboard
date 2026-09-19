import { redirect } from 'next/navigation'
import { usuarioAtual } from '@/lib/diario/session'
import {
  ABORDAGENS, BUCKETS, COOLDOWN_POR_RESULTADO, COOLDOWN_SEM_RESULTADO, COTA_DIARIA,
  EMPRESAS_DO_DIA, RESULTADOS, RESULTADO_EXIGE_OBSERVACAO, TENTATIVAS_ATE_AUXILIO,
  ANTECEDENCIA_CHECKLIST_DIAS, PRAZO_ASSINATURA_DIAS, PRAZO_MINUTA_DIAS_UTEIS,
  RESULTADOS_TRAMITACAO, TRAMITACOES, TipoTramitacao,
} from '@/lib/diario/constants'
import Cabecalho from '@/components/diario/Cabecalho'

export const dynamic = 'force-dynamic'

/**
 * Página de regras do diário. Os números vêm das constantes que a lógica usa,
 * então ela não descola do comportamento real quando algo for afinado.
 */
export default function AjudaPage() {
  const usuario = usuarioAtual()
  if (!usuario) redirect('/diario/login')

  const dias = (n: number) => (n === 1 ? 'no dia seguinte' : `depois de ${n} dias`)

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-6">
      <Cabecalho
        titulo="Como funciona"
        subtitulo="As regras do Diário de Bordo, em uma página"
        usuario={usuario}
        ativa="ajuda"
      />

      {/* texto em coluna estreita, mas o cabeçalho acompanha a largura das outras telas */}
      <div className="max-w-3xl">
      <Secao titulo="Para que serve">
        <p>
          O diário existe para o dia começar decidido. Em vez de abrir o CRM e escolher por intuição quem
          procurar, o farmer recebe de manhã uma lista de <b>{EMPRESAS_DO_DIA} empresas da própria carteira</b>,
          escolhidas pelo tempo desde a última contratação, define como vai abordar cada uma e, no fim do dia,
          registra o que conseguiu.
        </p>
        <p>
          A lista é montada uma vez por dia e <b>congela</b>: atualizar a página não embaralha nada.
        </p>
      </Secao>

      <Secao titulo="As fases da carteira">
        <p>
          Toda empresa da carteira cai numa fase, conforme o campo <Campo>Data da última compra</Campo> no
          HubSpot:
        </p>
        <table className="w-full text-sm mt-4 border border-zinc-200 rounded-lg overflow-hidden">
          <thead className="bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="text-left font-semibold px-4 py-2.5">Fase</th>
              <th className="text-left font-semibold px-4 py-2.5 w-40">Desde a última compra</th>
              <th className="text-left font-semibold px-4 py-2.5">O que ela significa</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(BUCKETS) as Array<keyof typeof BUCKETS>).map((b) => (
              <tr key={b} className="border-t border-zinc-100 align-top">
                <td className="px-4 py-3 font-medium">{BUCKETS[b].label}</td>
                <td className="px-4 py-3 text-zinc-600">{BUCKETS[b].faixa}</td>
                <td className="px-4 py-3 text-zinc-600">{BUCKETS[b].hint}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Secao>

      <Secao titulo="Como as empresas do dia são escolhidas">
        <p>
          A divisão segue o princípio de Pareto — poucas quentes, muitas frias:
        </p>
        <ul className="mt-3 space-y-1.5">
          <li><b>{COTA_DIARIA.recompra}</b> de {BUCKETS.recompra.label.toLowerCase()}</li>
          <li><b>{COTA_DIARIA.nutricao}</b> de {BUCKETS.nutricao.label.toLowerCase()}</li>
          <li><b>{COTA_DIARIA.reativacao}</b> de {BUCKETS.reativacao.label.toLowerCase()}</li>
          <li className="text-zinc-500">
            + <b>{COTA_DIARIA.extra}</b> de {BUCKETS.extra.label.toLowerCase()}, como extras fora da conta das {EMPRESAS_DO_DIA}
          </li>
        </ul>
        <p className="mt-4">
          Dentro de cada fase, a ordem tem lógica: em recompra e nutrição vem primeiro quem está mais perto de
          estourar a janela; em reativação vem primeiro a mais morna, ou seja, a que comprou mais recentemente
          dentro do grupo. Empate se resolve por quem está há mais tempo sem contato efetivo.
        </p>
        <p className="mt-3">
          Se uma fase não tiver empresas suficientes, as vagas são completadas pelas outras, até fechar
          as {EMPRESAS_DO_DIA}. Por isso o número não cai mesmo quando um balde seca.
        </p>
        <Nota>
          Empresas com <b>negócio aberto no funil</b> ficam de fora: já estão sendo trabalhadas, e ocupariam
          uma vaga à toa.
        </Nota>
      </Secao>

      <Secao titulo="O ciclo do dia">
        <p>
          <b>De manhã</b>, o farmer escolhe a abordagem de cada uma das {EMPRESAS_DO_DIA} e confirma o plano.
          Não existe escolher quais atacar — a lista inteira é o compromisso. As abordagens disponíveis são:
        </p>
        <ul className="mt-3 space-y-1">
          {ABORDAGENS.map((a) => <li key={a} className="text-zinc-600">{a}</li>)}
        </ul>
        <p className="mt-4">
          <b>No fim do dia</b>, registra o que aconteceu em cada uma:
        </p>
        <ul className="mt-3 space-y-1.5">
          {RESULTADOS.map((r) => (
            <li key={r.key}>
              <b>{r.label}</b>
              {RESULTADO_EXIGE_OBSERVACAO.includes(r.key) && (
                <span className="text-zinc-500"> — exige observação: {r.key === 'efetivo' ? 'o que saiu da conversa' : 'por que ficou pra trás'}</span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-4">
          Os extras de {BUCKETS.extra.label.toLowerCase()} são bônus: não travam a confirmação nem o fechamento.
        </p>
      </Secao>

      <Secao titulo="Quando uma empresa volta para a lista">
        <p>Depende do que aconteceu na última vez que ela apareceu:</p>
        <table className="w-full text-sm mt-4 border border-zinc-200 rounded-lg overflow-hidden">
          <tbody>
            {RESULTADOS.map((r) => (
              <tr key={r.key} className="border-t border-zinc-100 first:border-t-0">
                <td className="px-4 py-3 font-medium w-56">{r.label}</td>
                <td className="px-4 py-3 text-zinc-600">volta {dias(COOLDOWN_POR_RESULTADO[r.key])}</td>
              </tr>
            ))}
            <tr className="border-t border-zinc-100">
              <td className="px-4 py-3 font-medium">Dia não fechado</td>
              <td className="px-4 py-3 text-zinc-600">
                volta {dias(COOLDOWN_SEM_RESULTADO)} — sem resultado registrado, o sistema assume que a empresa não foi abordada
              </td>
            </tr>
          </tbody>
        </table>
        <p className="mt-4">
          Cada empresa que retorna mostra o motivo no próprio card: <i>não abordada em 17/09</i>,
          <i> 2ª tentativa · sem contato desde 14/09</i> ou <i>falaram em 01/08</i>.
        </p>
      </Secao>

      <Secao titulo="Auxílio do líder">
        <p>
          Depois de <b>{TENTATIVAS_ATE_AUXILIO} tentativas seguidas sem contato</b>, a empresa ganha o selo
          <b> AUXÍLIO DO LÍDER</b> e passa a ir na frente da própria fase — ela continua na lista, porque
          tirá-la seria premiar a porta fechada.
        </p>
        <p className="mt-3">
          Na Agenda do dia, o líder vê essas empresas e escreve uma orientação, que aparece no card do farmer
          assinada com o nome dele. Normalmente três tentativas frustradas significam dado velho no CRM ou
          porta que não abre sozinha — as duas coisas que o líder resolve e o farmer não.
        </p>
        <p className="mt-3">
          O selo some sozinho quando um contato efetivo zera a sequência. Ninguém precisa dar baixa.
        </p>
      </Secao>

      <Secao titulo="Tramitações: os tickets do dia">
        <p>
          A aba <b>Tramitações</b> é o mesmo ritual do diário, aplicado aos tickets de CS em vez das empresas:
          de manhã aparece o que tem prazo, o farmer marca o que vai tratar, e no fim do dia registra a evolução.
          A lista sai dos tickets abertos onde o farmer é o proprietário, no pipeline CS.
        </p>
        <table className="w-full text-sm mt-4 border border-zinc-200 rounded-lg overflow-hidden">
          <thead className="bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="text-left font-semibold px-4 py-2.5">Pendência</th>
              <th className="text-left font-semibold px-4 py-2.5 w-48">Prazo</th>
              <th className="text-left font-semibold px-4 py-2.5 w-52">Quando aparece</th>
              <th className="text-left font-semibold px-4 py-2.5">Como sai da lista</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(TRAMITACOES) as TipoTramitacao[]).map((t) => (
              <tr key={t} className="border-t border-zinc-100 align-top">
                <td className="px-4 py-3 font-medium">{TRAMITACOES[t].label}</td>
                <td className="px-4 py-3 text-zinc-600">{TRAMITACOES[t].prazo}</td>
                <td className="px-4 py-3 text-zinc-600">{TRAMITACOES[t].entra}</td>
                <td className="px-4 py-3 text-zinc-600">
                  {TRAMITACOES[t].baixa === 'crm'
                    ? 'Sozinha, quando o contrato fica como Assinado no HubSpot'
                    : 'O farmer marca como feito e o líder confirma'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-4">
          <b>A baixa é em duas mãos.</b> Quando o farmer marca como feito, a pendência <i>não</i> some: ela fica
          no board dele com o selo <b>AGUARDANDO LÍDER</b> e aparece no painel do líder para conferência. Só
          depois do check do líder ela sai da lista. A exceção é a assinatura, que o CRM responde sozinho —
          contrato assinado também baixa o envio da minuta, porque não dá para assinar o que não foi enviado.
        </p>

        <p className="mt-3">
          No fim do dia, cada tramitação escolhida recebe {RESULTADOS_TRAMITACAO.map((r) => r.label).join(', ')}.
          <b> Travado</b> exige observação — é o que mostra ao líder o que depende de terceiro (cliente, jurídico,
          palestrante) e não de esforço do farmer.
        </p>

        <Nota>
          O prazo da minuta conta <b>{PRAZO_MINUTA_DIAS_UTEIS} dia útil</b> (onboarding na sexta vence na segunda);
          a assinatura conta <b>{PRAZO_ASSINATURA_DIAS} dias corridos</b>; o checklist aparece{' '}
          <b>{ANTECEDENCIA_CHECKLIST_DIAS} dias antes</b> do evento. Feriado não é considerado.
        </Nota>

        <p className="mt-4">
          Onboarding com data futura é agendamento, não realização: o prazo só começa a contar quando a data chega.
          E tickets de eventos que já aconteceram aparecem numa seção separada no fim da lista, porque o ticket
          continua aberto no pipeline mas a ação já perdeu a hora.
        </p>
      </Secao>

      <Secao titulo="Os números do topo">
        <dl className="space-y-3">
          <Definicao termo="Oportunidades no mês">
            Negócios criados no mês com o farmer como responsável, seguindo as mesmas regras dos outros
            dashboards: filtro de origem a partir de julho/26 e exclusão do que foi marcado como Fora do MOA.
          </Definicao>
          <Definicao termo="Tickets ativos">
            Eventos contratados em execução — tickets do pipeline CS em etapas abertas.
          </Definicao>
          <Definicao termo="Receita gerada">
            Soma dos negócios ganhos no mês.
          </Definicao>
          <Definicao termo="Contato efetivo">
            Percentual da carteira com o campo <Campo>Último Contato Efetivo</Campo> dentro do mês corrente.
            É a régua de cobertura: quanto da carteira foi realmente tocada.
          </Definicao>
        </dl>
        <Nota>
          Na visão do líder, os mesmos números somam o time inteiro.
        </Nota>
      </Secao>

      <Secao titulo="Acesso e carteira">
        <p>
          O login é feito com a conta Google <Campo>@profissionaissa.com</Campo>. Não existe senha do diário:
          o e-mail é cruzado com o usuário do HubSpot e a carteira vem daí — são as empresas onde a pessoa é
          proprietária no CRM.
        </p>
        <p className="mt-3">
          Quem é farmer cai na própria lista. Quem é líder cai na Agenda do dia, vê o andamento de cada farmer
          do time e pode abrir o diário de qualquer um deles. A gerência enxerga os quatro times.
        </p>
        <p className="mt-3">
          <b>Líder e gerência também editam.</b> Abordagem, contexto, resultado e observação podem ser ajustados
          por quem lidera, inclusive depois do dia revisado — e a alteração aparece para o farmer com o nome de
          quem mexeu. A exceção é marcar uma tramitação como feita: isso continua sendo só do farmer, senão a
          dupla checagem perderia o sentido.
        </p>
        <Nota>
          Empresa faltando ou sobrando na sua lista quase sempre é proprietário errado no HubSpot — corrigir lá
          corrige aqui no dia seguinte.
        </Nota>
      </Secao>

      <Secao titulo="Perguntas que já apareceram">
        <Faq pergunta="Posso trocar uma empresa da lista?">
          Não. Trocar seria voltar a escolher por intuição, que é justamente o que o diário evita. Se ela não
          fizer sentido hoje, registre <b>{RESULTADOS[2].label}</b> com o motivo — isso vira informação para o
          líder, e a empresa volta amanhã.
        </Faq>
        <Faq pergunta="Por que essa empresa apareceu de novo hoje?">
          Porque no último dia ela ficou sem ser abordada, ou porque já passou o descanso da fase dela. O card
          diz qual dos dois.
        </Faq>
        <Faq pergunta="E se eu não fechar o dia?">
          As empresas voltam amanhã como se não tivessem sido abordadas, e o líder vê o dia em aberto na Agenda.
        </Faq>
        <Faq pergunta="A lista muda se eu atualizar a página?">
          Não. Ela é sorteada uma vez por dia e fica gravada.
        </Faq>
        <Faq pergunta="Mudei o dono de uma empresa no HubSpot. Quando reflete aqui?">
          Na próxima lista gerada, ou seja, no dia seguinte. A lista de hoje já está congelada.
        </Faq>
      </Secao>

      <p className="text-xs text-zinc-400 border-t border-zinc-200 pt-6">
        Esta página lê as regras direto do código do diário — quando um prazo ou uma cota muda, o texto muda junto.
      </p>
      </div>
    </div>
  )
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-400 mb-3">{titulo}</h2>
      <div className="text-sm text-zinc-800 leading-relaxed space-y-3">{children}</div>
    </section>
  )
}

function Campo({ children }: { children: React.ReactNode }) {
  return <code className="text-xs bg-zinc-100 border border-zinc-200 rounded px-1.5 py-0.5">{children}</code>
}

function Nota({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 rounded-lg bg-zinc-50 border border-zinc-200 px-4 py-3 text-sm text-zinc-600">{children}</p>
  )
}

function Definicao({ termo, children }: { termo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-semibold">{termo}</dt>
      <dd className="text-zinc-600">{children}</dd>
    </div>
  )
}

function Faq({ pergunta, children }: { pergunta: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-zinc-100 pt-3 first:border-t-0 first:pt-0">
      <p className="font-semibold">{pergunta}</p>
      <p className="text-zinc-600 mt-0.5">{children}</p>
    </div>
  )
}
