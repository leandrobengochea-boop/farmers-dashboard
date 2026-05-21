import { CriterionAbsence, CriterionImpact } from '@/lib/analytics'

interface CriteriaAnalysisProps {
  absence: CriterionAbsence[]
  impact: CriterionImpact[]
}

export default function CriteriaAnalysis({ absence, impact }: CriteriaAnalysisProps) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
      <h2 className="text-white font-semibold text-lg mb-6">Critérios Faltantes</h2>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Frequência de Ausência */}
        <div>
          <h3 className="text-slate-300 font-medium text-sm mb-3 uppercase tracking-wider">
            Frequência de Ausência
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="text-left py-2 pr-3 font-medium">Critério</th>
                  <th className="text-center py-2 px-2 font-medium">Peso</th>
                  <th className="text-center py-2 px-2 font-medium">Qtd ausente</th>
                  <th className="text-center py-2 px-2 font-medium">% ausente</th>
                  <th className="text-right py-2 pl-2 font-medium">Pts perdidos</th>
                </tr>
              </thead>
              <tbody>
                {absence.map((row, index) => (
                  <tr
                    key={row.key}
                    className={`border-b border-slate-700/50 ${
                      index === 0 ? 'bg-red-950/30' : 'hover:bg-slate-700/30'
                    } transition`}
                  >
                    <td
                      className={`py-2.5 pr-3 font-medium ${
                        index === 0 ? 'text-red-400' : 'text-slate-300'
                      }`}
                    >
                      {row.label}
                    </td>
                    <td className="py-2.5 px-2 text-center text-slate-400">{row.weight}</td>
                    <td className="py-2.5 px-2 text-center text-slate-300">{row.absentCount}</td>
                    <td className="py-2.5 px-2 text-center text-slate-300">
                      {row.absentPercent.toFixed(1)}%
                    </td>
                    <td
                      className={`py-2.5 pl-2 text-right font-semibold ${
                        index === 0 ? 'text-red-400' : 'text-slate-200'
                      }`}
                    >
                      {row.pointsLost.toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Impacto na Nota */}
        <div>
          <h3 className="text-slate-300 font-medium text-sm mb-3 uppercase tracking-wider">
            Impacto na Nota
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="text-left py-2 pr-3 font-medium">Critério</th>
                  <th className="text-center py-2 px-2 font-medium">Com critério</th>
                  <th className="text-center py-2 px-2 font-medium">Sem critério</th>
                  <th className="text-right py-2 pl-2 font-medium">Delta</th>
                </tr>
              </thead>
              <tbody>
                {impact.map((row) => (
                  <tr
                    key={row.key}
                    className="border-b border-slate-700/50 hover:bg-slate-700/30 transition"
                  >
                    <td className="py-2.5 pr-3 text-slate-300 font-medium">{row.label}</td>
                    <td className="py-2.5 px-2 text-center text-slate-300">
                      {row.avgWithCriterion.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-2 text-center text-slate-300">
                      {row.avgWithoutCriterion.toFixed(2)}
                    </td>
                    <td
                      className={`py-2.5 pl-2 text-right font-semibold ${
                        row.delta < 0 ? 'text-red-400' : 'text-green-400'
                      }`}
                    >
                      {row.delta >= 0 ? '+' : ''}
                      {row.delta.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
