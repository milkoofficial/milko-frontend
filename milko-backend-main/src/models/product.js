const { query } = require('../config/database');
const { transformProduct } = require('../utils/transform');

/**
 * Product Model
 * Handles all database operations for products
 */

/**
 * Create a new product
 * @param {Object} productData - Product data
 * @returns {Promise<Object>} Created product (camelCase format)
 */
const createProduct = async (productData) => {
  const { 
    name, 
    description, 
    pricePerLitre, 
    imageUrl, 
    isActive = true,
    isMembershipEligible = false,
    quantity = 0,
    lowStockThreshold = 10,
    categoryId = null,
    suffixAfterPrice = 'Litres',
    sellingPrice = null,
    compareAtPrice = null
  } = productData;

  const result = await query(
    `INSERT INTO products (
      name, description, price_per_litre, image_url, is_active, 
      is_membership_eligible, quantity, low_stock_threshold, category_id, suffix_after_price,
      selling_price, compare_at_price,
      created_at, updated_at
    )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
     RETURNING *`,
    [name, description, pricePerLitre, imageUrl, isActive, isMembershipEligible, quantity, lowStockThreshold, categoryId, suffixAfterPrice, sellingPrice, compareAtPrice]
  );

  return transformProduct(result.rows[0]);
};

/**
 * Get all active products (for customers)
 * @returns {Promise<Array>} Array of active products (camelCase format)
 */
const getActiveProducts = async () => {
  const result = await query(
    'SELECT * FROM products WHERE is_active = true ORDER BY created_at DESC'
  );

  return result.rows.map(transformProduct);
};

/**
 * Get all products (for admin - includes inactive)
 * @returns {Promise<Array>} Array of all products (camelCase format)
 */
const getAllProducts = async () => {
  const result = await query(
    'SELECT * FROM products ORDER BY created_at DESC'
  );

  return result.rows.map(transformProduct);
};

/**
 * Get product by ID
 * @param {string} productId - Product ID
 * @returns {Promise<Object|null>} Product object or null (camelCase format)
 */
const getProductById = async (productId) => {
  const result = await query(
    'SELECT * FROM products WHERE id = $1',
    [productId]
  );

  return transformProduct(result.rows[0] || null);
};

/**
 * Update product
 * @param {string} productId - Product ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated product (camelCase format)
 */
const updateProduct = async (productId, updates) => {
  const fields = [];
  const values = [];
  let paramCount = 1;

  Object.keys(updates).forEach((key) => {
    // Map camelCase to snake_case
    const dbKey = key === 'pricePerLitre' ? 'price_per_litre' : 
                  key === 'imageUrl' ? 'image_url' : 
                  key === 'isActive' ? 'is_active' : 
                  key === 'isMembershipEligible' ? 'is_membership_eligible' :
                  key === 'lowStockThreshold' ? 'low_stock_threshold' : 
                  key === 'categoryId' ? 'category_id' : 
                  key === 'suffixAfterPrice' ? 'suffix_after_price' :
                  key === 'sellingPrice' ? 'selling_price' :
                  key === 'compareAtPrice' ? 'compare_at_price' : key;
    
    fields.push(`${dbKey} = $${paramCount}`);
    values.push(updates[key]);
    paramCount++;
  });

  fields.push(`updated_at = NOW()`);
  values.push(productId);

  const result = await query(
    `UPDATE products 
     SET ${fields.join(', ')} 
     WHERE id = $${paramCount}
     RETURNING *`,
    values
  );

  return transformProduct(result.rows[0]);
};

/**
 * Delete product (soft delete by setting is_active to false)
 * @param {string} productId - Product ID
 * @returns {Promise<Object>} Deleted product (camelCase format)
 */
const deleteProduct = async (productId) => {
  const result = await query(
    `UPDATE products 
     SET is_active = false, updated_at = NOW() 
     WHERE id = $1
     RETURNING *`,
    [productId]
  );

  return transformProduct(result.rows[0]);
};

module.exports = {
  createProduct,
  getActiveProducts,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
};

