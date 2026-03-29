const { query } = require('../config/database');
const { transformUser } = require('../utils/transform');

/**
 * User Model
 * Handles all database operations for user profiles
 * Note: Authentication is handled by Supabase Auth
 * This model only manages user profile data (name, role, etc.)
 */

/**
 * Create a user profile
 * Note: This only creates a profile record. User must be created via Supabase Auth first.
 * @param {Object} userData - User data (id, name, email, role)
 * @returns {Promise<Object>} Created user profile (camelCase format)
 */
const createUser = async (userData) => {
  const { id, name, email, role = 'customer' } = userData;

  // Note: id should be the UUID from Supabase auth.users
  const result = await query(
    `INSERT INTO users (id, name, email, role, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET name = $2, email = $3, updated_at = NOW()
     RETURNING id, name, email, role, created_at, updated_at`,
    [id, name, email, role]
  );

  return transformUser(result.rows[0]);
};

/**
 * Find user by email
 * @param {string} email - User email
 * @returns {Promise<Object|null>} User object or null (camelCase format)
 */
const findByEmail = async (email) => {
  const result = await query(
    'SELECT id, name, email, role, created_at, updated_at FROM users WHERE email = $1',
    [email]
  );

  return result.rows.length > 0 ? transformUser(result.rows[0]) : null;
};

/**
 * Find user by ID
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} User object or null (camelCase format)
 */
const findById = async (userId) => {
  const result = await query(
    'SELECT id, name, email, role, created_at, updated_at FROM users WHERE id = $1',
    [userId]
  );

  return transformUser(result.rows[0] || null);
};

/**
 * Get all users (for admin)
 * @param {Object} options - Query options (limit, offset)
 * @returns {Promise<Array>} Array of users (camelCase format)
 */
const getAllUsers = async (options = {}) => {
  const { limit = 100, offset = 0 } = options;

  const result = await query(
    `SELECT id, name, email, role, created_at, updated_at 
     FROM users 
     ORDER BY created_at DESC 
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return result.rows.map(transformUser);
};

/**
 * Verify password
 * Note: Password verification is now handled by Supabase Auth
 * This function is kept for backward compatibility but should not be used
 * @deprecated Use Supabase Auth for password verification
 */
const verifyPassword = async (password, hashedPassword) => {
  // This should not be used anymore - Supabase handles password verification
  throw new Error('Password verification is handled by Supabase Auth. Use supabase.auth.signInWithPassword() instead.');
};

/**
 * Update user profile
 * Note: Password updates should be done via Supabase Auth API
 * @param {string} userId - User ID (UUID from Supabase)
 * @param {Object} updates - Fields to update (name, email, role)
 * @returns {Promise<Object>} Updated user (camelCase format)
 */
const updateUser = async (userId, updates) => {
  const fields = [];
  const values = [];
  let paramCount = 1;

  // Only allow updating name, email, and role
  const allowedFields = ['name', 'email', 'role'];
  Object.keys(updates).forEach((key) => {
    if (allowedFields.includes(key)) {
      fields.push(`${key} = $${paramCount}`);
      values.push(updates[key]);
      paramCount++;
    }
  });

  // Password updates should be done via Supabase Auth
  if (updates.password) {
    throw new Error('Password updates must be done via Supabase Auth API. Use supabase.auth.updateUser() instead.');
  }

  if (fields.length === 0) {
    // No valid fields to update, just return current user
    return await findById(userId);
  }

  fields.push(`updated_at = NOW()`);
  values.push(userId);

  const result = await query(
    `UPDATE users 
     SET ${fields.join(', ')} 
     WHERE id = $${paramCount}
     RETURNING id, name, email, role, created_at, updated_at`,
    values
  );

  return transformUser(result.rows[0]);
};

module.exports = {
  createUser,
  findByEmail,
  findById,
  getAllUsers,
  verifyPassword,
  updateUser,
};

