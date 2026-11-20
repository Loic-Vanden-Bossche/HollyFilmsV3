import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto.js'
import {
  Prisma,
  type PrismaClient,
  type Registration,
} from './generated/prisma/client.ts'
import type { jellyfinAccounts } from './jellyfin.ts'

const generatedName = /^Google-[0-9a-f]{24}$/i

function profileUsername(name: string | null) {
  const username = name
    ?.normalize('NFC')
    .replace(/[’‘]/gu, "'")
    .replace(/\p{Pd}/gu, '-')
    .replace(/[^\p{L}\p{Mn}\p{Nd}\p{Pc}.@+'-]+/gu, ' ')
    .trim()
  if (
    !username ||
    username === '.' ||
    username === '..' ||
    /^hf-setup-/i.test(username) ||
    generatedName.test(username)
  )
    return null
  return username
}

export function linkedUsername(account: UserDto, id: string) {
  if (account.Id !== id || !account.Name)
    throw new Error('Compte Jellyfin inattendu')
  return account.Name
}

export async function syncGoogleUsername(
  db: PrismaClient,
  jellyfin: ReturnType<typeof jellyfinAccounts>,
  registration: Registration,
  account: UserDto,
) {
  const id = registration.jellyfinId
  if (registration.method !== 'GOOGLE' || !id)
    throw new Error('Compte Google incomplet')
  const current = linkedUsername(account, id)
  const setup =
    registration.status === 'PROVISIONING' &&
    current === registration.technicalName
  const canRename = setup || generatedName.test(current)
  // A name already chosen in Jellyfin takes precedence, including after an
  // interrupted rename whose database transaction never committed.
  let preferred = current
  if (canRename) {
    preferred = generatedName.test(registration.username)
      ? (profileUsername(registration.googleName) ?? registration.username)
      : registration.username
  }
  if (current === preferred && current === registration.username) return current

  const occupied = new Set(
    canRename
      ? (await jellyfin.list())
          .filter((user) => user.Id !== id)
          .map((user) => user.Name?.toUpperCase())
      : [],
  )
  for (let number = 1; ; number++) {
    const username = number === 1 ? preferred : `${preferred} ${number}`
    const usernameKey = username.toUpperCase()
    if (occupied.has(usernameKey)) continue
    try {
      return await db.$transaction(
        async (tx) => {
          // The unique key reserves this spelling across registrations. A parallel
          // sign-in that changed this row first has already updated Jellyfin.
          const claimed = await tx.registration.updateMany({
            where: {
              id: registration.id,
              jellyfinId: id,
              usernameKey: registration.usernameKey,
            },
            data: { username, usernameKey },
          })
          if (!claimed.count)
            return linkedUsername(await jellyfin.account(id), id)
          if (current !== username) {
            const latest = await jellyfin.account(id)
            if (
              linkedUsername(latest, id) !== current &&
              latest.Name !== username
            )
              throw new Error('Le nom du compte Jellyfin a changé')
            await jellyfin.rename(id, latest, username)
          }
          return username
        },
        { timeout: 15_000 },
      )
    } catch (error) {
      if (!(
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ))
        throw error
      // A manually chosen live name can coincide with a pending reservation.
      // Authenticate the linked account by its real name; leave the reservation intact.
      if (!canRename) return current
    }
  }
}
