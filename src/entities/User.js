import { base44 } from '@/api/base44Client';

// Legacy '@/entities/User' shim: merges the standard entity CRUD surface
// (delegating to base44.entities.User) with the auth-scoped current-user
// helpers historically imported from this path.
export const User = {
  list: (sort, limit, skip, fields) => base44.entities.User.list(sort, limit, skip, fields),
  filter: (query, sort, limit, skip, fields) => base44.entities.User.filter(query, sort, limit, skip, fields),
  get: (id) => base44.entities.User.get(id),
  create: (data) => base44.entities.User.create(data),
  update: (id, data) => base44.entities.User.update(id, data),
  delete: (id) => base44.entities.User.delete(id),
  bulkCreate: (data) => base44.entities.User.bulkCreate(data),

  me: () => base44.auth.me(),
  updateMe: (data) => base44.auth.updateMe(data),
  // Alias retained for the legacy call site in src/pages/MyProfile.jsx:226.
  updateMyUserData: (data) => base44.auth.updateMe(data),
  logout: (redirectUrl) => base44.auth.logout(redirectUrl),
};

export default User;
