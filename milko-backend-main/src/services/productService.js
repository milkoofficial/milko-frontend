const productModel = require('../models/product');
const productImageModel = require('../models/productImage');
const productVariationModel = require('../models/productVariation');
const productReviewModel = require('../models/productReview');
const { uploadImage, deleteImage } = require('../config/cloudinary');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { query } = require('../config/database');

const isSetFinitePrice = (v) => {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string' && v.trim() === '') return false;
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n);
};

/**
 * When a product has variations, clear fixed selling/compare and sync legacy price_per_litre
 * from variation unit prices (explicit price, else base × multiplier).
 */
const applyVariationModePricing = async (productId) => {
  const product = await productModel.getProductById(productId);
  if (!product) return null;

  const variations = await productVariationModel.getProductVariations(productId);
  if (variations.length === 0) return product;

  const base =
    product.sellingPrice != null && product.sellingPrice !== ''
      ? parseFloat(product.sellingPrice)
      : parseFloat(product.pricePerLitre);
  const safeBase = Number.isFinite(base) ? base : 0;

  const unitPrices = variations.map((v) => {
    if (v.price != null && Number.isFinite(parseFloat(v.price))) {
      return parseFloat(v.price);
    }
    return safeBase * parseFloat(v.priceMultiplier || 1);
  });
  const finiteUnits = unitPrices.filter((n) => Number.isFinite(n));
  const minP = finiteUnits.length ? Math.min(...finiteUnits) : safeBase;

  return await productModel.updateProduct(productId, {
    sellingPrice: null,
    compareAtPrice: null,
    pricePerLitre: Number.isFinite(minP) ? minP : product.pricePerLitre,
  });
};

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
        AVG(opdf.quality_stars) FILTER (WHERE opdf.quality_stars IS NOT NULL) as avg_quality_stars,
        AVG(opdf.delivery_agent_stars) FILTER (WHERE opdf.delivery_agent_stars IS NOT NULL) as avg_delivery_agent_stars,
        AVG(opdf.on_time_stars) FILTER (WHERE opdf.on_time_stars IS NOT NULL) as avg_on_time_stars,
        AVG(opdf.value_for_money_stars) FILTER (WHERE opdf.value_for_money_stars IS NOT NULL) as avg_value_for_money_stars,
        COUNT(opdf.quality_stars) FILTER (WHERE opdf.quality_stars IS NOT NULL) as quality_count,
        COUNT(opdf.delivery_agent_stars) FILTER (WHERE opdf.delivery_agent_stars IS NOT NULL) as delivery_agent_count,
        COUNT(opdf.on_time_stars) FILTER (WHERE opdf.on_time_stars IS NOT NULL) as on_time_count,
        COUNT(opdf.value_for_money_stars) FILTER (WHERE opdf.value_for_money_stars IS NOT NULL) as value_for_money_count
       FROM order_product_detailed_feedback opdf
       WHERE opdf.product_id = $1
         AND opdf.quality_stars IS NOT NULL`,
      [productId]
    );

    // Get rating distribution for quality stars (1-5)
    const distributionResult = await query(
      `SELECT 
        opdf.quality_stars,
        COUNT(*) as count
       FROM order_product_detailed_feedback opdf
       WHERE opdf.product_id = $1
         AND opdf.quality_stars IS NOT NULL
       GROUP BY opdf.quality_stars
       ORDER BY opdf.quality_stars DESC`,
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
    maxQuantity,
    categoryId, 
    suffixAfterPrice,
    sellingPrice,
    compareAtPrice,
    taxPercent
  } = productData;

  // Validate required fields
  if (!name || pricePerLitre === undefined || pricePerLitre === null || String(pricePerLitre).trim() === '') {
    throw new ValidationError('Name and price are required');
  }

  const hasSelling = isSetFinitePrice(sellingPrice);
  const hasCompare = isSetFinitePrice(compareAtPrice);

  if (hasSelling !== hasCompare) {
    throw new ValidationError(
      'Set both Selling Price and Compare At Price together, or leave both empty for variation-only products.'
    );
  }

  let parsedSelling = null;
  let parsedCompare = null;

  if (hasSelling && hasCompare) {
    parsedSelling = parseFloat(sellingPrice);
    parsedCompare = parseFloat(compareAtPrice);
    if (parsedSelling > parsedCompare) {
      throw new ValidationError('Selling Price cannot be greater than Compare At Price');
    }
  } else {
    const ppl = parseFloat(pricePerLitre);
    if (!Number.isFinite(ppl) || ppl <= 0) {
      throw new ValidationError(
        'Either set both Selling Price and Compare At Price, or use a positive base price (from your first variation).'
      );
    }
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

  const parsedTaxPercent = taxPercent !== undefined && taxPercent !== null && String(taxPercent).trim() !== ''
    ? Math.max(0, parseFloat(taxPercent))
    : 0;

  return await productModel.createProduct({
    name,
    description,
    pricePerLitre,
    imageUrl,
    isActive: isActive !== undefined ? isActive : true,
    quantity: quantity !== undefined ? parseInt(quantity) : 0,
    lowStockThreshold: lowStockThreshold !== undefined ? parseInt(lowStockThreshold) : 10,
    maxQuantity: maxQuantity !== undefined ? Math.max(1, parseInt(maxQuantity, 10) || 99) : 99,
    categoryId: categoryId || null,
    suffixAfterPrice: suffixAfterPrice || 'Litres',
    sellingPrice: parsedSelling,
    compareAtPrice: parsedCompare,
    taxPercent: Number.isFinite(parsedTaxPercent) ? parsedTaxPercent : 0,
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

  if (Object.prototype.hasOwnProperty.call(updates, 'maxQuantity')) {
    const parsedMaxQuantity = parseInt(updates.maxQuantity, 10);
    updates.maxQuantity = Number.isFinite(parsedMaxQuantity) && parsedMaxQuantity > 0 ? parsedMaxQuantity : 99;
  }

  // Handle image upload if new image provided
  if (imageFile) {
    // Delete old image if exists
    if (product.imageUrl) {
      try {
        const urlParts = product.imageUrl.split('/');
        const publicId = urlParts.slice(-2).join('/').split('.')[0];
        await deleteImage(`milko/products/${publicId}`);
      } catch (error) {
        console.error('Error deleting old image:', error);
      }
    }

    const uploadResult = await uploadImage(imageFile.buffer, {
      resource_type: 'image',
      folder: 'milko/products',
    });
    updates.imageUrl = uploadResult.url;
  }

  // Explicitly clear primary image (no replacement file upload)
  if (
    !imageFile &&
    Object.prototype.hasOwnProperty.call(updates, 'imageUrl') &&
    (updates.imageUrl === null || updates.imageUrl === '')
  ) {
    if (product.imageUrl) {
      try {
        const urlParts = product.imageUrl.split('/');
        const publicId = urlParts.slice(-2).join('/').split('.')[0];
        await deleteImage(`milko/products/${publicId}`);
      } catch (error) {
        console.error('Error deleting cleared primary image:', error);
      }
    }
    updates.imageUrl = null;
  }

  const variations = await productVariationModel.getProductVariations(productId);

  if (variations.length > 0) {
    if (Object.prototype.hasOwnProperty.call(updates, 'sellingPrice') && isSetFinitePrice(updates.sellingPrice)) {
      throw new ValidationError(
        'This product uses size variations. Remove all variations before setting a fixed selling price.'
      );
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'compareAtPrice') && isSetFinitePrice(updates.compareAtPrice)) {
      throw new ValidationError(
        'This product uses size variations. Remove all variations before setting a compare-at price.'
      );
    }
  } else {
    const nextSelling = updates.sellingPrice !== undefined ? updates.sellingPrice : product.sellingPrice;
    const nextCompare = updates.compareAtPrice !== undefined ? updates.compareAtPrice : product.compareAtPrice;
    if (!isSetFinitePrice(nextSelling) || !isSetFinitePrice(nextCompare)) {
      throw new ValidationError(
        'Add at least one size variation, or set both Selling Price and Compare At Price.'
      );
    }
    if (Number(nextSelling) > Number(nextCompare)) {
      throw new ValidationError('Selling Price cannot be greater than Compare At Price');
    }
  }

  await productModel.updateProduct(productId, updates);

  if (variations.length > 0) {
    return await applyVariationModePricing(productId);
  }

  return await productModel.getProductById(productId);
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
  applyVariationModePricing,
};

