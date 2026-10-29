import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, X } from 'lucide-react';
import { UserSession } from '../types';
import { DonationLedgerDetails, fetchDonationLedgerDetails } from '../data/ledgersData';
import { updateDonation } from '../data/addDonationData';
import { buildSchedule, formatDate, money, parseDate } from '../utils/donationMath';

interface EditDonationProps {
  session: UserSession;
  /** id of the Donation_Ledgers record being edited. */
  ledgerId: number;
  /** Closes the popup without saving. */
  onClose: () => void;
  /** Called 2 seconds after the donation is updated. */
  onUpdated: () => void;
}

interface EditDonationForm {
  user_id: string;
  total_num_of_donations: string;
  total_amount: string;
  start_date: string;
}

const inputBase =
  'bg-white border rounded-lg px-3 py-2.5 sm:py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 transition-all';
const inputOk = 'border-slate-300 focus:ring-emerald-500/40 focus:border-emerald-500';

/** Loads the donation being edited, then shows the form in a popup centered on the screen. */
export const EditDonation: React.FC<EditDonationProps> = ({ session, ledgerId, onClose, onUpdated }) => {
  const [details, setDetails] = useState<DonationLedgerDetails | null>(null);
  const [loadError, setLoadError] = useState('');

  // Donation_Ledgers + Non_Profit + Users + Donations for this ledger
  useEffect(() => {
    let cancelled = false;
    fetchDonationLedgerDetails(session.username, session.pin ?? 0, ledgerId).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setDetails(result.details);
      } else {
        setLoadError(result.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [session.username, session.pin, ledgerId]);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="editDonationTitle"
    >
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-4 sm:p-6 break-words text-slate-900 max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <div className="flex items-start justify-between gap-4 mb-6">
            <h3 id="editDonationTitle" className="text-xl font-bold tracking-tight">
              {details ? `Edit ${details.non_profit_name} Donation` : 'Edit Donation'}
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

          {!details && !loadError && (
            <p className="py-8 text-center text-sm text-slate-500">Loading donation...</p>
          )}
          {loadError && (
            <p role="alert" className="py-4 text-center text-sm font-semibold text-red-600">
              {loadError}
            </p>
          )}
          {details && (
            <EditDonationForm
              session={session}
              details={details}
              onClose={onClose}
              onUpdated={onUpdated}
            />
          )}
        </div>
      </div>
    </div>
  );
};

interface EditDonationFormProps {
  session: UserSession;
  details: DonationLedgerDetails;
  onClose: () => void;
  onUpdated: () => void;
}

const EditDonationForm: React.FC<EditDonationFormProps> = ({
  session,
  details,
  onClose,
  onUpdated,
}) => {
  // The values the record had when the popup opened; Reset puts these back
  const original = useMemo(
    () => ({
      form: {
        user_id: String(details.user_id),
        total_num_of_donations:
          details.total_num_of_donations === null ? '' : String(details.total_num_of_donations),
        total_amount: details.total_amount === null ? '' : String(details.total_amount),
        start_date: details.donation_start_date ?? '',
      } as EditDonationForm,
      // scheduled_payments: the date_applied of each Donations record
      scheduled_payments: details.donations.map((d) => d.date_applied),
    }),
    [details]
  );

  const [form, setForm] = useState<EditDonationForm>(original.form);
  const [scheduled_payments, setScheduledPayments] = useState<string[]>(original.scheduled_payments);


  const [submitted, setSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Don't fire the redirect if the popup is closed before the 2 seconds are up
  useEffect(() => {
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, []);

  const update = (field: keyof EditDonationForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // scheduled_payments is emptied and rebuilt whenever start_date or total_num_of_donations changes
  const changeTotalNumber = (value: string) => {
    update('total_num_of_donations', value);
    setScheduledPayments(buildSchedule(form.start_date, /^\d+$/.test(value) ? parseInt(value, 10) : 0));
  };
  const changeStartDate = (value: string) => {
    update('start_date', value);
    setScheduledPayments(buildSchedule(value, total_num_of_donations));
  };

  const total_num_of_donations = /^\d+$/.test(form.total_num_of_donations)
    ? parseInt(form.total_num_of_donations, 10)
    : 0;
  const total_donated_amount = /^\d+(\.\d{0,2})?$/.test(form.total_amount)
    ? parseFloat(form.total_amount)
    : 0;

  const avg_donated_amount: number | null =
    total_num_of_donations > 0 && total_donated_amount > 0
      ? total_donated_amount / total_num_of_donations
      : null;

  // End Date is the last element of scheduled_payments
  const end_date: Date | null =
    scheduled_payments.length > 0 ? parseDate(scheduled_payments[scheduled_payments.length - 1]) : null;

  const todayText = formatDate(new Date());

  // Reset: every form value and scheduled_payments go back to what the record had on opening
  const handleReset = () => {
    setForm(original.form);
    setScheduledPayments(original.scheduled_payments);
    setSubmitted(false);
    setStatusMessage(null);
  };

  const formIncomplete =
    form.user_id === '' ||
    total_num_of_donations <= 0 ||
    total_donated_amount <= 0 ||
    scheduled_payments.length === 0;

  // Update Donation: updates the Donation_Ledgers record and replaces its Donations records. The
  // old Donations records are only deleted after the new ones are saved (see update_donation.sql).
  const handleUpdateDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setStatusMessage(null);
    if (formIncomplete || !end_date) return;

    setIsSaving(true);
    const result = await updateDonation(session.username, session.pin ?? 0, details.donation_ledger_id, {
      user_id: Number(form.user_id),
      total_num_of_donations,
      total_amount: total_donated_amount,
      start_date: form.start_date,
      end_date: formatDate(end_date),
      scheduled_payments,
    });
    if (!result.success) {
      setStatusMessage({ type: 'error', text: result.error });
      setIsSaving(false);
      return;
    }

    setStatusMessage({ type: 'success', text: 'Donation updated' });
    redirectTimer.current = setTimeout(() => onUpdated(), 2000);
  };

  return (
    <form onSubmit={handleUpdateDonation} noValidate className="flex flex-col gap-5">
      {/* Name: the donor of this donation, shown as text (it cannot be changed here) */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-slate-700">Name</span>
        <span id="donor_name" className="text-sm font-semibold text-slate-900">
          {details.first_name} {details.last_name}
        </span>
      </div>

      {/* Total Number of Donations and Total Donation Amount share a row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit_total_num_of_donations" className="text-sm font-medium text-slate-700">
            Total Number of Donations
          </label>
          <input
            id="edit_total_num_of_donations"
            name="total_num_of_donations"
            type="text"
            inputMode="numeric"
            maxLength={3}
            size={3}
            value={form.total_num_of_donations}
            onChange={(e) => changeTotalNumber(e.target.value.replace(/[^0-9]/g, ''))}
            className={`${inputBase} ${inputOk} w-20`}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit_total_amount" className="text-sm font-medium text-slate-700">
            Total Donation Amount
          </label>
          <input
            id="edit_total_amount"
            name="total_amount"
            type="text"
            inputMode="decimal"
            maxLength={15}
            size={15}
            value={form.total_amount}
            onChange={(e) => {
              // digits with at most one decimal point and two decimal places
              const cleaned = e.target.value.replace(/[^0-9.]/g, '');
              const [whole, ...rest] = cleaned.split('.');
              update('total_amount', rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole);
            }}
            className={`${inputBase} ${inputOk} w-44`}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-slate-700">Avg Donation Amount</span>
        <span className="text-sm font-mono tabular-nums text-slate-900 min-h-5">
          {money(avg_donated_amount)}
        </span>
      </div>

      {/* Start Date and End Date share a row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit_start_date" className="text-sm font-medium text-slate-700">
            Start Date
          </label>
          <div className="relative flex items-center gap-2">
            <input
              id="edit_start_date"
              name="start_date"
              type="text"
              inputMode="numeric"
              placeholder="YYYY-MM-DD"
              maxLength={12}
              size={12}
              value={form.start_date}
              onChange={(e) => changeStartDate(e.target.value.replace(/[^0-9-]/g, ''))}
              className={`${inputBase} ${inputOk} w-36 font-mono`}
            />
            {/* The calendar button. The real (invisible) date field sits on top of it, so a tap
                or click lands on the field itself, which opens the phone's own date picker. The
                value is already YYYY-MM-DD. */}
            <div className="relative shrink-0">
              <span
                className="flex items-center justify-center min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 p-2 text-slate-600 bg-slate-50 border border-slate-200 rounded-lg"
                aria-hidden="true"
              >
                <Calendar className="w-4 h-4" />
              </span>
              <input
                type="date"
                title="Choose a date"
                aria-label="Choose a start date from the calendar"
                value={parseDate(form.start_date) ? form.start_date : ''}
                onChange={(e) => changeStartDate(e.target.value)}
                onClick={(e) => {
                  // desktop browsers need this to open the picker; phones open it on their own
                  try {
                    e.currentTarget.showPicker();
                  } catch {
                    // not supported: the browser's own behavior is used
                  }
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700">End Date</span>
          <span className="text-sm font-mono tabular-nums text-slate-900 min-h-5">
            {end_date ? formatDate(end_date) : ''}
          </span>
        </div>
      </div>

      {/* scheduled_payments: dates before today are marked (Applied) */}
      <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-4">
        <span className="text-sm font-medium text-slate-700">Scheduled Payments</span>
        <ul className="max-h-32 overflow-auto text-xs font-mono tabular-nums text-slate-800 space-y-0.5">
          {scheduled_payments.map((date, index) => (
            <li key={`${date}-${index}`}>
              {date}
              {date < todayText ? ' (Applied)' : ''}
            </li>
          ))}
        </ul>
      </div>

      {submitted && formIncomplete && (
        <p role="alert" className="text-sm text-red-600">
          Please fill in the number of donations, donation amount and start date.
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
          Update Donation
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
