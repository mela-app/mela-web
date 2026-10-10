import { describe, expect, it } from 'vitest'
import { AUTO_RECONNECTS, reconnectDelayMs } from './useLive'

describe('automatic reconnects', () => {
  it('waits longer each time, up to 15 seconds', () => {
    expect([0, 1, 2, 3, 4, 5].map(reconnectDelayMs)).toEqual([1000, 2000, 4000, 8000, 15_000, 15_000])
  })

  it('tries for about a minute before asking the viewer', () => {
    let total = 0
    for (let done = 0; done < AUTO_RECONNECTS; done++) total += reconnectDelayMs(done)
    expect(total).toBeGreaterThanOrEqual(40_000)
    expect(total).toBeLessThanOrEqual(90_000)
  })
})
