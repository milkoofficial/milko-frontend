const express = require('express');
const router = express.Router();
const couponService = require('../services/couponService');

/**
 * Public Coupon Routes
 * Base path: /api/coupons
 * Public access for coupon validation
 */

/**
 * Validate coupon code
 * POST /api/coupons/validate
 * Body: { code: string, cartAmount: number }
 */
router.post('/validate', async (req, res, next) => {
  try {
    const { code, cartAmount = 0 } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Coupon code is required',
      });
    }

    const coupon = await couponService.validateCoupon(code, cartAmount);

    res.json({
      success: true,
      data: coupon,
    });
  } catch (error) {
    // Return validation errors as 400, not 500
    if (error.message && error.message.includes('Invalid') || 
        error.message.includes('not active') ||
        error.message.includes('expired') ||
        error.message.includes('limit') ||
        error.message.includes('Minimum purchase')) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }
    next(error);
  }
});

module.exports = router;
