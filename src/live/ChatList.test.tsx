import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChatList } from './ChatList'
import type { ChatMessage } from './types'

const host = { id: 'host-1', username: 'abebe', displayName: 'Abebe', avatarUrl: null }
const message = (overrides: Partial<ChatMessage>): ChatMessage => ({
  id: 'm1',
  text: '',
  createdAt: '2026-09-30T12:00:00Z',
  sender: host,
  ...overrides,
})

describe('ChatList', () => {
  it("shows the host's photo, with its caption when there is one", () => {
    render(
      <ChatList
        messages={[
          message({ id: 'm1', imageUrl: 'https://media.example/chat-images/p1.jpg' }),
          message({ id: 'm2', imageUrl: 'https://media.example/chat-images/p2.jpg', text: 'Tonight!' }),
        ]}
        pinned={null}
        hostId="host-1"
        moderatorIds={[]}
        variant="panel"
      />,
    )

    const photos = screen.getAllByRole('img', { name: 'Photo from Abebe' })
    expect(photos.map((photo) => photo.getAttribute('src'))).toEqual([
      'https://media.example/chat-images/p1.jpg',
      'https://media.example/chat-images/p2.jpg',
    ])
    expect(screen.getByText('Tonight!')).toBeInTheDocument()
  })

  it('never puts anything but a web address in a link', () => {
    render(
      <ChatList
        messages={[message({ imageUrl: 'javascript:alert(1)', text: 'x' })]}
        pinned={null}
        hostId="host-1"
        moderatorIds={[]}
        variant="panel"
      />,
    )

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
