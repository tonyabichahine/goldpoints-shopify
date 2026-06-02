import { describe, it, expect } from 'vitest'
import { getTier, buildUpgradeBonusData } from './shopify'

describe('getTier', () => {
  it('uses default thresholds (500 / 1000)', () => {
    expect(getTier(0)).toBe('Bronze')
    expect(getTier(499)).toBe('Bronze')
    expect(getTier(500)).toBe('Silver')
    expect(getTier(999)).toBe('Silver')
    expect(getTier(1000)).toBe('Gold')
    expect(getTier(5000)).toBe('Gold')
  })

  it('respects custom per-merchant thresholds', () => {
    expect(getTier(200, 100, 300)).toBe('Silver')
    expect(getTier(99, 100, 300)).toBe('Bronze')
    expect(getTier(300, 100, 300)).toBe('Gold')
  })
})

describe('buildUpgradeBonusData', () => {
  const M = 'merchant-1'
  const C = 'customer-1'

  it('awards the Silver bonus on Bronze → Silver', () => {
    const r = buildUpgradeBonusData(M, C, 'Bronze', 'Silver', 50, 100, false, false)
    expect(r.extraPoints).toBe(50)
    expect(r.customerUpdates).toEqual({ silver_bonus_awarded: true })
    expect(r.transactions).toHaveLength(1)
    expect(r.transactions[0]).toMatchObject({ type: 'earn_tier_bonus', points: 50 })
  })

  it('does not re-award a Silver bonus already given', () => {
    const r = buildUpgradeBonusData(M, C, 'Bronze', 'Silver', 50, 100, true, false)
    expect(r.extraPoints).toBe(0)
    expect(r.transactions).toHaveLength(0)
  })

  it('awards BOTH bonuses when jumping Bronze → Gold', () => {
    const r = buildUpgradeBonusData(M, C, 'Bronze', 'Gold', 50, 100, false, false)
    expect(r.extraPoints).toBe(150)
    expect(r.customerUpdates).toMatchObject({ silver_bonus_awarded: true, gold_bonus_awarded: true })
    expect(r.transactions).toHaveLength(2)
  })

  it('awards only the Gold bonus on Silver → Gold', () => {
    const r = buildUpgradeBonusData(M, C, 'Silver', 'Gold', 50, 100, true, false)
    expect(r.extraPoints).toBe(100)
    expect(r.customerUpdates).toEqual({ gold_bonus_awarded: true })
    expect(r.transactions).toHaveLength(1)
  })

  it('returns nothing when the tier is unchanged', () => {
    const r = buildUpgradeBonusData(M, C, 'Silver', 'Silver', 50, 100, false, false)
    expect(r.extraPoints).toBe(0)
    expect(r.transactions).toHaveLength(0)
  })

  it('skips bonuses configured as zero', () => {
    const r = buildUpgradeBonusData(M, C, 'Bronze', 'Gold', 0, 0, false, false)
    expect(r.extraPoints).toBe(0)
    expect(r.transactions).toHaveLength(0)
  })
})
