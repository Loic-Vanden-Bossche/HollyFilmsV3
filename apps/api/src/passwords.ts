import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export function encryptPassword(
  password: string,
  key: Buffer,
  accountId: string,
) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(Buffer.from(accountId))
  const ciphertext = Buffer.concat([
    cipher.update(password, 'utf8'),
    cipher.final(),
  ])
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString(
    'base64url',
  )
}

export function decryptPassword(value: string, key: Buffer, accountId: string) {
  const bytes = Buffer.from(value, 'base64url')
  const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12))
  cipher.setAAD(Buffer.from(accountId))
  cipher.setAuthTag(bytes.subarray(12, 28))
  return Buffer.concat([
    cipher.update(bytes.subarray(28)),
    cipher.final(),
  ]).toString('utf8')
}
