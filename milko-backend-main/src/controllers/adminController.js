const productService = require('../services/productService');
const productImageModel = require('../models/productImage');
const productVariationModel = require('../models/productVariation');
const productReviewModel = require('../models/productReview');
const bannerService = require('../services/bannerService');
const userModel = require('../models/user');
const subscriptionModel = require('../models/subscription');
const subscriptionService = require('../services/subscriptionService');
const siteContentModel = require('../models/siteContent');
const categoryService = require('../services/categoryService');
const couponModel = require('../models/coupon');
const couponService = require('../services/couponService');
const { uploadImage, deleteImage } = require('../config/cloudinary');
const { query } = require('../config/database');
const { transformDeliverySchedule } = require('../utils/transform');
const orderModel = require('../models/order');

/**
 * Admin Controller
 * Handles admin HTTP requests
 */

// ========== Products ==========

/**
 * Get all products (admin view)
 * GET /api/admin/products
 */
const getAllProducts = async (req, res, next) => {
  try {
    const products = await productService.getAllProducts();

    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create product
 * POST /api/admin/products
 */
const createProduct = async (req, res, next) => {
  try {
    const product = await productService.createProduct(req.body, req.file);

    res.status(201).json({
      success: true,
      data: product,
      message: 'Product created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update product
 * PUT /api/admin/products/:id
 */
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await productService.updateProduct(id, req.body, req.file);

    res.json({
      success: true,
      data: product,
      message: 'Product updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get product by ID with details
 * GET /api/admin/products/:id
 */
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await productService.getProductById(id, true);

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete product
 * DELETE /api/admin/products/:id
 */
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    await productService.deleteProduct(id);

    res.json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ========== Product Images ==========

/**
 * Add product image
 * POST /api/admin/products/:id/images
 */
const addProductImage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { displayOrder = 0 } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Image file is required',
      });
    }

    const uploadResult = await uploadImage(req.file.buffer, {
      resource_type: 'image',
      folder: 'milko/products',
    });

    const image = await productImageModel.createProductImage(id, uploadResult.url, displayOrder);

    res.status(201).json({
      success: true,
      data: image,
      message: 'Image added successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete product image
 * DELETE /api/admin/products/:id/images/:imageId
 */
const deleteProductImage = async (req, res, next) => {
  try {
    const { imageId } = req.params;
    const image = await productImageModel.deleteProductImage(imageId);

    if (image) {
      // Delete from Cloudinary
      try {
        const urlParts = image.imageUrl.split('/');
        const publicId = urlParts.slice(-2).join('/').split('.')[0];
        await deleteImage(`milko/products/${publicId}`);
      } catch (error) {
        console.error('Error deleting image from Cloudinary:', error);
      }
    }

    res.json({
      success: true,
      message: 'Image deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ========== Product Variations ==========

/**
 * Add product variation
 * POST /api/admin/products/:id/variations
 */
const addProductVariation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { size, priceMultiplier = 1.0, price = null, isAvailable = true, displayOrder = 0 } = req.body;

    if (!size) {
      return res.status(400).json({
        success: false,
        error: 'Size is required',
      });
    }

    // If price is provided, use it. Otherwise, use priceMultiplier for backward compatibility
    const variation = await productVariationModel.createProductVariation(
      id,
      size,
      priceMultiplier,
      isAvailable,
      displayOrder,
      price ? parseFloat(price) : null
    );

    res.status(201).json({
      success: true,
      data: variation,
      message: 'Variation added successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update product variation
 * PUT /api/admin/products/:id/variations/:variationId
 */
const updateProductVariation = async (req, res, next) => {
  try {
    const { variationId } = req.params;
    const variation = await productVariationModel.updateProductVariation(variationId, req.body);

    res.json({
      success: true,
      data: variation,
      message: 'Variation updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete product variation
 * DELETE /api/admin/products/:id/variations/:variationId
 */
const deleteProductVariation = async (req, res, next) => {
  try {
    const { variationId } = req.params;
    await productVariationModel.deleteProductVariation(variationId);

    res.json({
      success: true,
      message: 'Variation deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ========== Product Reviews ==========

/**
 * Add product review (admin can add reviews)
 * POST /api/admin/products/:id/reviews
 */
const addProductReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reviewerName, rating, comment, isApproved = true } = req.body;

    if (!reviewerName || !rating) {
      return res.status(400).json({
        success: false,
        error: 'Reviewer name and rating are required',
      });
    }

    const review = await productReviewModel.createProductReview(id, {
      userId: null,
      reviewerName,
      rating,
      comment,
      isApproved,
    });

    res.status(201).json({
      success: true,
      data: review,
      message: 'Review added successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update product review
 * PUT /api/admin/products/:id/reviews/:reviewId
 */
const updateProductReview = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const review = await productReviewModel.updateProductReview(reviewId, req.body);

    res.json({
      success: true,
      data: review,
      message: 'Review updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete product review
 * DELETE /api/admin/products/:id/reviews/:reviewId
 */
const deleteProductReview = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    await productReviewModel.deleteProductReview(reviewId);

    res.json({
      success: true,
      message: 'Review deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ========== Users ==========

/**
 * Get all users
 * GET /api/admin/users
 */
const getAllUsers = async (req, res, next) => {
  try {
    const users = await userModel.getAllUsers();

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user by ID
 * GET /api/admin/users/:id
 */
const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await userModel.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// ========== Orders & Customers ==========

/**
 * Get all paid orders (admin view)
 * GET /api/admin/orders
 *
 * Merges: (1) subscription orders from payments table, (2) checkout orders from orders table.
 * If the payments table does not exist, only checkout orders are returned.
 */
const getAllOrders = async (req, res, next) => {
  try {
    let orders = [];
    try {
      const result = await query(
        `
        SELECT
          pmt.id AS order_id,
          pmt.razorpay_order_id,
          pmt.razorpay_payment_id,
          pmt.amount,
          pmt.currency,
          pmt.status AS payment_status,
          COALESCE(pmt.paid_at, pmt.created_at) AS ordered_at,
          s.id AS subscription_id,
          u.id AS user_id,
          u.name AS user_name,
          u.email AS user_email,
          (
            SELECT COUNT(*)
            FROM delivery_schedules ds
            WHERE ds.subscription_id = s.id
          ) AS items_count,
          COALESCE(
            (
              SELECT ds.status
              FROM delivery_schedules ds
              WHERE ds.subscription_id = s.id
                AND ds.delivery_date >= CURRENT_DATE
              ORDER BY ds.delivery_date ASC
              LIMIT 1
            ),
            (
              SELECT ds.status
              FROM delivery_schedules ds
              WHERE ds.subscription_id = s.id
              ORDER BY ds.delivery_date DESC
              LIMIT 1
            )
          ) AS delivery_status
        FROM payments pmt
        JOIN subscriptions s ON s.id = pmt.subscription_id
        LEFT JOIN users u ON u.id = s.user_id
        WHERE pmt.status = 'captured'
        ORDER BY COALESCE(pmt.paid_at, pmt.created_at) DESC
        `
      );
      orders = result.rows.map((row) => ({
        orderId: String(row.order_id),
        orderNumber: String(row.order_id),
        razorpayOrderId: row.razorpay_order_id,
        razorpayPaymentId: row.razorpay_payment_id,
        orderedAt: row.ordered_at ? new Date(row.ordered_at).toISOString() : null,
        customerName: row.user_name || null,
        customerEmail: row.user_email || null,
        amount: row.amount !== null ? parseFloat(row.amount) : null,
        currency: row.currency || 'INR',
        paymentMethod: 'online',
        paymentStatus: row.payment_status,
        itemsCount: row.items_count !== null ? parseInt(row.items_count, 10) : 0,
        deliveryStatus: row.delivery_status || 'pending',
        subscriptionId: row.subscription_id !== null ? String(row.subscription_id) : null,
        customerId: row.user_id || null,
      }));
    } catch (e) {
      // payments or subscriptions table may not exist (e.g. fresh DB without full schema)
      if (!e.message?.includes('does not exist')) throw e;
    }

    // Also include cart/checkout orders (e.g. COD, online)
    let checkoutOrders = [];
    try {
      checkoutOrders = await orderModel.listAllOrdersAdmin();
    } catch (e) {
      // If the orders tables don't exist yet, keep admin orders working for subscriptions.
      checkoutOrders = [];
    }

    const merged = [...checkoutOrders, ...orders].sort((a, b) => {
      const ta = a.orderedAt ? new Date(a.orderedAt).getTime() : 0;
      const tb = b.orderedAt ? new Date(b.orderedAt).getTime() : 0;
      return tb - ta;
    });

    res.json({ success: true, data: merged });
  } catch (error) {
    next(error);
  }
};

/**
 * Get order details by ID (admin)
 * GET /api/admin/orders/:id
 */
const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await orderModel.getOrderByIdForAdmin(id);
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark order as package prepared
 * POST /api/admin/orders/:id/mark-package-prepared
 */
const markOrderAsPackagePrepared = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Update order status
    await orderModel.markAsPackagePrepared(id);
    
    // TODO: Create delivery entry in deliveries table
    // This will be implemented when we have the deliveries schema ready
    
    res.json({ 
      success: true, 
      message: 'Order marked as package prepared successfully' 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List checkout order-deliveries (admin deliveries view)
 * GET /api/admin/order-deliveries
 */
const listOrderDeliveries = async (req, res, next) => {
  try {
    const rows = await orderModel.listOrderDeliveriesAdmin();
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark order as out for delivery
 * POST /api/admin/orders/:id/mark-out-for-delivery
 */
const markOrderAsOutForDelivery = async (req, res, next) => {
  try {
    const { id } = req.params;
    await orderModel.markAsOutForDelivery(id);
    res.json({ success: true, message: 'Order marked as out for delivery' });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark order as delivered
 * POST /api/admin/orders/:id/mark-delivered
 */
const markOrderAsDelivered = async (req, res, next) => {
  try {
    const { id } = req.params;
    await orderModel.markAsDelivered(id);
    res.json({ success: true, message: 'Order marked as delivered' });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark order as fulfilled (COD collection / final step)
 * POST /api/admin/orders/:id/mark-fulfilled
 */
const markOrderAsFulfilled = async (req, res, next) => {
  try {
    const { id } = req.params;
    await orderModel.markAsFulfilled(id);
    res.json({ success: true, message: 'Order marked as fulfilled' });
  } catch (error) {
    next(error);
  }
};

/**
 * Customer analytics (admin view)
 * GET /api/admin/customers
 *
 * Returns customers with ordersCount and amountSpent.
 * Uses payments (subscriptions) when available; falls back to orders (checkout) if payments does not exist.
 */
const getCustomerStats = async (req, res, next) => {
  try {
    let result;
    try {
      result = await query(
        `
        SELECT
          u.id,
          u.name,
          u.email,
          COALESCE(COUNT(pmt.id), 0) AS orders_count,
          COALESCE(SUM(pmt.amount), 0) AS amount_spent
        FROM users u
        LEFT JOIN subscriptions s ON s.user_id = u.id
        LEFT JOIN payments pmt
          ON pmt.subscription_id = s.id
         AND pmt.status = 'captured'
        WHERE LOWER(u.role) = 'customer'
        GROUP BY u.id, u.name, u.email
        ORDER BY amount_spent DESC, orders_count DESC, u.created_at DESC
        `
      );
    } catch (e) {
      if (e.message?.includes('does not exist')) {
        // Fallback: use orders table only (checkout orders; payments table missing)
        result = await query(
          `
          SELECT
            u.id,
            u.name,
            u.email,
            COALESCE(COUNT(o.id), 0) AS orders_count,
            COALESCE(SUM(o.total), 0) AS amount_spent
          FROM users u
          LEFT JOIN orders o ON o.user_id = u.id AND o.payment_status IN ('paid', 'cod')
          WHERE LOWER(u.role) = 'customer'
          GROUP BY u.id, u.name, u.email
          ORDER BY amount_spent DESC, orders_count DESC
          `
        );
      } else {
        throw e;
      }
    }

    const customers = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      orders: row.orders_count != null ? parseInt(row.orders_count, 10) : 0,
      amountSpent: row.amount_spent != null ? parseFloat(row.amount_spent) : 0,
      location: null,
    }));

    res.json({ success: true, data: customers });
  } catch (error) {
    next(error);
  }
};

/**
 * Get feedback stats (emoji counts and percentages)
 * GET /api/admin/feedback
 */
const getFeedback = async (req, res, next) => {
  try {
    const stats = await orderModel.getFeedbackStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};

// ========== Subscriptions ==========

/**
 * Get all subscriptions
 * GET /api/admin/subscriptions
 */
const getAllSubscriptions = async (req, res, next) => {
  try {
    const subscriptions = await subscriptionModel.getAllSubscriptions();

    res.json({
      success: true,
      data: subscriptions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Pause subscription (admin)
 * POST /api/admin/subscriptions/:id/pause
 */
const pauseSubscription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const subscription = await subscriptionService.pauseSubscription(id, null); // Admin bypass

    res.json({
      success: true,
      data: subscription,
      message: 'Subscription paused',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resume subscription (admin)
 * POST /api/admin/subscriptions/:id/resume
 */
const resumeSubscription = async (req, res, next) => {
  try {
    const { id } = req.params;
    const subscription = await subscriptionService.resumeSubscription(id, null); // Admin bypass

    res.json({
      success: true,
      data: subscription,
      message: 'Subscription resumed',
    });
  } catch (error) {
    next(error);
  }
};

// ========== Deliveries ==========

/**
 * Get delivery schedule
 * GET /api/admin/deliveries?date=YYYY-MM-DD
 */
const getDeliveries = async (req, res, next) => {
  try {
    const { date } = req.query;
    const deliveryDate = date || new Date().toISOString().split('T')[0];

    const result = await query(
      `SELECT ds.*, s.user_id, s.litres_per_day, s.delivery_time,
              p.name as product_name, u.name as user_name, u.email as user_email
       FROM delivery_schedules ds
       LEFT JOIN subscriptions s ON ds.subscription_id = s.id
       LEFT JOIN products p ON s.product_id = p.id
       LEFT JOIN users u ON s.user_id = u.id
       WHERE ds.delivery_date = $1
       ORDER BY ds.delivery_time`,
      [deliveryDate]
    );

    const transformed = result.rows.map(transformDeliverySchedule);

    res.json({
      success: true,
      data: transformed,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update delivery status
 * PUT /api/admin/deliveries/:id
 */
const updateDeliveryStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'delivered', 'skipped', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
      });
    }

    const subscriptionModel = require('../models/subscription');
    await subscriptionModel.ensureSubscriptionSchema();
    const { getClient } = require('../config/database');

    const client = await getClient();
    let result;
    try {
      await client.query('BEGIN');
      const current = await client.query(`SELECT id, subscription_id, status FROM delivery_schedules WHERE id = $1 FOR UPDATE`, [id]);
      if (current.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: 'Delivery not found',
        });
      }

      const prevStatus = current.rows[0].status;
      const subscriptionId = current.rows[0].subscription_id;

      result = await client.query(
        `UPDATE delivery_schedules 
         SET status = $1, updated_at = NOW() 
         WHERE id = $2
         RETURNING *`,
        [status, id]
      );

      if (subscriptionId) {
        const subRes = await client.query(`SELECT litres_per_day FROM subscriptions WHERE id = $1 FOR UPDATE`, [subscriptionId]);
        if (subRes.rows.length > 0) {
          const delta = parseFloat(subRes.rows[0].litres_per_day || 0);

          if (prevStatus !== 'delivered' && status === 'delivered') {
            await client.query(
              `
              UPDATE subscriptions
              SET delivered_qty = delivered_qty + $1,
                  remaining_qty = GREATEST(0, remaining_qty - $1),
                  updated_at = NOW()
              WHERE id = $2
              `,
              [delta, subscriptionId]
            );
          } else if (prevStatus === 'delivered' && status !== 'delivered') {
            await client.query(
              `
              UPDATE subscriptions
              SET delivered_qty = GREATEST(0, delivered_qty - $1),
                  remaining_qty = remaining_qty + $1,
                  updated_at = NOW()
              WHERE id = $2
              `,
              [delta, subscriptionId]
            );
          }
        }
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Delivery not found',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Delivery status updated',
    });
  } catch (error) {
    next(error);
  }
};

// ========== Banners ==========

/**
 * Get all banners (admin view)
 * GET /api/admin/banners
 */
const getAllBanners = async (req, res, next) => {
  try {
    const banners = await bannerService.getAllBanners();

    res.json({
      success: true,
      data: banners,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create banner
 * POST /api/admin/banners
 */
const createBanner = async (req, res, next) => {
  try {
    // Extract files from multer fields
    const desktopImage = req.files?.image?.[0] || null;
    const mobileImage = req.files?.mobileImage?.[0] || null;

    // Debug: Log file information
    console.log('[ADMIN] Creating banner...', {
      hasDesktopImage: !!desktopImage,
      hasMobileImage: !!mobileImage,
      desktopImageInfo: desktopImage ? {
        fieldname: desktopImage.fieldname,
        originalname: desktopImage.originalname,
        size: desktopImage.size,
        hasBuffer: !!desktopImage.buffer,
      } : null,
      mobileImageInfo: mobileImage ? {
        fieldname: mobileImage.fieldname,
        originalname: mobileImage.originalname,
        size: mobileImage.size,
        hasBuffer: !!mobileImage.buffer,
      } : null,
      body: req.body,
    });

    if (!desktopImage) {
      return res.status(400).json({
        success: false,
        error: 'Desktop image file is required',
      });
    }

    const banner = await bannerService.createBanner(req.body, desktopImage, mobileImage);

    res.status(201).json({
      success: true,
      data: banner,
      message: 'Banner created successfully',
    });
  } catch (error) {
    console.error('[ADMIN] Banner creation error:', {
      message: error.message || error.toString(),
      name: error.name,
      stack: error.stack,
      error: error,
    });
    next(error);
  }
};

/**
 * Update banner
 * PUT /api/admin/banners/:id
 */
const updateBanner = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Extract files from multer fields
    const desktopImage = req.files?.image?.[0] || null;
    const mobileImage = req.files?.mobileImage?.[0] || null;
    
    // Parse form data - handle link field
    const updates = { ...req.body };
    if (updates.link !== undefined) {
      updates.link = updates.link || null; // Convert empty string to null
    }
    
    const banner = await bannerService.updateBanner(id, updates, desktopImage, mobileImage);

    res.json({
      success: true,
      data: banner,
      message: 'Banner updated successfully',
    });
  } catch (error) {
    console.error('[ADMIN] Banner update error:', error);
    next(error);
  }
};

/**
 * Delete banner
 * DELETE /api/admin/banners/:id
 */
const deleteBanner = async (req, res, next) => {
  try {
    const { id } = req.params;
    await bannerService.deleteBanner(id);

    res.json({
      success: true,
      message: 'Banner deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ========== Site Content ==========

/**
 * Get all site content (admin view)
 * GET /api/admin/content
 */
const getAllSiteContent = async (req, res, next) => {
  try {
    const content = await siteContentModel.getAllContent();

    res.json({
      success: true,
      data: content,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get site content by type
 * GET /api/admin/content/:type
 */
const getSiteContentByType = async (req, res, next) => {
  try {
    const { type } = req.params;
    const content = await siteContentModel.getContentByTypeAdmin(type);

    if (!content) {
      return res.status(404).json({
        success: false,
        error: `Content of type '${type}' not found`,
      });
    }

    res.json({
      success: true,
      data: content,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create or update site content
 * PUT /api/admin/content/:type
 */
const upsertSiteContent = async (req, res, next) => {
  try {
    const { type } = req.params;
    const { title, content, metadata } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: 'Title and content are required',
      });
    }

    const updatedContent = await siteContentModel.upsertContent(type, {
      title,
      content,
      metadata,
    });

    res.json({
      success: true,
      data: updatedContent,
      message: 'Content saved successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle site content status
 * PATCH /api/admin/content/:type/status
 */
const toggleContentStatus = async (req, res, next) => {
  try {
    const { type } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isActive must be a boolean',
      });
    }

    const content = await siteContentModel.updateContentStatus(type, isActive);

    if (!content) {
      return res.status(404).json({
        success: false,
        error: `Content of type '${type}' not found`,
      });
    }

    res.json({
      success: true,
      data: content,
      message: `Content ${isActive ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error) {
    next(error);
  }
};

// ========== Categories ==========

/**
 * Get all categories
 * GET /api/admin/categories
 */
const getAllCategories = async (req, res, next) => {
  try {
    const categories = await categoryService.getAllCategories();

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create category
 * POST /api/admin/categories
 */
const createCategory = async (req, res, next) => {
  try {
    const category = await categoryService.createCategory(req.body);

    res.status(201).json({
      success: true,
      data: category,
      message: 'Category created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update category
 * PUT /api/admin/categories/:id
 */
const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await categoryService.updateCategory(id, req.body);

    res.json({
      success: true,
      data: category,
      message: 'Category updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete category
 * DELETE /api/admin/categories/:id
 */
const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    await categoryService.deleteCategory(id);

    res.json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ========== Coupons ==========

/**
 * Get all coupons
 * GET /api/admin/coupons
 */
const getAllCoupons = async (req, res, next) => {
  try {
    const coupons = await couponModel.getAllCoupons();

    res.json({
      success: true,
      data: coupons,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get coupon by ID
 * GET /api/admin/coupons/:id
 */
const getCouponById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const coupon = await couponModel.getCouponById(id);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        error: 'Coupon not found',
      });
    }

    res.json({
      success: true,
      data: coupon,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create coupon
 * POST /api/admin/coupons
 */
const createCoupon = async (req, res, next) => {
  try {
    const coupon = await couponService.createCoupon(req.body);

    res.status(201).json({
      success: true,
      data: coupon,
      message: 'Coupon created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update coupon
 * PUT /api/admin/coupons/:id
 */
const updateCoupon = async (req, res, next) => {
  try {
    const { id } = req.params;
    const coupon = await couponService.updateCoupon(id, req.body);

    res.json({
      success: true,
      data: coupon,
      message: 'Coupon updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete coupon
 * DELETE /api/admin/coupons/:id
 */
const deleteCoupon = async (req, res, next) => {
  try {
    const { id } = req.params;
    await couponModel.deleteCoupon(id);

    res.json({
      success: true,
      message: 'Coupon deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload or update logo (Cloudinary + site_content type 'logo')
 * POST /api/admin/logo
 * Body: FormData with optional 'image' (file), 'widthPx' (number, default 120), and 'widthPxMobile' (number, default same as widthPx)
 * - With image: upload to Cloudinary milko/logo, delete old if any, upsert metadata { imageUrl, imagePublicId, widthPx, widthPxMobile }
 * - Without image: update only widthPx and widthPxMobile in existing logo (requires existing logo)
 */
const upsertLogo = async (req, res, next) => {
  try {
    const widthPxRaw = req.body.widthPx;
    const widthPx = widthPxRaw != null && widthPxRaw !== '' ? parseInt(String(widthPxRaw), 10) : null;
    const numWidth = typeof widthPx === 'number' && !Number.isNaN(widthPx) ? Math.max(40, Math.min(320, widthPx)) : null;
    
    const widthPxMobileRaw = req.body.widthPxMobile;
    const widthPxMobile = widthPxMobileRaw != null && widthPxMobileRaw !== '' ? parseInt(String(widthPxMobileRaw), 10) : null;
    const numWidthMobile = typeof widthPxMobile === 'number' && !Number.isNaN(widthPxMobile) ? Math.max(40, Math.min(320, widthPxMobile)) : null;

    let existing = null;
    try {
      existing = await siteContentModel.getContentByTypeAdmin('logo');
    } catch {
      // ignore
    }

    if (req.file && req.file.buffer) {
      const uploadResult = await uploadImage(req.file.buffer, { folder: 'milko/logo' });
      if (existing && existing.metadata && existing.metadata.imagePublicId) {
        try {
          await deleteImage(existing.metadata.imagePublicId);
        } catch (e) {
          console.warn('[LOGO] Could not delete old Cloudinary image:', e?.message);
        }
      }
      const metadata = {
        imageUrl: uploadResult.url,
        imagePublicId: uploadResult.publicId,
        widthPx: numWidth ?? existing?.metadata?.widthPx ?? 120,
        widthPxMobile: numWidthMobile ?? existing?.metadata?.widthPxMobile ?? numWidth ?? existing?.metadata?.widthPx ?? 120,
      };
      const updated = await siteContentModel.upsertContent('logo', {
        title: 'Logo',
        content: '',
        metadata,
      });
      return res.json({ success: true, data: updated, message: 'Logo uploaded successfully' });
    }

    if (!existing) {
      return res.status(400).json({
        success: false,
        error: 'Upload an image first. Width can only be changed when a logo is already set.',
      });
    }
    const metadata = {
      ...(existing.metadata || {}),
      widthPx: numWidth ?? existing.metadata?.widthPx ?? 120,
      widthPxMobile: numWidthMobile ?? existing.metadata?.widthPxMobile ?? numWidth ?? existing.metadata?.widthPx ?? 120,
    };
    const updated = await siteContentModel.upsertContent('logo', {
      title: 'Logo',
      content: '',
      metadata,
    });
    return res.json({ success: true, data: updated, message: 'Logo width updated' });
  } catch (error) {
    next(error);
  }
};

/**
 * Get pending orders count (for admin sidebar badge)
 * GET /api/admin/orders/pending-count
 */
const getPendingOrdersCount = async (req, res, next) => {
  try {
    const result = await query(
      `
      SELECT COUNT(*) as count
      FROM orders
      WHERE status NOT IN ('delivered', 'cancelled', 'refunded')
        AND fulfilled_at IS NULL
      `
    );
    const count = parseInt(result.rows[0]?.count || 0, 10);
    res.json({ success: true, data: { count } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  // Products
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  // Product Images
  addProductImage,
  deleteProductImage,
  // Product Variations
  addProductVariation,
  updateProductVariation,
  deleteProductVariation,
  // Product Reviews
  addProductReview,
  updateProductReview,
  deleteProductReview,
  // Users
  getAllUsers,
  getUserById,
  // Orders & Customers
  getAllOrders,
  getOrderById,
  getPendingOrdersCount,
  markOrderAsPackagePrepared,
  listOrderDeliveries,
  markOrderAsOutForDelivery,
  markOrderAsDelivered,
  markOrderAsFulfilled,
  getCustomerStats,
  getFeedback,
  // Subscriptions
  getAllSubscriptions,
  pauseSubscription,
  resumeSubscription,
  // Deliveries
  getDeliveries,
  updateDeliveryStatus,
  // Banners
  getAllBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  // Site Content
  getAllSiteContent,
  getSiteContentByType,
  upsertSiteContent,
  toggleContentStatus,
  upsertLogo,
  // Categories
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  // Coupons
  getAllCoupons,
  getCouponById,
  createCoupon,
  updateCoupon,
  deleteCoupon,
};
