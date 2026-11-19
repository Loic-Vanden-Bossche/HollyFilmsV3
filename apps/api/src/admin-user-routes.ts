import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { AdminUserPolicy } from '@hollyfilms/shared/accounts'
import type { ServerConfig } from './config.ts'
import type { adminUserService } from './admin-users.ts'
import {
  adminUserPolicySchema,
  getAdminUserOptions,
} from './admin-user-policy.ts'

const base = '/api/admin/users'
const params = {
  type: 'object',
  required: ['id'],
  properties: {
    id: {
      type: 'string',
      pattern:
        '^(?:[a-fA-F0-9]{32}|[a-fA-F0-9]{8}-(?:[a-fA-F0-9]{4}-){3}[a-fA-F0-9]{12})$',
    },
  },
}
const username = { type: 'string', minLength: 1, maxLength: 255 }
const password = { type: 'string', minLength: 8, maxLength: 1024 }
const body = (properties: Record<string, object>) => ({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
})
type Id = { id: string }

export function addAdminUserRoutes(
  app: FastifyInstance,
  config: ServerConfig,
  users: ReturnType<typeof adminUserService>,
  requireAdmin: (request: FastifyRequest) => Promise<string>,
) {
  async function change(
    request: FastifyRequest,
    reply: FastifyReply,
    operation: (actor: string) => Promise<void>,
  ) {
    await users.mutate(() => requireAdmin(request), operation)
    return reply.code(204).send()
  }

  app.get(base, async (request) => {
    await requireAdmin(request)
    return users.list()
  })
  app.get(`${base}/options`, async (request) => {
    await requireAdmin(request)
    return getAdminUserOptions(config)
  })
  app.get<{ Params: Id }>(
    `${base}/:id`,
    { schema: { params } },
    async (request) =>
      users.details(request.params.id, await requireAdmin(request)),
  )
  app.post<{ Body: { username: string; password: string } }>(
    base,
    { schema: { body: body({ username, password }) } },
    (request, reply) =>
      change(request, reply, () =>
        users.create(request.body.username, request.body.password),
      ),
  )
  app.put<{ Params: Id; Body: { disabled: boolean } }>(
    `${base}/:id/access`,
    { schema: { params, body: body({ disabled: { type: 'boolean' } }) } },
    (request, reply) =>
      change(request, reply, (actor) =>
        users.setAccess(request.params.id, actor, request.body.disabled),
      ),
  )
  app.put<{ Params: Id; Body: { policy: AdminUserPolicy } }>(
    `${base}/:id/policy`,
    { schema: { params, body: adminUserPolicySchema } },
    (request, reply) =>
      change(request, reply, (actor) =>
        users.setPolicy(request.params.id, actor, request.body.policy),
      ),
  )
  app.put<{ Params: Id; Body: { username: string } }>(
    `${base}/:id/username`,
    { schema: { params, body: body({ username }) } },
    (request, reply) =>
      change(request, reply, (actor) =>
        users.rename(request.params.id, actor, request.body.username),
      ),
  )
  app.put<{ Params: Id; Body: { password: string } }>(
    `${base}/:id/password`,
    { schema: { params, body: body({ password }) } },
    (request, reply) =>
      change(request, reply, (actor) =>
        users.setPassword(request.params.id, actor, request.body.password),
      ),
  )
  app.delete<{ Params: Id }>(
    `${base}/:id`,
    { schema: { params } },
    (request, reply) =>
      change(request, reply, (actor) => users.remove(request.params.id, actor)),
  )
}
