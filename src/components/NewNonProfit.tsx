import React, { useEffect, useRef, useState } from 'react';
import { UserSession } from '../types';
import { AdminOption, createNonProfit, fetchAvailableAdmins } from '../data/nonProfitData';

export interface NewNonProfitForm {
  name: string;
  description: string;
  admin_id: string;
  email: string;
  phone_number: string;
  address: string;
}

interface NewNonProfitProps {
  session: UserSession;
  /** id of the signed-in user in the Users table; passed in from sign-in, for later use. */
  adminUserId?: number;
  /** Called 2 seconds after the Non Profit is created, to move on to the donations page. */
  onCreated?: () => void;
  onCancel?: () => void;
  /** Text of the link that calls onCancel. */
  cancelLabel?: string;
}

const emptyForm: NewNonProfitForm = {
  name: '',
  description: '',
  admin_id: '',
  email: '',
  phone_number: '',
  address: '',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputBase =
  'bg-white border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 transition-all';
const inputOk = 'border-slate-300 focus:ring-emerald-500/40 focus:border-emerald-500';
const inputRequiredEmpty = 'border-red-500 focus:ring-red-500/40 focus:border-red-500';

export const NewNonProfit: React.FC<NewNonProfitProps> = ({
  session,
  adminUserId,
  onCreated,
  onCancel,
  cancelLabel = 'Back to Sign In',
}) => {
  // The Admin label and dropdown are only for SuperAdmin users
  const isSuperAdmin = session.role === 'SuperAdmin' && session.pin !== undefined;

  const [form, setForm] = useState<NewNonProfitForm>(emptyForm);
  const [admins, setAdmins] = useState<AdminOption[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Admin dropdown: Users that are not yet the admin of a Non Profit
  useEffect(() => {
    if (!isSuperAdmin) return;
    let cancelled = false;
    fetchAvailableAdmins(session.username, session.pin ?? 0).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setAdmins(result.admins);
      } else {
        setStatusMessage({ type: 'error', text: result.error });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin, session.username, session.pin]);

  // Don't fire the redirect if the page is left before the 2 seconds are up
  useEffect(() => {
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

  const update = (field: keyof NewNonProfitForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const nameMissing = form.name.trim() === '';
  // The Admin dropdown is required (SuperAdmin only; an Admin is always their own admin)
  const adminMissing = isSuperAdmin && form.admin_id === '';

  const handleReset = () => {
    setForm(emptyForm);
    setSubmitted(false);
    setStatusMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setStatusMessage(null);

    const emailInvalid = form.email.trim() !== '' && !EMAIL_PATTERN.test(form.email.trim());
    if (nameMissing || adminMissing || emailInvalid) return;

    setIsSaving(true);
    // Checks the Non_Profit table for the name; inserts the form values if it is free
    const result = await createNonProfit(session.username, session.pin ?? 0, {
      name: form.name,
      // SuperAdmin: the dropdown selection. Admin: the user's own id, passed in from sign-in.
      admin_id: isSuperAdmin
        ? form.admin_id === ''
          ? null
          : Number(form.admin_id)
        : adminUserId ?? null,
      description: form.description,
      email: form.email,
      phone_number: form.phone_number,
      address: form.address,
    });
    if (!result.success) {
      setStatusMessage({ type: 'error', text: result.error });
      setIsSaving(false);
      return;
    }

    setStatusMessage({ type: 'success', text: 'Non Profit Created' });
    // Show the confirmation for 2 seconds, then go to the donations page
    redirectTimer.current = setTimeout(() => onCreated?.(), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-10 px-4">
      <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-xl shadow-xs p-6">
        <h1 className="text-2xl font-bold tracking-tight mb-6">New Non Profit</h1>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-sm font-medium text-slate-700">
              Name <span className="text-red-600">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              maxLength={50}
              size={50}
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              // Outlined in red until a value is entered
              className={`${inputBase} ${nameMissing ? inputRequiredEmpty : inputOk}`}
            />
          </div>

          {/* SuperAdmin only, and required: outlined in red until an admin is selected */}
          {isSuperAdmin && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="admin_id" className="text-sm font-medium text-slate-700">
                Admin <span className="text-red-600">*</span>
              </label>
              <select
                id="admin_id"
                name="admin_id"
                value={form.admin_id}
                onChange={(e) => update('admin_id', e.target.value)}
                className={`${inputBase} ${adminMissing ? inputRequiredEmpty : inputOk} cursor-pointer`}
              >
                <option value=""></option>
                {admins.map((admin) => (
                  <option key={admin.id} value={admin.id}>
                    {admin.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="description" className="text-sm font-medium text-slate-700">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              maxLength={255}
              rows={4}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              className={`${inputBase} ${inputOk}`}
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
          </div>

          <div className="flex flex-col gap-1.5">
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
          </div>

          <p className="text-xs text-slate-500">
            <span className="text-red-600">*</span> denotes a required field
          </p>

          {submitted && (nameMissing || adminMissing) && (
            <p role="alert" className="text-sm text-red-600">
              {nameMissing && adminMissing
                ? 'Please enter a name and select an admin.'
                : nameMissing
                  ? 'Please enter a name.'
                  : 'Please select an admin.'}
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
                {cancelLabel}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
