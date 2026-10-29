import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { UserSession } from '../types';
import { NonProfitForEdit, fetchNonProfitForEdit, updateNonProfit } from '../data/nonProfitData';

interface EditNonProfitProps {
  session: UserSession;
  /** id of the Non_Profit record being edited. */
  nonProfitId: number;
  /** Closes the popup without saving. */
  onClose: () => void;
  /** Called 2 seconds after the Non Profit is updated; the parent closes the popup. */
  onUpdated: () => void;
}

interface EditNonProfitForm {
  name: string;
  description: string;
  admin_id: string;
  email: string;
  phone_number: string;
  address: string;
  url: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputBase =
  'bg-white border rounded-lg px-3 py-2.5 sm:py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 transition-all';
const inputOk = 'border-slate-300 focus:ring-emerald-500/40 focus:border-emerald-500';
const inputRequiredEmpty = 'border-red-500 focus:ring-red-500/40 focus:border-red-500';

/** Loads the Non Profit being edited, then shows the form in a popup centered on the screen. */
export const EditNonProfit: React.FC<EditNonProfitProps> = ({ session, nonProfitId, onClose, onUpdated }) => {
  const [nonProfit, setNonProfit] = useState<NonProfitForEdit | null>(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchNonProfitForEdit(session.username, session.pin ?? 0, nonProfitId).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setNonProfit(result.nonProfit);
      } else {
        setLoadError(result.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [session.username, session.pin, nonProfitId]);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="editNonProfitTitle"
    >
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-4 sm:p-6 break-words text-slate-900 max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <div className="flex items-start justify-between gap-4 mb-6">
            <h3 id="editNonProfitTitle" className="text-xl font-bold tracking-tight">
              Edit Non Profit
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="p-3 sm:p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {!nonProfit && !loadError && (
            <p className="py-8 text-center text-sm text-slate-500">Loading non profit...</p>
          )}
          {loadError && (
            <p role="alert" className="py-4 text-center text-sm font-semibold text-red-600">
              {loadError}
            </p>
          )}
          {nonProfit && (
            <EditNonProfitForm session={session} nonProfit={nonProfit} onClose={onClose} onUpdated={onUpdated} />
          )}
        </div>
      </div>
    </div>
  );
};

interface EditNonProfitFormProps {
  session: UserSession;
  nonProfit: NonProfitForEdit;
  onClose: () => void;
  onUpdated: () => void;
}

const EditNonProfitForm: React.FC<EditNonProfitFormProps> = ({ session, nonProfit, onClose, onUpdated }) => {
  // The values the record had when the popup opened; Reset puts these back
  const original = useMemo<EditNonProfitForm>(
    () => ({
      name: nonProfit.name,
      description: nonProfit.description ?? '',
      admin_id: String(nonProfit.admin_id),
      email: nonProfit.email ?? '',
      phone_number: nonProfit.phone_number ?? '',
      address: nonProfit.address ?? '',
      url: nonProfit.url ?? '',
    }),
    [nonProfit]
  );

  const [form, setForm] = useState<EditNonProfitForm>(original);
  const [submitted, setSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Don't fire the close if the popup is dismissed before the 2 seconds are up
  useEffect(() => {
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

  const update = (field: keyof EditNonProfitForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const nameMissing = form.name.trim() === '';
  const emailInvalid = form.email.trim() !== '' && !EMAIL_PATTERN.test(form.email.trim());

  // Reset: every value goes back to what the record had when the popup opened
  const handleReset = () => {
    setForm(original);
    setSubmitted(false);
    setStatusMessage(null);
  };

  // Edit Non Profit: updates the Non_Profit row with this id (admin, name, url, email, address, ...)
  const handleEditNonProfit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setStatusMessage(null);
    if (nameMissing || emailInvalid) return;

    setIsSaving(true);
    const result = await updateNonProfit(session.username, session.pin ?? 0, nonProfit.id, {
      admin_id: Number(form.admin_id),
      name: form.name,
      description: form.description,
      email: form.email,
      url: form.url,
      phone_number: form.phone_number,
      address: form.address,
    });
    if (!result.success) {
      setStatusMessage({ type: 'error', text: result.error });
      setIsSaving(false);
      return;
    }

    setStatusMessage({ type: 'success', text: 'Non Profit successfully updated!' });
    // Show the confirmation for 2 seconds, then close the popup
    redirectTimer.current = setTimeout(() => onUpdated(), 2000);
  };

  return (
    <form onSubmit={handleEditNonProfit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit_np_name" className="text-sm font-medium text-slate-700">
          Name <span className="text-red-600">*</span>
        </label>
        <input
          id="edit_np_name"
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

      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit_np_description" className="text-sm font-medium text-slate-700">
          Description
        </label>
        <textarea
          id="edit_np_description"
          name="description"
          maxLength={255}
          rows={4}
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          className={`${inputBase} ${inputOk}`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit_np_admin_id" className="text-sm font-medium text-slate-700">
          Admin
        </label>
        <select
          id="edit_np_admin_id"
          name="admin_id"
          value={form.admin_id}
          onChange={(e) => update('admin_id', e.target.value)}
          className={`${inputBase} ${inputOk} cursor-pointer`}
        >
          {nonProfit.admins.map((admin) => (
            <option key={admin.id} value={admin.id}>
              {admin.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit_np_email" className="text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="edit_np_email"
          name="email"
          type="text"
          maxLength={50}
          size={50}
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
          className={`${inputBase} ${emailInvalid ? inputRequiredEmpty : inputOk}`}
        />
        {emailInvalid && <p className="text-xs text-red-600">Enter a valid email, e.g. test@xyz.com</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit_np_phone" className="text-sm font-medium text-slate-700">
          Phone
        </label>
        <input
          id="edit_np_phone"
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
        <label htmlFor="edit_np_address" className="text-sm font-medium text-slate-700">
          Address
        </label>
        <textarea
          id="edit_np_address"
          name="address"
          maxLength={200}
          rows={4}
          value={form.address}
          onChange={(e) => update('address', e.target.value)}
          className={`${inputBase} ${inputOk}`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit_np_url" className="text-sm font-medium text-slate-700">
          Url
        </label>
        <input
          id="edit_np_url"
          name="url"
          type="text"
          maxLength={200}
          size={200}
          value={form.url}
          onChange={(e) => update('url', e.target.value)}
          className={`${inputBase} ${inputOk}`}
        />
      </div>

      <p className="text-xs text-slate-500">
        <span className="text-red-600">*</span> denotes a required field
      </p>

      {submitted && nameMissing && (
        <p role="alert" className="text-sm text-red-600">
          Please enter a name.
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
          className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-lg shadow-emerald-950/50 hover:shadow-emerald-900/50 transition-all disabled:opacity-60 cursor-pointer"
        >
          Edit Non Profit
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={isSaving}
          className="min-h-11 sm:min-h-0 px-3.5 py-2 text-sm font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 hover:border-rose-300 transition-colors whitespace-nowrap disabled:opacity-60 cursor-pointer"
        >
          Reset
        </button>
      </div>
      <div className="text-center">
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          className="text-sm font-medium text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
        >
          Close
        </button>
      </div>
    </form>
  );
};
