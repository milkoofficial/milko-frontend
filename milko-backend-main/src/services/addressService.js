const addressModel = require('../models/address');

/**
 * Address Service
 * Business logic for address operations
 */

/**
 * Get all addresses for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of addresses
 */
const getUserAddresses = async (userId) => {
  return await addressModel.getAddressesByUserId(userId);
};

/**
 * Get address by ID
 * @param {string} addressId - Address ID
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Address or null
 */
const getAddressById = async (addressId, userId) => {
  return await addressModel.getAddressById(addressId, userId);
};

/**
 * Create a new address
 * @param {string} userId - User ID
 * @param {Object} addressData - Address data
 * @returns {Promise<Object>} Created address
 */
const createAddress = async (userId, addressData) => {
  // Validate required fields
  if (!addressData.name || !addressData.street || !addressData.city || !addressData.state || !addressData.postalCode) {
    throw new Error('Missing required address fields');
  }

  // Validate postal code (6 digits for India)
  if (addressData.postalCode && !/^\d{6}$/.test(addressData.postalCode)) {
    throw new Error('Postal code must be 6 digits');
  }

  return await addressModel.createAddress(userId, addressData);
};

/**
 * Update an address
 * @param {string} addressId - Address ID
 * @param {string} userId - User ID
 * @param {Object} addressData - Updated address data
 * @returns {Promise<Object>} Updated address
 */
const updateAddress = async (addressId, userId, addressData) => {
  // Validate postal code if provided
  if (addressData.postalCode && !/^\d{6}$/.test(addressData.postalCode)) {
    throw new Error('Postal code must be 6 digits');
  }

  const updated = await addressModel.updateAddress(addressId, userId, addressData);
  
  if (!updated) {
    throw new Error('Address not found');
  }

  return updated;
};

/**
 * Delete an address
 * @param {string} addressId - Address ID
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
const deleteAddress = async (addressId, userId) => {
  const deleted = await addressModel.deleteAddress(addressId, userId);
  
  if (!deleted) {
    throw new Error('Address not found');
  }
};

module.exports = {
  getUserAddresses,
  getAddressById,
  createAddress,
  updateAddress,
  deleteAddress,
};
