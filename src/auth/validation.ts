import { api } from '../lib/api'

// The same rules the API applies (backend: auth/dto/identity.dto.ts).
const USERNAME = /^[a-zA-Z0-9_]{3,24}$/

export interface NewAccountFields {
  displayName: string
  username: string
}

export type NewAccountProblems = Partial<Record<keyof NewAccountFields, string>>

/** What's wrong with a new account's name and username - empty when it's good to send. */
export function newAccountProblems(fields: NewAccountFields): NewAccountProblems {
  const problems: NewAccountProblems = {}
  const name = fields.displayName.trim()
  if (!name) problems.displayName = 'Enter your name.'
  else if (name.length > 50) problems.displayName = 'Use 50 characters or fewer.'
  if (!USERNAME.test(fields.username)) problems.username = '3-24 letters, numbers or underscores.'
  return problems
}

/** Whether nobody has [username] yet, whatever its case. */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { available } = await api<{ available: boolean }>(
    `/v1/auth/username-available?username=${encodeURIComponent(username)}`,
  )
  return available
}
