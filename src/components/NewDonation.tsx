import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';
import { UserSession } from '../types';
import { DonorOption, fetchDonors } from '../data/donorsData';
import { addDonation } from '../data/addDonationData';
import { NonProfitOption, fetchNonProfitOptions } from '../data/nonProfitData';
import { AutocompleteSelect } from './AutocompleteSelect';
import { addMonths, donorLabel, formatDate, money, parseDate } from '../utils/donationMath';

interface NewDonationProps {
  session: UserSession;
  /** Returns to the Donation Ledgers page. */
  onBack?: () => void;
  /** Called 2 seconds after the donation is created, to move on to the Donation Ledgers page. */
  onCreated?: () => void;
}

interface NewDonationForm {
  user_id: string;
  non_profit_id: string;
  total_num_of_donations: string;
  total_amount: string;
  start_date: string;
}

const emptyForm: NewDonationForm = {
  user_id: '',
  non_profit_id: '',
  total_num_of_donations: '',
  total_amount: '',
  start_date: '',
};

const inputBase =
  'bg-white border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 transition-all';
const inputOk = 'border-slate-300 focus:ring-emerald-500/40 focus:border-emerald-500';
const inputRequiredEmpty = 'border-red-500 focus:ring-red-500/40 focus:border-red-500';

export const NewDonation: React.FC<NewDonationProps> = ({ session, onBack, onCreated }) => {
  const [form, setForm] = useState<NewDonationForm>(emptyForm);
  const [donors, setDonors] = useState<DonorOption[]>([]);
  const [loadError, setLoadError] = useState('');

  // Only a SuperAdmin chooses the Non Profit; an Admin's own Non Profit is used
  const isSuperAdmin = session.role === 'SuperAdmin' && session.pin !== undefined;
  const [nonProfits, setNonProfits] = useState<NonProfitOption[]>([]);
  const [nonProfitQuery, setNonProfitQuery] = useState('');
  const [nonProfitLoadError, setNonProfitLoadError] = useState('');

  // Name autocomplete
  const [nameQuery, setNameQuery] = useState('');
  const [listOpen, setListOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const datePickerRef = useRef<HTMLInputElement>(null);

  // Submit state
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

  // Donors: Users whose role is Donor
  useEffect(() => {
    let cancelled = false;
    fetchDonors(session.username, session.pin ?? 0).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setDonors(result.donors);
      } else {
        setLoadError(result.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [session.username, session.pin]);

  // Non Profits (id + name) for the SuperAdmin-only Non Profit dropdown
  useEffect(() => {
    if (!isSuperAdmin) return;
    let cancelled = false;
    fetchNonProfitOptions(session.username, session.pin ?? 0).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setNonProfits(result.nonProfits);
      } else {
        setNonProfitLoadError(result.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin, session.username, session.pin]);

  const update = (field: keyof NewDonationForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const matches = useMemo(() => {
    const q = nameQuery.toLowerCase().trim();
    return donors.filter((d) => donorLabel(d).toLowerCase().includes(q));
  }, [donors, nameQuery]);

  const chooseDonor = (donor: DonorOption) => {
    update('user_id', String(donor.id));
    setNameQuery(donorLabel(donor));
    setListOpen(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setListOpen(true);
      setHighlight((h) => Math.min(h + 1, Math.max(matches.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' && listOpen && matches[highlight]) {
      e.preventDefault();
      chooseDonor(matches[highlight]);
    } else if (e.key === 'Escape') {
      setListOpen(false);
    }
  };

  const openCalendar = () => {
    const picker = datePickerRef.current;
    if (!picker) return;
    try {
      picker.showPicker();
    } catch {
      picker.focus();
      picker.click();
    }
  };

  // ---- Calculated values -------------------------------------------------------------
  const total_num_of_donations = /^\d+$/.test(form.total_num_of_donations)
    ? parseInt(form.total_num_of_donations, 10)
    : 0;
  const total_donated_amount = /^\d+(\.\d{0,2})?$/.test(form.total_amount)
    ? parseFloat(form.total_amount)
    : 0;

  // Total donation amount / total number of donations (e.g. $1200 / 12 = $100)
  const avg_donated_amount: number | null =
    total_num_of_donations > 0 && total_donated_amount > 0
      ? total_donated_amount / total_num_of_donations
      : null;

  // scheduled_payments is thrown away and rebuilt from scratch whenever start_date or
  // total_num_of_donations changes (never edited in place), so changing 4 donations to 2
  // leaves exactly 2 elements. The first element is the start date; each next element is one
  // month later, counted from the start date (a start on the 31st gives 28/29/30/31 as
  // months allow).
  const scheduled_payments: string[] = useMemo(() => {
    const start = parseDate(form.start_date);
    if (total_num_of_donations <= 0 || !start) return [];
    return Array.from({ length: total_num_of_donations }, (_, i) => formatDate(addMonths(start, i)));
  }, [form.start_date, total_num_of_donations]);

  // End Date is the last element of scheduled_payments
  const end_date: Date | null =
    scheduled_payments.length > 0 ? parseDate(scheduled_payments[scheduled_payments.length - 1]) : null;

  // Reset: blank every field. scheduled_payments is rebuilt from the (now empty) start date and
  // total_num_of_donations, so it is emptied too.
  const handleReset = () => {
    setForm(emptyForm);
    setNameQuery('');
    setNonProfitQuery('');
    setListOpen(false);
    setSubmitted(false);
    setStatusMessage(null);
  };

  // Add Donation: saves the Donation_Ledgers record, then one Donations record per element of
  // scheduled_payments, and on success shows "Donation created" before moving on.
  const handleAddDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setStatusMessage(null);

    if (
      form.user_id === '' ||
      (isSuperAdmin && form.non_profit_id === '') ||
      total_num_of_donations <= 0 ||
      total_donated_amount <= 0 ||
      scheduled_payments.length === 0 ||
      !end_date
    ) {
      return;
    }

    setIsSaving(true);
    const result = await addDonation(session.username, session.pin ?? 0, {
      user_id: Number(form.user_id),
      total_num_of_donations,
      total_amount: total_donated_amount,
      start_date: form.start_date,
      end_date: formatDate(end_date),
      scheduled_payments,
      // SuperAdmin: the dropdown choice. Admin: not sent, their own Non Profit is used.
      non_profit_id: isSuperAdmin ? Number(form.non_profit_id) : null,
    });
    if (!result.success) {
      setStatusMessage({ type: 'error', text: result.error });
      setIsSaving(false);
      return;
    }

    setStatusMessage({ type: 'success', text: 'Donation created' });
    // Show the confirmation for 2 seconds, then go to the Donation Ledgers page
    redirectTimer.current = setTimeout(() => onCreated?.(), 2000);
  };

  const formIncomplete =
    form.user_id === '' ||
    (isSuperAdmin && form.non_profit_id === '') ||
    total_num_of_donations <= 0 ||
    total_donated_amount <= 0 ||
    scheduled_payments.length === 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-10 px-4">
      <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-xl shadow-xs p-6">
        <h1 className="text-2xl font-bold tracking-tight mb-6">New Donation</h1>

        <form onSubmit={handleAddDonation} noValidate className="flex flex-col gap-5">
          {/* Name: autocomplete dropdown of Donors; the selected id is user_id */}
          <div className="flex flex-col gap-1.5 relative">
            <label htmlFor="user_name" className="text-sm font-medium text-slate-700">
              Name <span className="text-red-600">*</span>
            </label>
            <input
              id="user_name"
              name="user_name"
              type="text"
              role="combobox"
              aria-expanded={listOpen}
              aria-controls="donor-list"
              autoComplete="off"
              maxLength={50}
              size={50}
              value={nameQuery}
              onChange={(e) => {
                setNameQuery(e.target.value);
                update('user_id', ''); // typing again clears the earlier selection
                setListOpen(true);
                setHighlight(0);
              }}
              onFocus={() => setListOpen(true)}
              onBlur={() => setListOpen(false)}
              onKeyDown={handleNameKeyDown}
              // Outlined in red until a donor is selected from the list
              className={`${inputBase} ${form.user_id === '' ? inputRequiredEmpty : inputOk}`}
            />
            <input type="hidden" name="user_id" value={form.user_id} />
            {listOpen && (
              <ul
                id="donor-list"
                role="listbox"
                className="absolute left-0 right-0 top-full mt-1 z-10 max-h-60 overflow-auto bg-white border border-slate-200 rounded-lg shadow-lg text-sm"
              >
                {matches.length > 0 ? (
                  matches.map((donor, index) => (
                    <li
                      key={donor.id}
                      role="option"
                      aria-selected={String(donor.id) === form.user_id}
                      // mouse down (not click) so the input keeps focus until the choice is made
                      onMouseDown={(e) => {
                        e.preventDefault();
                        chooseDonor(donor);
                      }}
                      onMouseEnter={() => setHighlight(index)}
                      className={`px-3 py-2 cursor-pointer whitespace-pre ${
                        index === highlight ? 'bg-emerald-50 text-emerald-800' : 'text-slate-800'
                      }`}
                    >
                      {donorLabel(donor)}
                    </li>
                  ))
                ) : (
                  <li className="px-3 py-2 text-slate-500">No matching donors</li>
                )}
              </ul>
            )}
            {loadError && <p className="text-xs text-red-600">{loadError}</p>}
          </div>

          {/* SuperAdmin only: the Non Profit the donation belongs to; the selected id is non_profit_id */}
          {isSuperAdmin && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="non_profit_name" className="text-sm font-medium text-slate-700">
                Non Profit <span className="text-red-600">*</span>
              </label>
              <AutocompleteSelect
                id="non_profit_name"
                options={nonProfits.map((np) => ({ id: np.id, label: np.name }))}
                query={nonProfitQuery}
                onQueryChange={setNonProfitQuery}
                value={form.non_profit_id}
                onSelect={(id) => update('non_profit_id', id)}
                required
                emptyText="No matching non profits"
              />
              <input type="hidden" name="non_profit_id" value={form.non_profit_id} />
              {nonProfitLoadError && <p className="text-xs text-red-600">{nonProfitLoadError}</p>}
            </div>
          )}

          {/* Total Number of Donations and Total Donation Amount share a row */}
          <div className="grid grid-cols-2 gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="total_num_of_donations" className="text-sm font-medium text-slate-700">
              Total Number of Donations
            </label>
            <input
              id="total_num_of_donations"
              name="total_num_of_donations"
              type="text"
              inputMode="numeric"
              maxLength={3}
              size={3}
              value={form.total_num_of_donations}
              onChange={(e) => update('total_num_of_donations', e.target.value.replace(/[^0-9]/g, ''))}
              className={`${inputBase} ${inputOk} w-20`}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="total_amount" className="text-sm font-medium text-slate-700">
              Total Donation Amount
            </label>
            <input
              id="total_amount"
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
            <span id="avg_donated_amount" className="text-sm font-mono tabular-nums text-slate-900 min-h-5">
              {money(avg_donated_amount)}
            </span>
          </div>

          {/* Start Date and End Date share a row */}
          <div className="grid grid-cols-2 gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="start_date" className="text-sm font-medium text-slate-700">
              Start Date
            </label>
            <div className="relative flex items-center gap-2">
              <input
                id="start_date"
                name="start_date"
                type="text"
                inputMode="numeric"
                placeholder="YYYY-MM-DD"
                maxLength={12}
                size={12}
                value={form.start_date}
                onChange={(e) => update('start_date', e.target.value.replace(/[^0-9-]/g, ''))}
                className={`${inputBase} ${inputOk} w-36 font-mono`}
              />
              <button
                type="button"
                onClick={openCalendar}
                title="Choose a date"
                aria-label="Choose a start date from the calendar"
                className="p-2 text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <Calendar className="w-4 h-4" />
              </button>
              {/* Native calendar; its value is already YYYY-MM-DD */}
              <input
                ref={datePickerRef}
                type="date"
                tabIndex={-1}
                aria-hidden="true"
                value={parseDate(form.start_date) ? form.start_date : ''}
                onChange={(e) => update('start_date', e.target.value)}
                className="absolute left-40 top-full w-0 h-0 opacity-0 pointer-events-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">End Date</span>
            <span id="end_date" className="text-sm font-mono tabular-nums text-slate-900 min-h-5">
              {end_date ? formatDate(end_date) : ''}
            </span>
          </div>
          </div>

          {/* scheduled_payments (shown so the dates can be checked) */}
          <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-4">
            <span className="text-sm font-medium text-slate-700">Scheduled Payments</span>
            <ul
              id="scheduled_payments"
              className="max-h-32 overflow-auto text-xs font-mono tabular-nums text-slate-800 space-y-0.5"
            >
              {scheduled_payments.map((date) => (
                <li key={date}>{date}</li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-slate-500">
            <span className="text-red-600">*</span> denotes a required field
          </p>

          {submitted && formIncomplete && (
            <p role="alert" className="text-sm text-red-600">
              {isSuperAdmin
                ? 'Please select a name and a non profit, and fill in the number of donations, donation amount and start date.'
                : 'Please select a name and fill in the number of donations, donation amount and start date.'}
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

          {onBack && (
            <div className="text-center">
              <button
                type="button"
                onClick={onBack}
                className="text-sm font-medium text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
              >
                Back to Donation Ledgers
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
