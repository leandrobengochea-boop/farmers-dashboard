import { Deal, ExcludedDeal, ForaDoMOAEntry } from './hubspot'
import { CRITERIA, FARMERS, MAX_SCORE, TEAMS } from './constants'

export interface FarmerStats {
  farmerId: string
  farmerName: string
  avgScore: number
  dealCount: number
  totalScore: number
}

export interface ScoreDistributionItem {
  score: number
  count: number
}

export interface CriterionAbsence {
  key: string
  label: string
  weight: number
  absentCount: number
  absentPercent: number
  pointsLost: number
}

export interface CriterionImpact {
  key: string
  label: string
  avgWithCriterion: number
  avgWithoutCriterion: number
  delta: number
}

export interface SummaryStats {
  totalDeals: number
  avgScore: number
  efficiency: number
  activeFarmers: number
  totalPossiblePoints: number
  totalActualPoints: number
}

export function computeFarmerRanking(deals: Deal[]): FarmerStats[] {
  const map = new Map<string, { name: string; total: number; count: number }>()

  for (const deal of deals) {
    if (!deal.farmerId) continue
    const existing = map.get(deal.farmerId)
    if (existing) {
      existing.total += deal.score
      existing.count += 1
    } else {
      map.set(deal.farmerId, {
        name: deal.farmerName || FARMERS[deal.farmerId] || deal.farmerId,
        total: deal.score,
        count: 1,
      })
    }
  }

  const result: FarmerStats[] = []
  for (const [farmerId, stats] of map.entries()) {
    result.push({
      farmerId,
      farmerName: stats.name,
      avgScore: stats.count > 0 ? stats.total / stats.count : 0,
      dealCount: stats.count,
      totalScore: stats.total,
    })
  }

  return result.sort((a, b) => b.avgScore - a.avgScore)
}

export function computeScoreDistribution(deals: Deal[]): ScoreDistributionItem[] {
  const scores = [6, 7, 8, 9, 10, 11, 12]
  const counts = new Map<number, number>()

  for (const s of scores) counts.set(s, 0)

  for (const deal of deals) {
    const s = Math.round(deal.score)
    if (counts.has(s)) {
      counts.set(s, (counts.get(s) || 0) + 1)
    }
  }

  return scores.map((s) => ({ score: s, count: counts.get(s) || 0 }))
}

export function computeCriteriaAnalysis(deals: Deal[]): {
  absence: CriterionAbsence[]
  impact: CriterionImpact[]
} {
  const total = deals.length

  const absence: CriterionAbsence[] = CRITERIA.map((criterion) => {
    const absentCount = deals.filter((d) => !d.criteria.includes(criterion.key)).length
    const absentPercent = total > 0 ? (absentCount / total) * 100 : 0
    const pointsLost = absentCount * criterion.weight

    return {
      key: criterion.key,
      label: criterion.label,
      weight: criterion.weight,
      absentCount,
      absentPercent,
      pointsLost,
    }
  }).sort((a, b) => b.pointsLost - a.pointsLost)

  const impact: CriterionImpact[] = CRITERIA.map((criterion) => {
    const withCriterion = deals.filter((d) => d.criteria.includes(criterion.key))
    const withoutCriterion = deals.filter((d) => !d.criteria.includes(criterion.key))

    const avgWith =
      withCriterion.length > 0
        ? withCriterion.reduce((sum, d) => sum + d.score, 0) / withCriterion.length
        : 0

    const avgWithout =
      withoutCriterion.length > 0
        ? withoutCriterion.reduce((sum, d) => sum + d.score, 0) / withoutCriterion.length
        : 0

    return {
      key: criterion.key,
      label: criterion.label,
      avgWithCriterion: avgWith,
      avgWithoutCriterion: avgWithout,
      delta: avgWith - avgWithout,
    }
  })

  return { absence, impact }
}

export function computeSummaryStats(deals: Deal[]): SummaryStats {
  const totalDeals = deals.length
  const totalActualPoints = deals.reduce((sum, d) => sum + d.score, 0)
  const avgScore = totalDeals > 0 ? totalActualPoints / totalDeals : 0
  const totalPossiblePoints = totalDeals * MAX_SCORE
  const efficiency = totalPossiblePoints > 0 ? (totalActualPoints / totalPossiblePoints) * 100 : 0

  const activeFarmerIds = new Set(deals.map((d) => d.farmerId).filter(Boolean))

  return {
    totalDeals,
    avgScore,
    efficiency,
    activeFarmers: activeFarmerIds.size,
    totalPossiblePoints,
    totalActualPoints,
  }
}

export function filterDealsByMonth(deals: Deal[], month: string | null): Deal[] {
  if (!month) return deals

  const [year, monthNum] = month.split('-').map(Number)
  const start = new Date(year, monthNum - 1, 1).getTime()
  const end = new Date(year, monthNum, 1).getTime()

  return deals.filter((d) => {
    if (!d.date) return false
    const ts = new Date(d.date).getTime()
    return ts >= start && ts < end
  })
}

export function getAvailableMonths(deals: Deal[]): string[] {
  const months = new Set<string>()

  for (const deal of deals) {
    if (!deal.date) continue
    const d = new Date(deal.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months.add(key)
  }

  return Array.from(months).sort()
}

export function filterDealsByTeam(deals: Deal[], teamId: string | null): Deal[] {
  if (!teamId) return deals
  const team = TEAMS[teamId]
  if (!team) return deals
  const ids = new Set(team.farmerIds)
  return deals.filter((d) => ids.has(d.farmerId))
}

export function computeForaDoMOA(
  excludedDeals: ExcludedDeal[],
  teamId: string | null,
  monthKey: string | null,
): ForaDoMOAEntry[] {
  let filtered = excludedDeals

  if (teamId) {
    const team = TEAMS[teamId]
    if (team) {
      const ids = new Set(team.farmerIds)
      filtered = filtered.filter((d) => ids.has(d.farmerId))
    }
  }

  if (monthKey) {
    filtered = filtered.filter((d) => {
      if (!d.date) return false
      const date = new Date(d.date)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      return key === monthKey
    })
  }

  const byFarmer: Record<string, number> = {}
  for (const d of filtered) {
    byFarmer[d.farmerName] = (byFarmer[d.farmerName] ?? 0) + 1
  }

  return Object.entries(byFarmer)
    .map(([farmerName, count]) => ({ farmerName, count }))
    .sort((a, b) => b.count - a.count)
}
