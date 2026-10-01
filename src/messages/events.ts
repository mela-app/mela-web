import type { InboxEvent } from './types'

export interface InboxEvents {
  subscribe(listener: (event: InboxEvent) => void): () => void
}

/** Hands the live's socket's message events to whichever parts of the inbox are open. */
export function createInboxEvents(): InboxEvents & { emit(event: InboxEvent): void } {
  const listeners = new Set<(event: InboxEvent) => void>()
  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    emit(event) {
      for (const listener of [...listeners]) listener(event)
    },
  }
}
