import React, { useEffect, useRef, useState } from 'react';
import { createUser } from '../data/usersData';

export interface NewUserForm {
  username: string;
  first_name: string;
  last_name: string;
  pin: string;
  email: string;
  // phone_number: string;
  // address: string;
}

interface NewUserProps {
  onSubmit?: (user: NewUserForm) => void;
  /** Called 2 seconds after the profile is created, to move on to the donations page. */
  onCreated?: (user: NewUserForm) => void;
  onCancel?: () => void;
}

const emptyForm: NewUserForm = {
  username: '',
  first_name: '',
  last_name: '',
  pin: '',
  email: '',
  // phone_number: '',
  // address: '',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputBase =
  'bg-white border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 transition-all';
const inputOk = 'border-slate-300 focus:ring-emerald-500/40 focus:border-emerald-500';
const inputRequiredEmpty = 'border-red-500 focus:ring-red-500/40 focus:border-red-500';

export const NewUser: React.FC<NewUserProps> = ({ onSubmit, onCreated, onCancel }) => {
  const [form, setForm] = useState<NewUserForm>(emptyForm);
  const [submitted, setSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Don't fire the redirect if the page is left before the 2 seconds are up
  useEffect(() => {
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

  const update = (field: keyof NewUserForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // Required fields are outlined in red until they contain a value
  const requiredClass = (field: keyof NewUserForm) =>
    `${inputBase} ${form[field].trim() === '' ? inputRequiredEmpty : inputOk}`;

  const handleReset = () => {
    setForm(emptyForm);
    setSubmitted(false);
    setStatusMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setStatusMessage(null);

    const requiredMissing = (['username', 'first_name', 'last_name', 'pin'] as const).some(
      (f) => form[f].trim() === ''
    );
    const emailInvalid = form.email.trim() !== '' && !EMAIL_PATTERN.test(form.email.trim());
    if (requiredMissing || emailInvalid) return;

    setIsSaving(true);
    // Checks the Users table for the username; inserts the form values if it is free
    const result = await createUser({ ...form });
    if (!result.success) {
      setStatusMessage({ type: 'error', text: result.error });
      setIsSaving(false);
      return;
    }

    setStatusMessage({ type: 'success', text: 'Profile Created' });
    onSubmit?.(form);
    // Show the confirmation for 2 seconds, then go to the donations page
    redirectTimer.current = setTimeout(() => onCreated?.(form), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-10 px-4">
      <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-xl shadow-xs p-6">
        <h1 className="text-2xl font-bold tracking-tight mb-6">New User</h1>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="username" className="text-sm font-medium text-slate-700">
              User Name <span className="text-red-600">*</span>
            </label>
            <input
              id="username"
              name="username"
              type="text"
              maxLength={50}
              size={50}
              value={form.username}
              onChange={(e) => update('username', e.target.value)}
              className={requiredClass('username')}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="first_name" className="text-sm font-medium text-slate-700">
              First Name <span className="text-red-600">*</span>
            </label>
            <input
              id="first_name"
              name="first_name"
              type="text"
              maxLength={50}
              size={50}
              value={form.first_name}
              onChange={(e) => update('first_name', e.target.value)}
              className={requiredClass('first_name')}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="last_name" className="text-sm font-medium text-slate-700">
              Last Name <span className="text-red-600">*</span>
            </label>
            <input
              id="last_name"
              name="last_name"
              type="text"
              maxLength={50}
              size={50}
              value={form.last_name}
              onChange={(e) => update('last_name', e.target.value)}
              className={requiredClass('last_name')}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="pin" className="text-sm font-medium text-slate-700">
              PIN <span className="text-red-600">*</span>
            </label>
            <input
              id="pin"
              name="pin"
              type="text"
              inputMode="numeric"
              maxLength={4}
              size={4}
              value={form.pin}
              // Numeric-only validation, e.g. 6189
              onChange={(e) => update('pin', e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
              className={`${requiredClass('pin')} w-24 font-mono tracking-widest`}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="text"
              maxLength={50}
              size={50}
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              className={`${inputBase} ${
                form.email.trim() !== '' && !EMAIL_PATTERN.test(form.email.trim())
                  ? inputRequiredEmpty
                  : inputOk
              }`}
            />
            {form.email.trim() !== '' && !EMAIL_PATTERN.test(form.email.trim()) && (
              <p className="text-xs text-red-600">Enter a valid email, e.g. test@xyz.com</p>
            )}
            <p className="text-xs text-slate-500">
              <span className="text-red-600">*</span> denotes a required field
            </p>
          </div>

          {/* <div className="flex flex-col gap-1.5">
            <label htmlFor="phone_number" className="text-sm font-medium text-slate-700">
              Phone
            </label>
            <input
              id="phone_number"
              name="phone_number"
              type="text"
              maxLength={20}
              size={20}
              value={form.phone_number}
              onChange={(e) => update('phone_number', e.target.value)}
              className={`${inputBase} ${inputOk} w-56`}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="address" className="text-sm font-medium text-slate-700">
              Address
            </label>
            <textarea
              id="address"
              name="address"
              maxLength={200}
              rows={4}
              value={form.address}
              onChange={(e) => update('address', e.target.value)}
              className={`${inputBase} ${inputOk}`}
            />
          </div> */}

          {submitted && (['username', 'first_name', 'last_name', 'pin'] as const).some(
            (f) => form[f].trim() === ''
          ) && (
            <p role="alert" className="text-sm text-red-600">
              Please fill in all required fields.
            </p>
          )}

          {statusMessage && (
            <p
              role="alert"
              className={`text-sm font-semibold text-center ${
                statusMessage.type === 'success' ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {statusMessage.text}
            </p>
          )}

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="px-3.5 py-2 text-sm font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-300 border border-transparent rounded-lg transition-colors whitespace-nowrap disabled:opacity-60 cursor-pointer"
            >
              Create
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={isSaving}
              className="px-3.5 py-2 text-sm font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 hover:border-rose-300 transition-colors whitespace-nowrap disabled:opacity-60 cursor-pointer"
            >
              Reset
            </button>
          </div>
          {onCancel && (
            <div className="text-center">
              <button
                type="button"
                onClick={onCancel}
                disabled={isSaving}
                className="text-sm font-medium text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
