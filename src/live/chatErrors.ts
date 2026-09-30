/** What a refused chat message tells the sender - the app's own wording (live_chat_controller.dart). */
export function chatErrorMessage(code: string): string {
  switch (code) {
    case 'RATE_LIMITED':
      return "You're sending messages too fast. Try again in a moment."
    case 'MESSAGE_TOO_LONG':
      return 'Too long to send - keep it under 200 characters.'
    case 'CHAT_MUTED':
      return "Not sent - you're muted in this chat."
    case 'MESSAGE_BLOCKED':
      return "Not sent - it breaks this live's chat rules."
    case 'LINK_NOT_ALLOWED':
      return "Not sent - links aren't allowed in chat."
    case 'NOT_IN_ROOM':
    case 'STREAM_NOT_LIVE':
      return 'Not sent - this live is over.'
    default:
      return "Couldn't send that. Try again."
  }
}
