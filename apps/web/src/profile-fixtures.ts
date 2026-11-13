export const profileFixture = {
  id: 'profile-user',
  name: 'Alex',
  isAdministrator: false,
  canEdit: true,
  hasPassword: true,
  imageTag: null,
  google: null,
}
export const avatarFixture =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><defs><linearGradient id="g"><stop stop-color="#4ade80"/><stop offset="1" stop-color="#3b82f6"/></linearGradient></defs><rect width="200" height="200" fill="#142235"/><circle cx="100" cy="76" r="34" fill="url(#g)"/><ellipse cx="100" cy="185" rx="70" ry="65" fill="url(#g)"/></svg>',
  )
