/**
 * Data Transformation Utilities
 * Converts database snake_case to API camelCase
 */

/**
 * Transform subscription row from database to API format
 * @param {Object} row - Database row with snake_case
 * @returns {Object} API format with camelCase
 */
const transformSubscription = (row) => {
  if (!row) return null;

  return {
    id: String(row.id),
    userId: String(row.user_id),
    productId: String(row.product_id),
    product: row.product_name ? {
      id: String(row.product_id),
      name: row.product_name,
      description: row.product_description,
      pricePerLitre: parseFloat(row.price_per_litre),
      imageUrl: row.product_image_url,
      isActive: row.product_id ? true : false, // Assume active if product exists
      createdAt: row.created_at?.toISOString(),
      updatedAt: row.updated_at?.toISOString(),
    } : undefined,
    litresPerDay: parseFloat(row.litres_per_day),
    durationMonths: parseInt(row.duration_months),
    deliveryTime: row.delivery_time,
    status: row.status,
    startDate: row.start_date?.toISOString().split('T')[0],
    endDate: row.end_date?.toISOString().split('T')[0],
    razorpaySubscriptionId: row.razorpay_subscription_id,
    totalQty: row.total_qty !== null && row.total_qty !== undefined ? parseFloat(row.total_qty) : undefined,
    deliveredQty: row.delivered_qty !== null && row.delivered_qty !== undefined ? parseFloat(row.delivered_qty) : undefined,
    remainingQty: row.remaining_qty !== null && row.remaining_qty !== undefined ? parseFloat(row.remaining_qty) : undefined,
    perUnitPrice: row.per_unit_price !== null && row.per_unit_price !== undefined ? parseFloat(row.per_unit_price) : undefined,
    totalAmount: row.total_amount !== null && row.total_amount !== undefined ? parseFloat(row.total_amount) : undefined,
    totalAmountPaid: row.total_amount_paid !== null && row.total_amount_paid !== undefined ? parseFloat(row.total_amount_paid) : undefined,
    walletUsed: row.wallet_used !== null && row.wallet_used !== undefined ? parseFloat(row.wallet_used) : undefined,
    purchasedAt: row.purchased_at ? new Date(row.purchased_at).toISOString() : undefined,
    cancelledAt: row.cancelled_at ? new Date(row.cancelled_at).toISOString() : undefined,
    createdAt: row.created_at?.toISOString(),
    updatedAt: row.updated_at?.toISOString(),
    // Extended fields from joins (for admin view)
    userName: row.user_name || undefined,
    userEmail: row.user_email || undefined,
  };
};

/**
 * Transform product row from database to API format
 * @param {Object} row - Database row with snake_case
 * @returns {Object} API format with camelCase
 */
const transformProduct = (row) => {
  if (!row) return null;

  return {
    id: String(row.id),
    name: row.name,
    description: row.description,
    pricePerLitre: parseFloat(row.price_per_litre),
    sellingPrice: row.selling_price !== null ? parseFloat(row.selling_price) : null,
    compareAtPrice: row.compare_at_price !== null ? parseFloat(row.compare_at_price) : null,
    imageUrl: row.image_url,
    isActive: row.is_active,
    isMembershipEligible: row.is_membership_eligible || false,
    quantity: row.quantity !== null ? parseInt(row.quantity) : 0,
    lowStockThreshold: row.low_stock_threshold !== null ? parseInt(row.low_stock_threshold) : 10,
    categoryId: row.category_id ? String(row.category_id) : null,
    suffixAfterPrice: row.suffix_after_price || 'Litres',
    createdAt: row.created_at?.toISOString(),
    updatedAt: row.updated_at?.toISOString(),
  };
};

/**
 * Transform user row from database to API format
 * @param {Object} row - Database row with snake_case
 * @returns {Object} API format with camelCase
 */
const transformUser = (row) => {
  if (!row) return null;

  return {
    id: String(row.id),
    name: row.name,
    email: row.email,
    role: row.role ? row.role.toLowerCase() : 'customer', // Normalize to lowercase
    createdAt: row.created_at?.toISOString(),
    updatedAt: row.updated_at?.toISOString(),
  };
};

/**
 * Transform delivery schedule row from database to API format
 * @param {Object} row - Database row with snake_case
 * @returns {Object} API format with camelCase
 */
const transformDeliverySchedule = (row) => {
  if (!row) return null;

  return {
    id: String(row.id),
    subscriptionId: String(row.subscription_id),
    deliveryDate: row.delivery_date ? row.delivery_date.split('T')[0] : null,
    status: row.status,
    createdAt: row.created_at?.toISOString(),
    // Extended fields from joins
    userId: row.user_id ? String(row.user_id) : undefined,
    litresPerDay: row.litres_per_day ? parseFloat(row.litres_per_day) : undefined,
    deliveryTime: row.delivery_time || undefined,
    productName: row.product_name || undefined,
    userName: row.user_name || undefined,
    userEmail: row.user_email || undefined,
  };
};

module.exports = {
  transformSubscription,
  transformProduct,
  transformUser,
  transformDeliverySchedule,
};
