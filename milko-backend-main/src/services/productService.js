const productModel = require('../models/product');
const productImageModel = require('../models/productImage');
const productVariationModel = require('../models/productVariation');
const productReviewModel = require('../models/productReview');
const { uploadImage, deleteImage } = require('../config/cloudinary');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { query } = require('../config/database');

/**
 * Product Service
 * Handles product business logic
 */

/**
 * Get all active products (for customers)
 * @returns {Promise<Array>} Array of active products
 */
const getActiveProducts = async () => {
  return await productModel.getActiveProducts();
};

/**
 * Get all products (for admin)
 * @returns {Promise<Array>} Array of all products
 */
const getAllProducts = async () => {
  return await productModel.getAllProducts();
};

/**
 * Get product feedback aggregates from order feedback
 * @param {string} productId - Product ID
 * @returns {Promise<Object>} Feedback aggregates with averages for each category
 */
const getProductFeedbackAggregates = async (productId) => {
  try {
    const result = await query(
      `SELECT 
        AVG(of.quality_stars) FILTER (WHERE of.quality_stars IS NOT NULL) as avg_quality_stars,
        AVG(of.delivery_agent_stars) FILTER (WHERE of.delivery_agent_stars IS NOT NULL) as avg_delivery_agent_stars,
        AVG(of.on_time_stars) FILTER (WHERE of.on_time_stars IS NOT NULL) as avg_on_time_stars,
        AVG(of.value_for_money_stars) FILTER (WHERE of.value_for_money_stars IS NOT NULL) as avg_value_for_money_stars,
        COUNT(of.quality_stars) FILTER (WHERE of.quality_stars IS NOT NULL) as quality_count,
        COUNT(of.delivery_agent_stars) FILTER (WHERE of.delivery_agent_stars IS NOT NULL) as delivery_agent_count,
        COUNT(of.on_time_stars) FILTER (WHERE of.on_time_stars IS NOT NULL) as on_time_count,
        COUNT(of.value_for_money_stars) FILTER (WHERE of.value_for_money_stars IS NOT NULL) as value_for_money_count
       FROM order_feedback of
       INNER JOIN orders o ON of.order_id = o.id
       INNER JOIN order_items oi ON o.id = oi.order_id
       WHERE oi.product_id = $1
         AND of.quality_stars IS NOT NULL`,
      [productId]
    );

    // Get rating distribution for quality stars (1-5)
    const distributionResult = await query(
      `SELECT 
        of.quality_stars,
        COUNT(*) as count
       FROM order_feedback of
       INNER JOIN orders o ON of.order_id = o.id
       INNER JOIN order_items oi ON o.id = oi.order_id
       WHERE oi.product_id = $1
         AND of.quality_stars IS NOT NULL
       GROUP BY of.quality_stars
       ORDER BY of.quality_stars DESC`,
      [productId]
    );

    // Build rating distribution object (1-5 stars)
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    distributionResult.rows.forEach((row) => {
      const stars = parseInt(row.quality_stars, 10);
      if (stars >= 1 && stars <= 5) {
        ratingDistribution[stars] = parseInt(row.count || 0, 10);
      }
    });

    const row = result.rows[0] || {};
    return {
      qualityStars: row.avg_quality_stars ? parseFloat(row.avg_quality_stars) : null,
      deliveryAgentStars: row.avg_delivery_agent_stars ? parseFloat(row.avg_delivery_agent_stars) : null,
      onTimeStars: row.avg_on_time_stars ? parseFloat(row.avg_on_time_stars) : null,
      valueForMoneyStars: row.avg_value_for_money_stars ? parseFloat(row.avg_value_for_money_stars) : null,
      qualityCount: parseInt(row.quality_count || 0, 10),
      deliveryAgentCount: parseInt(row.delivery_agent_count || 0, 10),
      onTimeCount: parseInt(row.on_time_count || 0, 10),
      valueForMoneyCount: parseInt(row.value_for_money_count || 0, 10),
      ratingDistribution,
    };
  } catch (error) {
    console.warn('[ProductService] Error fetching feedback aggregates:', error.message);
    // Return empty aggregates if query fails
    return {
      qualityStars: null,
      deliveryAgentStars: null,
      onTimeStars: null,
      valueForMoneyStars: null,
      qualityCount: 0,
      deliveryAgentCount: 0,
      onTimeCount: 0,
      valueForMoneyCount: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
  }
};

/**
 * Get product by ID (with details)
 * @param {string} productId - Product ID
 * @param {boolean} includeDetails - Whether to include images, variations, and reviews
 * @returns {Promise<Object>} Product object
 */
const getProductById = async (productId, includeDetails = false) => {
  const product = await productModel.getProductById(productId);
  if (!product) {
    throw new NotFoundError('Product');
  }

  if (includeDetails) {
    const [images, variations, reviews, feedbackAggregates] = await Promise.all([
      productImageModel.getProductImages(productId),
      productVariationModel.getProductVariations(productId),
      productReviewModel.getProductReviews(productId),
      getProductFeedbackAggregates(productId),
    ]);

    return {
      ...product,
      images,
      variations,
      reviews,
      feedbackAggregates,
    };
  }

  return product;
};

/**
 * Create new product (admin only)
 * @param {Object} productData - Product data
 * @param {Object} imageFile - Image file (optional)
 * @returns {Promise<Object>} Created product
 */
const createProduct = async (productData, imageFile = null) => {
  const { 
    name, 
    description, 
    pricePerLitre, 
    isActive, 
    quantity, 
    lowStockThreshold, 
    categoryId, 
    suffixAfterPrice,
    sellingPrice,
    compareAtPrice
  } = productData;

  // Validate required fields
  if (!name || !pricePerLitre) {
    throw new ValidationError('Name and price are required');
  }

  let imageUrl = null;

  // Upload image if provided
  if (imageFile) {
    const uploadResult = await uploadImage(imageFile.buffer, {
      resource_type: 'image',
      folder: 'milko/products',
    });
    imageUrl = uploadResult.url;
  }

  const parsedSelling = sellingPrice ? parseFloat(sellingPrice) : null;
  const parsedCompare = compareAtPrice ? parseFloat(compareAtPrice) : null;

  if (parsedSelling !== null && parsedCompare !== null && parsedSelling > parsedCompare) {
    throw new ValidationError('Selling Price cannot be greater than Compare At Price');
  }

  return await productModel.createProduct({
    name,
    description,
    pricePerLitre,
    imageUrl,
    isActive: isActive !== undefined ? isActive : true,
    quantity: quantity !== undefined ? parseInt(quantity) : 0,
    lowStockThreshold: lowStockThreshold !== undefined ? parseInt(lowStockThreshold) : 10,
    categoryId: categoryId || null,
    suffixAfterPrice: suffixAfterPrice || 'Litres',
    sellingPrice: parsedSelling,
    compareAtPrice: parsedCompare,
  });
};

/**
 * Update product (admin only)
 * @param {string} productId - Product ID
 * @param {Object} updates - Fields to update
 * @param {Object} imageFile - New image file (optional)
 * @returns {Promise<Object>} Updated product
 */
const updateProduct = async (productId, updates, imageFile = null) => {
  const product = await productModel.getProductById(productId);
  if (!product) {
    throw new NotFoundError('Product');
  }

  // Handle image upload if new image provided
  if (imageFile) {
    // Delete old image if exists
    if (product.image_url) {
      try {
        // Extract public_id from Cloudinary URL
        const urlParts = product.image_url.split('/');
        const publicId = urlParts.slice(-2).join('/').split('.')[0];
        await deleteImage(`milko/products/${publicId}`);
      } catch (error) {
        console.error('Error deleting old image:', error);
        // Continue even if deletion fails
      }
    }

    // Upload new image
    const uploadResult = await uploadImage(imageFile.buffer, {
      resource_type: 'image',
      folder: 'milko/products',
    });
    updates.imageUrl = uploadResult.url;
  }

  // Validate updated discount pricing (fallback to existing values when not provided)
  const nextSelling = updates.sellingPrice !== undefined ? updates.sellingPrice : product.sellingPrice;
  const nextCompare = updates.compareAtPrice !== undefined ? updates.compareAtPrice : product.compareAtPrice;
  if (nextSelling !== null && nextSelling !== undefined && nextCompare !== null && nextCompare !== undefined) {
    if (Number(nextSelling) > Number(nextCompare)) {
      throw new ValidationError('Selling Price cannot be greater than Compare At Price');
    }
  }

  return await productModel.updateProduct(productId, updates);
};

/**
 * Delete product (admin only)
 * Soft delete by setting is_active to false
 * @param {string} productId - Product ID
 * @returns {Promise<Object>} Deleted product
 */
const deleteProduct = async (productId) => {
  const product = await productModel.getProductById(productId);
  if (!product) {
    throw new NotFoundError('Product');
  }

  return await productModel.deleteProduct(productId);
};

module.exports = {
  getActiveProducts,
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};

