import { describe, expect, it } from 'vitest'
import { END, frameAt } from './roomTimeline'
import { STEP_SPANS, stepView } from './howSteps'

describe('how-it-works steps', () => {
  it('split the room timeline into three chapters, in order, covering all of it', () => {
    expect(STEP_SPANS).toHaveLength(3)
    expect(STEP_SPANS[0][0]).toBe(0)
    expect(STEP_SPANS[2][1]).toBe(END)
    for (let i = 1; i < 3; i++) expect(STEP_SPANS[i][0]).toBeGreaterThanOrEqual(STEP_SPANS[i - 1][1] - 0.1)
  })

  it('each chapter ends on what its step promises: plan, furnished room, prices', () => {
    const plan = frameAt(stepView(END, 0).t)
    expect(plan.outline).toBe(1)
    expect(plan.walls).toBe(0)

    const room = frameAt(stepView(END, 1).t)
    expect(room.walls).toBe(1)
    expect(room.furniture.every((p) => p.opacity === 1)).toBe(true)
    expect(room.tags.every((a) => a === 0)).toBe(true)

    const priced = frameAt(stepView(END, 2).t)
    expect(priced.tags.every((a) => a === 1)).toBe(true)
  })

  it('lights a step only when its turn comes, and fills the line after it once it is done', () => {
    expect(stepView(0, 0).lit).toBe(true)
    expect(stepView(0, 1).lit).toBe(false)
    expect(stepView(0, 2).lit).toBe(false)
    expect(stepView(0, 0).line).toBe(0)

    const midSecond = (STEP_SPANS[1][0] + STEP_SPANS[1][1]) / 2
    expect(stepView(midSecond, 1).lit).toBe(true)
    expect(stepView(midSecond, 0).line).toBe(1)
    expect(stepView(midSecond, 1).line).toBe(0)
    expect(stepView(midSecond, 2).lit).toBe(false)

    expect(stepView(END, 2).lit).toBe(true)
  })

  it('shows an empty sheet until its turn, so a later step gives nothing away', () => {
    const blank = frameAt(stepView(0, 2).t)
    expect(blank.outline).toBe(0)
    expect(blank.furniture.every((p) => p.opacity === 0)).toBe(true)
    expect(stepView(END, 1).line).toBe(1)
  })
})
