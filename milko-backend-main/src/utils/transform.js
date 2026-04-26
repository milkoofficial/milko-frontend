/**
 * Data Transformation Utilities
 * Converts database snake_case to API camelCase
 */

/** PostgreSQL `DATE` → `YYYY-MM-DD` using UTC calendar fields (matches node-pg DATE → Date at UTC midnight). */
function pgDateOnlyToYmd(value) {
  if (value == null || value === undefined) return undefined;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(value).trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return undefined;
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

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
    variationId: row.product_variation_id != null ? String(row.product_variation_id) : undefined,
    addressId: row.address_id ? String(row.address_id) : undefined,
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
    deliveryAddress: row.address_id ? {
      id: String(row.address_id),
      name: row.address_name,
      street: row.address_street,
      city: row.address_city,
      state: row.address_state,
      postalCode: row.address_postal_code,
      country: row.address_country || 'India',
      phone: row.address_phone || undefined,
      latitude: row.address_latitude !== null && row.address_latitude !== undefined ? parseFloat(row.address_latitude) : undefined,
      longitude: row.address_longitude !== null && row.address_longitude !== undefined ? parseFloat(row.address_longitude) : undefined,
    } : undefined,
    litresPerDay: parseFloat(row.litres_per_day),
    durationMonths: parseInt(row.duration_months),
    durationDays:
      row.duration_days !== null && row.duration_days !== undefined
        ? parseInt(row.duration_days, 10)
        : undefined,
    deliveryTime: row.delivery_time,
    status: row.status,
    startDate: pgDateOnlyToYmd(row.start_date),
    endDate: pgDateOnlyToYmd(row.end_date),
    razorpaySubscriptionId: row.razorpay_subscription_id,
    checkoutOrderId: row.checkout_order_id ? String(row.checkout_order_id) : undefined,
    totalQty: row.total_qty !== null && row.total_qty !== undefined ? parseFloat(row.total_qty) : undefined,
    deliveredQty: row.delivered_qty !== null && row.delivered_qty !== undefined ? parseFloat(row.delivered_qty) : undefined,
    remainingQty: row.remaining_qty !== null && row.remaining_qty !== undefined ? parseFloat(row.remaining_qty) : undefined,
    perUnitPrice: row.per_unit_price !== null && row.per_unit_price !== undefined ? parseFloat(row.per_unit_price) : undefined,
    totalAmount: row.total_amount !== null && row.total_amount !== undefined ? parseFloat(row.total_amount) : undefined,
    totalAmountPaid: row.total_amount_paid !== null && row.total_amount_paid !== undefined ? parseFloat(row.total_amount_paid) : undefined,
    platformFee: row.platform_fee !== null && row.platform_fee !== undefined ? parseFloat(row.platform_fee) : undefined,
    walletUsed: row.wallet_used !== null && row.wallet_used !== undefined ? parseFloat(row.wallet_used) : undefined,
    purchasedAt: row.purchased_at ? new Date(row.purchased_at).toISOString() : undefined,
    cancelledAt: row.cancelled_at ? new Date(row.cancelled_at).toISOString() : undefined,
    renewedAt: row.renewed_at ? new Date(row.renewed_at).toISOString() : undefined,
    initialStartDate: row.initial_start_date ? pgDateOnlyToYmd(row.initial_start_date) : undefined,
    autopayFailureReason: row.autopay_failure_reason || undefined,
    firstDayShiftApplied: row.first_day_shift_applied === true || row.first_day_shift_applied === 't',
    firstDayShiftReason: row.first_day_shift_reason || undefined,
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
    taxPercent: row.tax_percent !== null && row.tax_percent !== undefined ? parseFloat(row.tax_percent) : 0,
    imageUrl: row.image_url,
    isActive: row.is_active,
    isMembershipEligible: row.is_membership_eligible || false,
    quantity: row.quantity !== null ? parseInt(row.quantity) : 0,
    lowStockThreshold: row.low_stock_threshold !== null ? parseInt(row.low_stock_threshold) : 10,
    maxQuantity: row.max_quantity !== null && row.max_quantity !== undefined ? parseInt(row.max_quantity) : 99,
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
    deliveryDate: pgDateOnlyToYmd(row.delivery_date) || null,
    status: row.status,
    createdAt: row.created_at?.toISOString(),
    // Extended fields from joins
    userId: row.user_id ? String(row.user_id) : undefined,
    litresPerDay: row.litres_per_day ? parseFloat(row.litres_per_day) : undefined,
    deliveryTime: row.delivery_time || undefined,
    productId: row.product_id != null && row.product_id !== undefined ? String(row.product_id) : undefined,
    variationSize: row.product_variation_size ? String(row.product_variation_size).trim() : undefined,
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
