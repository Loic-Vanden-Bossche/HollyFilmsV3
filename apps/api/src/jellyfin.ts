import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto.js'
import { getUserApi } from '@jellyfin/sdk/lib/utils/api/user-api.js'
import {
  authenticateJellyfin,
  createJellyfinApi,
  isJellyfinAccessDenied,
} from '@hollyfilms/shared/jellyfin'
import type { ServerConfig } from './config.ts'
import { ApiError } from './errors.ts'

const options = { timeout: 5_000, maxRedirects: 0 }

export function jellyfinAccounts(config: ServerConfig) {
  const management = getUserApi(
    createJellyfinApi(
      config.jellyfinUrl,
      'hollyfilms-management',
      config.jellyfinApiKey,
    ),
  )

  return {
    async admin(token: string, deviceId?: string) {
      try {
        const { data } = await getUserApi(
          createJellyfinApi(config.jellyfinUrl, deviceId, token),
        ).getCurrentUser(options)
        if (
          data?.Id &&
          data.Policy?.IsAdministrator === true &&
          data.Policy.IsDisabled !== true
        )
          return data.Id
      } catch (error) {
        if (
          !isJellyfinAccessDenied(error) &&
          !(error instanceof Error && 'status' in error && error.status === 400)
        ) {
          throw new ApiError(
            503,
            'JELLYFIN_UNAVAILABLE',
            'Impossible de vérifier les droits auprès de Jellyfin.',
          )
        }
      }
      throw new ApiError(
        403,
        'ADMIN_REQUIRED',
        'Un compte administrateur Jellyfin est requis.',
      )
    },

    async signIn(username: string, password: string, expectedUserId?: string) {
      try {
        return await authenticateJellyfin(
          config.jellyfinUrl,
          username,
          password,
          expectedUserId,
        )
      } catch (error) {
        if (isJellyfinAccessDenied(error)) {
          throw new ApiError(
            401,
            'INVALID_CREDENTIALS',
            'Jellyfin a refusé la connexion. Vérifie tes identifiants.',
          )
        }
        throw new ApiError(
          503,
          'JELLYFIN_UNAVAILABLE',
          'Impossible d’ouvrir une session Jellyfin. Réessaie dans un instant.',
        )
      }
    },

    async list() {
      try {
        return (await management.getUsers({}, options)).data
      } catch {
        throw new ApiError(
          503,
          'JELLYFIN_UNAVAILABLE',
          'Impossible de consulter les comptes Jellyfin.',
        )
      }
    },

    async create(name: string, password: string) {
      const { data } = await management.createUserByName(
        { createUserByName: { Name: name, Password: password } },
        options,
      )
      if (!data?.Id) throw new Error('Identifiant Jellyfin absent')
      return data.Id
    },

    async account(id: string) {
      return (await management.getUserById({ userId: id }, options)).data
    },

    async setPolicy(
      id: string,
      account: UserDto,
      disabled: boolean,
      hidden: boolean,
    ) {
      if (
        !account.Policy ||
        account.Policy.IsAdministrator ||
        account.Id !== id
      ) {
        throw new Error('Politique Jellyfin inattendue')
      }
      await management.updateUserPolicy(
        {
          userId: id,
          userPolicy: {
            ...account.Policy,
            IsAdministrator: false,
            IsDisabled: disabled,
            IsHidden: hidden,
            EnableAllFolders: true,
          },
        },
        options,
      )
    },

    async rename(id: string, account: UserDto, username: string) {
      if (account.Name === username) return
      if (!account.Configuration || account.Id !== id)
        throw new Error('Compte Jellyfin incomplet')
      await management.updateUser(
        { userId: id, userDto: { ...account, Name: username } },
        options,
      )
    },

    async setPassword(id: string, password: string) {
      await management.updateUserPassword(
        { userId: id, updateUserPassword: { NewPw: password } },
        options,
      )
    },
  }
}
