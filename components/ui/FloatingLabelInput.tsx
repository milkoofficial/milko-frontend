'use client';

import { useState, useRef, useEffect } from 'react';

interface FloatingLabelInputProps {
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  label: string;
  required?: boolean;
  showPasswordToggle?: boolean;
  onTogglePassword?: () => void;
  showPassword?: boolean;
  hasError?: boolean;
}

export default function FloatingLabelInput({
  type = 'text',
  value,
  onChange,
  onBlur,
  label,
  required = false,
  showPasswordToggle = false,
  onTogglePassword,
  showPassword = false,
  hasError = false,
}: FloatingLabelInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isFloating, setIsFloating] = useState(false);
  const [isTouched, setIsTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsFloating(isFocused || value.length > 0);
  }, [isFocused, value]);

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    setIsTouched(true);
    if (onBlur) {
      onBlur(e);
    }
  };

  const showError = hasError || (required && isTouched && value.length === 0);
  const borderColor = showError ? '#ef4444' : (isFocused ? '#9333ea' : '#e0e0e0');
  const labelColor = showError ? '#ef4444' : (isFloating ? '#9333ea' : '#666');

  const inputType = showPasswordToggle ? (showPassword ? 'text' : 'password') : type;

  return (
    <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
      {/* Floating Label */}
      <label
        style={{
          position: 'absolute',
          left: '1rem',
          top: isFloating ? '-0.5rem' : '50%',
          transform: isFloating ? 'translateY(0)' : 'translateY(-50%)',
          fontSize: isFloating ? '0.75rem' : '0.95rem',
          color: labelColor,
          backgroundColor: isFloating ? 'white' : 'transparent',
          padding: isFloating ? '0 0.25rem' : '0',
          transition: 'all 0.06s ease',
          fontWeight: isFloating ? 500 : 400,
          zIndex: 1,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </label>

      {/* Input Field - Fixed height container */}
      <div style={{ position: 'relative', height: '48px' }}>
        <input
          ref={inputRef}
          type={inputType}
          value={value}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          required={required}
          style={{
            width: '100%',
            height: '100%',
            padding: '0.875rem 1rem',
            paddingRight: showPasswordToggle ? '3rem' : '1rem',
            border: `1px solid ${borderColor}`,
            borderRadius: '8px',
            fontSize: '0.95rem',
            outline: 'none',
            transition: 'border-color 0.2s ease',
            fontFamily: 'inherit',
            backgroundColor: 'white',
            boxSizing: 'border-box',
          }}
        />
        
        {/* Password Toggle Button */}
        {showPasswordToggle && (
          <button
            type="button"
            onClick={onTogglePassword}
            style={{
              position: 'absolute',
              right: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#666',
              zIndex: 2,
            }}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

