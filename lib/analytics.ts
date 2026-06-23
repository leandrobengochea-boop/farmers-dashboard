import { Deal, ExcludedDeal, ForaDoMOAEntry } from './hubspot'
import { CRITERIA, FARMERS, MAX_SCORE, TEAMS } from './constants'

export interface FarmerStats {
  farmerId: string
  farmerName: string
  avgScore: number
  dealCount: number
  companyCount: number
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
  meetingScheduled: number
  meetingCompleted: number
}

export function computeFarmerRanking(deals: Deal[]): FarmerStats[] {
  const map = new Map<string, { name: string; totalScore: number; scoredCount: number; dealCount: number; companies: Set<string> }>()

  for (const deal of deals) {
    if (!deal.farmerId) continue
    const existing = map.get(deal.farmerId) ?? {
      name: deal.farmerName || FARMERS[deal.farmerId] || deal.farmerId,
      totalScore: 0, scoredCount: 0, dealCount: 0, companies: new Set<string>(),
    }
    existing.dealCount += 1
    if (deal.companyId) existing.companies.add(deal.companyId)
    if (deal.isScored) {
      existing.totalScore += deal.score
      existing.scoredCount += 1
    }
    map.set(deal.farmerId, existing)
  }

  const result: FarmerStats[] = []
  for (const [farmerId, s] of map.entries()) {
    result.push({
      farmerId,
      farmerName: s.name,
      avgScore: s.scoredCount > 0 ? s.totalScore / s.scoredCount : 0,
      dealCount: s.dealCount,
      companyCount: s.companies.size,
      totalScore: s.totalScore,
    })
  }

  return result.sort((a, b) => b.avgScore - a.avgScore)
}

export function computeScoreDistribution(deals: Deal[]): ScoreDistributionItem[] {
  const scores = [6, 7, 8, 9, 10, 11, 12]
  const counts = new Map<number, number>()

  for (const s of scores) counts.set(s, 0)

  for (const deal of deals) {
    if (!deal.isScored) continue
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
  const scoredDeals = deals.filter((d) => d.isScored)
  const totalActualPoints = scoredDeals.reduce((sum, d) => sum + d.score, 0)
  const avgScore = scoredDeals.length > 0 ? totalActualPoints / scoredDeals.length : 0
  const totalPossiblePoints = scoredDeals.length * MAX_SCORE
  const efficiency = totalPossiblePoints > 0 ? (totalActualPoints / totalPossiblePoints) * 100 : 0

  const activeFarmerIds = new Set(deals.map((d) => d.farmerId).filter(Boolean))

  const meetingScheduled = deals.filter((d) => d.meetingScheduled).length
  const meetingCompleted = deals.filter((d) => d.meetingCompleted).length

  return {
    totalDeals,
    avgScore,
    efficiency,
    activeFarmers: activeFarmerIds.size,
    totalPossiblePoints,
    totalActualPoints,
    meetingScheduled,
    meetingCompleted,
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

export interface FarmerMeetingStats {
  farmerId: string
  farmerName: string
  totalDeals: number
  scheduled: number
  scheduledPct: number
  completed: number
  completedPct: number
}

export function computeMeetingConversion(deals: Deal[]): FarmerMeetingStats[] {
  const map = new Map<string, { name: string; total: number; scheduled: number; completed: number }>()

  for (const d of deals) {
    if (!d.farmerId) continue
    const e = map.get(d.farmerId) ?? { name: d.farmerName, total: 0, scheduled: 0, completed: 0 }
    e.total += 1
    if (d.meetingScheduled) e.scheduled += 1
    if (d.meetingCompleted) e.completed += 1
    map.set(d.farmerId, e)
  }

  return Array.from(map.entries())
    .map(([farmerId, e]) => ({
      farmerId,
      farmerName: e.name,
      totalDeals: e.total,
      scheduled: e.scheduled,
      scheduledPct: e.total > 0 ? Math.round((e.scheduled / e.total) * 100) : 0,
      completed: e.completed,
      completedPct: e.scheduled > 0 ? Math.round((e.completed / e.scheduled) * 100) : 0,
    }))
    .filter((f) => f.scheduled > 0)
    .sort((a, b) => b.completedPct - a.completedPct)
}
