const { query } = require('../config/database');

/**
 * Product Image Model
 * Handles database operations for product images
 */

/**
 * Create a new product image
 */
const createProductImage = async (productId, imageUrl, displayOrder = 0) => {
  const result = await query(
    `INSERT INTO product_images (product_id, image_url, display_order, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     RETURNING *`,
    [productId, imageUrl, displayOrder]
  );

  return {
    id: result.rows[0].id.toString(),
    productId: result.rows[0].product_id.toString(),
    imageUrl: result.rows[0].image_url,
    displayOrder: result.rows[0].display_order,
    createdAt: result.rows[0].created_at.toISOString(),
    updatedAt: result.rows[0].updated_at.toISOString(),
  };
};

/**
 * Get all images for a product
 */
const getProductImages = async (productId) => {
  try {
    const result = await query(
      `SELECT * FROM product_images 
       WHERE product_id = $1 
       ORDER BY display_order ASC, created_at ASC`,
      [productId]
    );

    return result.rows.map(row => ({
      id: row.id.toString(),
      productId: row.product_id.toString(),
      imageUrl: row.image_url,
      displayOrder: row.display_order,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }));
  } catch (err) {
    // If the migration hasn't been applied yet, don't break product details fetch.
    // Postgres: err.code === '42P01' (undefined_table)
    if (err?.code === '42P01' || err?.message?.includes('relation "product_images" does not exist')) {
      console.warn('[product_images] Table missing (migration not applied). Returning empty images array.');
      return [];
    }
    throw err;
  }
};

/**
 * Delete a product image
 */
const deleteProductImage = async (imageId) => {
  const result = await query(
    'DELETE FROM product_images WHERE id = $1 RETURNING *',
    [imageId]
  );

  return result.rows[0] ? {
    id: result.rows[0].id.toString(),
    productId: result.rows[0].product_id.toString(),
    imageUrl: result.rows[0].image_url,
  } : null;
};

/**
 * Update image display order
 */
const updateImageOrder = async (imageId, displayOrder) => {
  const result = await query(
    `UPDATE product_images 
     SET display_order = $1, updated_at = NOW() 
     WHERE id = $2 
     RETURNING *`,
    [displayOrder, imageId]
  );

  return result.rows[0] ? {
    id: result.rows[0].id.toString(),
    productId: result.rows[0].product_id.toString(),
    imageUrl: result.rows[0].image_url,
    displayOrder: result.rows[0].display_order,
  } : null;
};

module.exports = {
  createProductImage,
  getProductImages,
  deleteProductImage,
  updateImageOrder,
};

