'use client';

import { useEffect, useState } from 'react';
import { subscriptionsApi, addressesApi } from '@/lib/api';
import { Subscription, Address } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import styles from './page.module.css';

/**
 * Customer Dashboard
 * Profile information and addresses. Mobile-first UI.
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
        const subsPromise = subscriptionsApi.getAll().catch(() => []);
        const addrsPromise = user
          ? addressesApi.getAll().catch(() => [])
          : Promise.resolve([]);
        const [subsData, addrsData] = await Promise.all([subsPromise, addrsPromise]);
        setSubscriptions(subsData);
        setAddresses(Array.isArray(addrsData) ? addrsData : []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  useEffect(() => {
    if (user) setNewName(user.name);
  }, [user]);

  const handleUpdateName = async () => {
    if (!newName.trim()) {
      alert('Name cannot be empty');
      return;
    }
    setIsSubmitting(true);
    try {
      // TODO: Replace with actual API when available
      alert('Name updated successfully! (API integration pending)');
      setIsEditingName(false);
    } catch {
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
      // TODO: Replace with actual API when available
      alert('Password changed successfully! (API integration pending)');
      setIsEditingPassword(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch {
      alert('Failed to change password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAddressForm = () => {
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
    setIsAddingAddress(false);
    setEditingAddressId(null);
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
      resetAddressForm();
    } catch {
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
      const updated = await addressesApi.update(editingAddressId, addressForm);
      setAddresses((prev) => prev.map((a) => (a.id === editingAddressId ? updated : a)));
      resetAddressForm();
    } catch {
      alert('Failed to update address. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!confirm('Are you sure you want to delete this address?')) return;
    setIsSubmitting(true);
    try {
      await addressesApi.delete(addressId);
      setAddresses((prev) => prev.filter((a) => a.id !== addressId));
      if (editingAddressId === addressId) resetAddressForm();
    } catch {
      alert('Failed to delete address. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  const initial = (user?.name || user?.email || 'U').charAt(0).toUpperCase();
  const activeSubscriptions = subscriptions.filter((s) => s.status === 'active');

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>My Account</h1>

      {/* Profile */}
      <section className={styles.profileCard}>
        <h2 className={styles.sectionTitle}>Profile</h2>
        <div className={styles.profileHeader}>
          <div className={styles.avatar}>{initial}</div>
          <div className={styles.profileMain}>
            <h2 className={styles.profileName}>{user?.name || 'User'}</h2>
            <p className={styles.profileEmail}>{user?.email || '—'}</p>
          </div>
        </div>

        <div className={styles.profileRow}>
          <span className={styles.profileRowLabel}>Name</span>
          {isEditingName ? (
            <div className={styles.profileEditRow}>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className={styles.profileInput}
                placeholder="Your name"
              />
              <button onClick={handleUpdateName} disabled={isSubmitting} className={`${styles.btn} ${styles.btnPrimary}`}>
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditingName(false);
                  setNewName(user?.name || '');
                }}
                disabled={isSubmitting}
                className={`${styles.btn} ${styles.btnSecondary}`}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className={styles.profileRowActions}>
              <span className={styles.profileRowValue}>{user?.name || '—'}</span>
              <button onClick={() => setIsEditingName(true)} className={`${styles.btn} ${styles.btnText}`}>
                Edit
              </button>
            </div>
          )}
        </div>

        <div className={styles.profileRow}>
          <span className={styles.profileRowLabel}>Email</span>
          <span className={styles.profileRowValue}>{user?.email || '—'}</span>
        </div>

        <div className={styles.profileRow}>
          <span className={styles.profileRowLabel}>Password</span>
          {isEditingPassword ? (
            <div className={styles.passwordFields}>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                placeholder="Current password"
                className={styles.profileInput}
              />
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                placeholder="New password"
                className={styles.profileInput}
              />
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                placeholder="Confirm new password"
                className={styles.profileInput}
              />
              <div className={styles.profileRowActions}>
                <button onClick={handleChangePassword} disabled={isSubmitting} className={`${styles.btn} ${styles.btnPrimary}`}>
                  Change Password
                </button>
                <button
                  onClick={() => {
                    setIsEditingPassword(false);
                    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  }}
                  disabled={isSubmitting}
                  className={`${styles.btn} ${styles.btnSecondary}`}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setIsEditingPassword(true)} className={`${styles.btn} ${styles.btnText}`}>
              Change Password
            </button>
          )}
        </div>
      </section>

      {/* Addresses */}
      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Addresses</h2>
          {!isAddingAddress && !editingAddressId && (
            <button onClick={() => setIsAddingAddress(true)} className={`${styles.btn} ${styles.btnPrimary}`}>
              Add Address
            </button>
          )}
        </div>

        {(isAddingAddress || editingAddressId) && (
          <div className={styles.addressForm}>
            <h3 className={styles.addressFormTitle}>{editingAddressId ? 'Edit Address' : 'Add New Address'}</h3>
            <div className={styles.formGrid}>
              <div className={styles.formField}>
                <label className={styles.formFieldLabel}>Address name (e.g. Home, Office)</label>
                <input
                  type="text"
                  value={addressForm.name}
                  onChange={(e) => setAddressForm({ ...addressForm, name: e.target.value })}
                  placeholder="Home"
                  className={styles.formFieldInput}
                />
              </div>
              <div className={styles.formField}>
                <label className={styles.formFieldLabel}>Street address</label>
                <input
                  type="text"
                  value={addressForm.street}
                  onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })}
                  placeholder="Street address"
                  className={styles.formFieldInput}
                />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formField}>
                  <label className={styles.formFieldLabel}>City</label>
                  <input
                    type="text"
                    value={addressForm.city}
                    onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                    placeholder="City"
                    className={styles.formFieldInput}
                  />
                </div>
                <div className={styles.formField}>
                  <label className={styles.formFieldLabel}>State</label>
                  <input
                    type="text"
                    value={addressForm.state}
                    onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                    placeholder="State"
                    className={styles.formFieldInput}
                  />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formField}>
                  <label className={styles.formFieldLabel}>Postal code</label>
                  <input
                    type="text"
                    value={addressForm.postalCode}
                    onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                    placeholder="Postal code"
                    className={styles.formFieldInput}
                  />
                </div>
                <div className={styles.formField}>
                  <label className={styles.formFieldLabel}>Phone</label>
                  <input
                    type="tel"
                    value={addressForm.phone}
                    onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                    placeholder="Phone number"
                    className={styles.formFieldInput}
                  />
                </div>
              </div>
              <label className={styles.formCheckbox}>
                <input
                  type="checkbox"
                  checked={addressForm.isDefault}
                  onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                />
                Set as default address
              </label>
              <div className={styles.formActions}>
                <button
                  onClick={editingAddressId ? handleUpdateAddress : handleAddAddress}
                  disabled={isSubmitting}
                  className={`${styles.btn} ${styles.btnPrimary}`}
                >
                  {editingAddressId ? 'Update Address' : 'Add Address'}
                </button>
                <button onClick={resetAddressForm} disabled={isSubmitting} className={`${styles.btn} ${styles.btnSecondary}`}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {addresses.length === 0 ? (
          <p className={styles.emptyAddresses}>No addresses saved yet.</p>
        ) : (
          <div className={styles.addressesList}>
            {addresses.map((addr) => (
              <div
                key={addr.id}
                className={`${styles.addressCard} ${addr.isDefault ? styles.addressCardDefault : ''}`}
              >
                <div className={styles.addressCardHead}>
                  <h3 className={styles.addressCardTitle}>{addr.name}</h3>
                  {addr.isDefault && <span className={styles.defaultBadge}>Default</span>}
                </div>
                <div className={styles.addressCardBody}>
                  <p>{addr.street}</p>
                  <p>{addr.city}, {addr.state} {addr.postalCode}</p>
                  <p>{addr.country}</p>
                  {addr.phone && <p>Phone: {addr.phone}</p>}
                </div>
                <div className={styles.addressCardActions}>
                  <button onClick={() => handleEditAddress(addr)} className={`${styles.btn} ${styles.btnText}`}>
                    Edit
                  </button>
                  <button onClick={() => handleDeleteAddress(addr.id)} disabled={isSubmitting} className={`${styles.btn} ${styles.btnDanger}`}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Active Subscriptions */}
      {activeSubscriptions.length > 0 && (
        <section className={styles.sectionCard}>
          <h2 className={styles.sectionTitle}>Active Subscriptions</h2>
          <div className={styles.subscriptionsList}>
            {activeSubscriptions.map((sub) => (
              <div key={sub.id} className={styles.subscriptionCard}>
                <h3 className={styles.subscriptionCardTitle}>{sub.product?.name || 'Product'}</h3>
                <p className={styles.subscriptionCardMeta}>Quantity: {sub.litresPerDay} litres/day</p>
                <p className={styles.subscriptionCardMeta}>Delivery: {sub.deliveryTime}</p>
                <p className={styles.subscriptionCardMeta}>Valid until: {new Date(sub.endDate).toLocaleDateString()}</p>
                <Link href={`/subscriptions/${sub.id}`} className={styles.subscriptionCardLink}>
                  View Details
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
