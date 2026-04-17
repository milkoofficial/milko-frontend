const { query } = require('../config/database');

/**
 * Site Content Model
 * Handles all database operations for site content (Terms, Privacy, About, Contact, Reviews)
 */

/**
 * Get content by type (public - only active)
 * @param {string} contentType - 'terms', 'privacy', 'about', 'contact', 'reviews'
 * @returns {Promise<Object|null>} Content object or null
 */
const getContentByType = async (contentType) => {
  const result = await query(
    'SELECT * FROM site_content WHERE content_type = $1 AND is_active = true',
    [contentType]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    contentType: row.content_type,
    title: row.title,
    content: row.content,
    metadata: row.metadata || {},
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

/**
 * Get content by type (admin - includes inactive)
 * @param {string} contentType - 'terms', 'privacy', 'about', 'contact', 'reviews'
 * @returns {Promise<Object|null>} Content object or null
 */
const getContentByTypeAdmin = async (contentType) => {
  const result = await query(
    'SELECT * FROM site_content WHERE content_type = $1',
    [contentType]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    contentType: row.content_type,
    title: row.title,
    content: row.content,
    metadata: row.metadata || {},
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

/**
 * Get all content (admin only)
 * @returns {Promise<Array>} Array of content objects
 */
const getAllContent = async () => {
  const result = await query(
    'SELECT * FROM site_content ORDER BY content_type ASC'
  );

  return result.rows.map(row => ({
    id: row.id,
    contentType: row.content_type,
    title: row.title,
    content: row.content,
    metadata: row.metadata || {},
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

/**
 * Create or update content
 * @param {string} contentType - Content type
 * @param {Object} data - { title, content, metadata }
 * @returns {Promise<Object>} Created/updated content
 */
const upsertContent = async (contentType, data) => {
  const { title, content, metadata = {} } = data;

  const result = await query(
    `INSERT INTO site_content (content_type, title, content, metadata, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (content_type) 
     DO UPDATE SET 
       title = EXCLUDED.title,
       content = EXCLUDED.content,
       metadata = EXCLUDED.metadata,
       updated_at = NOW()
     RETURNING *`,
    [contentType, title, content, JSON.stringify(metadata)]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    contentType: row.content_type,
    title: row.title,
    content: row.content,
    metadata: row.metadata || {},
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

/**
 * Update content active status
 * @param {string} contentType - Content type
 * @param {boolean} isActive - Active status
 * @returns {Promise<Object>} Updated content
 */
const updateContentStatus = async (contentType, isActive) => {
  const result = await query(
    `UPDATE site_content 
     SET is_active = $1, updated_at = NOW()
     WHERE content_type = $2
     RETURNING *`,
    [isActive, contentType]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    contentType: row.content_type,
    title: row.title,
    content: row.content,
    metadata: row.metadata || {},
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

module.exports = {
  getContentByType,
  getContentByTypeAdmin,
  getAllContent,
  upsertContent,
  updateContentStatus,
};
