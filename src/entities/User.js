import { base44 } from '@/api/base44Client';

// Legacy '@/entities/User' shim: merges the standard entity CRUD surface
// (delegating to base44.entities.User) with the auth-scoped current-user
// helpers historically imported from this path.
export const User = {
  list: (...args) => base44.entities.User.list(...args),
  filter: (...args) => base44.entities.User.filter(...args),
  get: (...args) => base44.entities.User.get(...args),
  create: (...args) => base44.entities.User.create(...args),
  update: (...args) => base44.entities.User.update(...args),
  delete: (...args) => base44.entities.User.delete(...args),
  bulkCreate: (...args) => base44.entities.User.bulkCreate(...args),

  me: (...args) => base44.auth.me(...args),
  updateMe: (...args) => base44.auth.updateMe(...args),
  // Alias retained for the legacy call site in src/pages/MyProfile.jsx:226.
  updateMyUserData: (...args) => base44.auth.updateMe(...args),
  logout: (...args) => base44.auth.logout(...args),
};

export default User;
