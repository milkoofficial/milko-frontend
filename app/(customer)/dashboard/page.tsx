'use client';

import { useEffect, useState } from 'react';
import { subscriptionsApi, addressesApi } from '@/lib/api';
import { Subscription, Address } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

/**
 * Customer Dashboard
 * Shows user's active subscriptions, profile management, and address management
 */
export default function DashboardPage() {
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Profile edit states
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.name || '');
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Address edit states
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState({
    name: '',
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
    phone: '',
    isDefault: false
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const subsPromise = subscriptionsApi.getAll().catch((e) => {
          console.error('Failed to fetch subscriptions:', e);
          return [];
        });
        const addrsPromise = user
          ? addressesApi.getAll().catch((e) => {
              console.error('Failed to fetch addresses:', e);
              return [];
            })
          : Promise.resolve([]);
        const [subsData, addrsData] = await Promise.all([subsPromise, addrsPromise]);
        setSubscriptions(subsData);
        setAddresses(Array.isArray(addrsData) ? addrsData : []);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  useEffect(() => {
    if (user) {
      setNewName(user.name);
    }
  }, [user]);

  const handleUpdateName = async () => {
    if (!newName.trim()) {
      alert('Name cannot be empty');
      return;
    }

    setIsSubmitting(true);
    try {
      // TODO: Replace with actual API call when available
      // await authApi.updateProfile({ name: newName });
      alert('Name updated successfully! (API integration pending)');
      setIsEditingName(false);
    } catch (error) {
      console.error('Failed to update name:', error);
      alert('Failed to update name. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      alert('Please fill in all password fields');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }

    setIsSubmitting(true);
    try {
      // TODO: Replace with actual API call when available
      // await authApi.changePassword(passwordData.currentPassword, passwordData.newPassword);
      alert('Password changed successfully! (API integration pending)');
      setIsEditingPassword(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      console.error('Failed to change password:', error);
      alert('Failed to change password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddAddress = async () => {
    if (!addressForm.name || !addressForm.street || !addressForm.city || !addressForm.state || !addressForm.postalCode) {
      alert('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const newAddress = await addressesApi.create(addressForm);
      setAddresses((prev) => [...prev, newAddress]);
      setIsAddingAddress(false);
      setAddressForm({
        name: '',
        street: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'India',
        phone: '',
        isDefault: false
      });
    } catch (error) {
      console.error('Failed to add address:', error);
      alert('Failed to add address. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditAddress = (address: Address) => {
    setEditingAddressId(address.id);
    setAddressForm({
      name: address.name,
      street: address.street,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
      phone: address.phone || '',
      isDefault: address.isDefault || false
    });
  };

  const handleUpdateAddress = async () => {
    if (!editingAddressId) return;

    if (!addressForm.name || !addressForm.street || !addressForm.city || !addressForm.state || !addressForm.postalCode) {
      alert('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedAddress = await addressesApi.update(editingAddressId, addressForm);
      setAddresses((prev) => prev.map((addr) => (addr.id === editingAddressId ? updatedAddress : addr)));
      setEditingAddressId(null);
      setAddressForm({
        name: '',
        street: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'India',
        phone: '',
        isDefault: false
      });
    } catch (error) {
      console.error('Failed to update address:', error);
      alert('Failed to update address. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!confirm('Are you sure you want to delete this address?')) {
      return;
    }

    setIsSubmitting(true);
    try {
      await addressesApi.delete(addressId);
      setAddresses((prev) => prev.filter((addr) => addr.id !== addressId));
    } catch (error) {
      console.error('Failed to delete address:', error);
      alert('Failed to delete address. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  const activeSubscriptions = subscriptions.filter(s => s.status === 'active');

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>My Dashboard</h1>
      
      {/* Profile Information Section */}
      <div style={{ marginTop: '2rem', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '1.5rem', background: '#fff' }}>
        <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Profile Information</h2>
        
        {/* Name */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Name</label>
          {isEditingName ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{ flex: 1, padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.95rem' }}
                placeholder="Enter your name"
              />
              <button
                onClick={handleUpdateName}
                disabled={isSubmitting}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#000',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600'
                }}
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditingName(false);
                  setNewName(user?.name || '');
                }}
                disabled={isSubmitting}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#f5f5f5',
                  color: '#000',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  fontSize: '0.95rem'
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.95rem', color: '#333' }}>{user?.name || 'N/A'}</span>
              <button
                onClick={() => setIsEditingName(true)}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'transparent',
                  color: '#0070f3',
                  border: '1px solid #0070f3',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {/* Email (Read-only) */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Email</label>
          <span style={{ fontSize: '0.95rem', color: '#666' }}>{user?.email || 'N/A'}</span>
        </div>

        {/* Change Password */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Password</label>
          {isEditingPassword ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                placeholder="Current password"
                style={{ padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.95rem' }}
              />
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                placeholder="New password"
                style={{ padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.95rem' }}
              />
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                placeholder="Confirm new password"
                style={{ padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.95rem' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handleChangePassword}
                  disabled={isSubmitting}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#000',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    fontSize: '0.95rem',
                    fontWeight: '600'
                  }}
                >
                  Change Password
                </button>
                <button
                  onClick={() => {
                    setIsEditingPassword(false);
                    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  }}
                  disabled={isSubmitting}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#f5f5f5',
                    color: '#000',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    fontSize: '0.95rem'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsEditingPassword(true)}
              style={{
                padding: '0.5rem 1rem',
                background: 'transparent',
                color: '#0070f3',
                border: '1px solid #0070f3',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              Change Password
            </button>
          )}
        </div>
      </div>

      {/* Addresses Section */}
      <div style={{ marginTop: '2rem', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '1.5rem', background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0 }}>Addresses</h2>
          {!isAddingAddress && !editingAddressId && (
            <button
              onClick={() => setIsAddingAddress(true)}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#000',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.95rem',
                fontWeight: '600'
              }}
            >
              Add Address
            </button>
          )}
        </div>

        {/* Add/Edit Address Form */}
        {(isAddingAddress || editingAddressId) && (
          <div style={{ marginBottom: '2rem', padding: '1.5rem', background: '#f9f9f9', borderRadius: '8px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>{editingAddressId ? 'Edit Address' : 'Add New Address'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem' }}>Address Name (e.g., Home, Office)</label>
                <input
                  type="text"
                  value={addressForm.name}
                  onChange={(e) => setAddressForm({ ...addressForm, name: e.target.value })}
                  placeholder="Home"
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.95rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem' }}>Street Address</label>
                <input
                  type="text"
                  value={addressForm.street}
                  onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })}
                  placeholder="Street address"
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.95rem' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem' }}>City</label>
                  <input
                    type="text"
                    value={addressForm.city}
                    onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                    placeholder="City"
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.95rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem' }}>State</label>
                  <input
                    type="text"
                    value={addressForm.state}
                    onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                    placeholder="State"
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.95rem' }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem' }}>Postal Code</label>
                  <input
                    type="text"
                    value={addressForm.postalCode}
                    onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                    placeholder="Postal code"
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.95rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem' }}>Phone</label>
                  <input
                    type="tel"
                    value={addressForm.phone}
                    onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                    placeholder="Phone number"
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.95rem' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={addressForm.isDefault}
                    onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                  />
                  <span style={{ fontSize: '0.9rem' }}>Set as default address</span>
                </label>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={editingAddressId ? handleUpdateAddress : handleAddAddress}
                  disabled={isSubmitting}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#000',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    fontSize: '0.95rem',
                    fontWeight: '600'
                  }}
                >
                  {editingAddressId ? 'Update Address' : 'Add Address'}
                </button>
                <button
                  onClick={() => {
                    setIsAddingAddress(false);
                    setEditingAddressId(null);
                    setAddressForm({
                      name: '',
                      street: '',
                      city: '',
                      state: '',
                      postalCode: '',
                      country: 'India',
                      phone: '',
                      isDefault: false
                    });
                  }}
                  disabled={isSubmitting}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#f5f5f5',
                    color: '#000',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    fontSize: '0.95rem'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Addresses List */}
        {addresses.length === 0 ? (
          <p style={{ color: '#666', fontSize: '0.95rem' }}>No addresses saved yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {addresses.map((address) => (
              <div
                key={address.id}
                style={{
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  background: address.isDefault ? '#f9f9f9' : '#fff'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{address.name}</h3>
                      {address.isDefault && (
                        <span style={{ padding: '0.25rem 0.75rem', background: '#000', color: '#fff', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600' }}>
                          Default
                        </span>
                      )}
                    </div>
                    <p style={{ margin: '0.25rem 0', fontSize: '0.95rem', color: '#333' }}>{address.street}</p>
                    <p style={{ margin: '0.25rem 0', fontSize: '0.95rem', color: '#333' }}>
                      {address.city}, {address.state} {address.postalCode}
                    </p>
                    <p style={{ margin: '0.25rem 0', fontSize: '0.95rem', color: '#333' }}>{address.country}</p>
                    {address.phone && (
                      <p style={{ margin: '0.25rem 0', fontSize: '0.95rem', color: '#333' }}>Phone: {address.phone}</p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => handleEditAddress(address)}
                      style={{
                        padding: '0.5rem 1rem',
                        background: 'transparent',
                        color: '#0070f3',
                        border: '1px solid #0070f3',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.9rem'
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteAddress(address.id)}
                      disabled={isSubmitting}
                      style={{
                        padding: '0.5rem 1rem',
                        background: 'transparent',
                        color: '#dc3545',
                        border: '1px solid #dc3545',
                        borderRadius: '4px',
                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                        fontSize: '0.9rem'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Subscriptions Section */}
      {activeSubscriptions.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h2>Active Subscriptions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            {activeSubscriptions.map((subscription) => (
              <div key={subscription.id} style={{ 
                border: '1px solid #e0e0e0', 
                borderRadius: '8px', 
                padding: '1.5rem',
                background: '#fff'
              }}>
                <h3>{subscription.product?.name || 'Product'}</h3>
                <p>Quantity: {subscription.litresPerDay} litres/day</p>
                <p>Delivery Time: {subscription.deliveryTime}</p>
                <p>Status: {subscription.status}</p>
                <p>Valid until: {new Date(subscription.endDate).toLocaleDateString()}</p>
                <Link href={`/subscriptions/${subscription.id}`} style={{ color: '#0070f3' }}>
                  View Details
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
