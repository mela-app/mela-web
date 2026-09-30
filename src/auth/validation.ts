import type { SignupFields } from '../lib/session'

// The same rules the API applies (backend: auth/dto/signup.dto.ts).
const USERNAME = /^[a-zA-Z0-9_]{3,24}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type SignupProblems = Partial<Record<keyof SignupFields, string>>

/** What's wrong with a sign-up, field by field - empty when it's good to send. */
export function signupProblems(fields: SignupFields): SignupProblems {
  const problems: SignupProblems = {}
  const name = fields.displayName.trim()
  if (!name) problems.displayName = 'Enter your name.'
  else if (name.length > 50) problems.displayName = 'Use 50 characters or fewer.'
  if (!USERNAME.test(fields.username)) problems.username = '3-24 letters, numbers or underscores.'
  if (!EMAIL.test(fields.email.trim())) problems.email = 'Enter a valid email address.'
  if (fields.password.length < 8) problems.password = 'Use at least 8 characters.'
  else if (fields.password.length > 72) problems.password = 'Use 72 characters or fewer.'
  return problems
}
