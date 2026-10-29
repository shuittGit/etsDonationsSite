import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  ShieldAlert,
  ListChecks,
  BookOpen,
  Download,
} from 'lucide-react';
import { UserSession } from '../types';
import {
  DonationListRow,
  PAYMENT_TYPES,
  PaymentType,
  DonationsListStats,
  NonProfitFilterOption,
  fetchDonationNonProfits,
  fetchDonationsListStats,
  fetchDonationYears,
  fetchDonationsList,
} from '../data/donationsListData';

interface DonationsListProps {
  session: UserSession;
  /** Called when the Donation Ledgers button is clicked. */
  onNavigateToDonationLedgers?: () => void;
}

type ColumnKey = 'username' | 'first_name' | 'last_name' | 'name' | 'amount' | 'date_applied';
type SortDirection = 'asc' | 'desc';

interface ColumnDef {
  key: ColumnKey;
  label: string;
  kind: 'text' | 'money' | 'date';
  sortable: boolean;
  /** Included when filtering. */
  filterable: boolean;
  /** Hidden for Donor users (and so left out of their filter too). */
  hiddenForDonor?: boolean;
}

// Field order as requested
const COLUMNS: ColumnDef[] = [
  { key: 'username', label: 'Username', kind: 'text', sortable: false, filterable: true, hiddenForDonor: true },
  { key: 'first_name', label: 'First Name', kind: 'text', sortable: true, filterable: true, hiddenForDonor: true },
  { key: 'last_name', label: 'Last Name', kind: 'text', sortable: true, filterable: true, hiddenForDonor: true },
  { key: 'name', label: 'Name', kind: 'text', sortable: true, filterable: false },
  { key: 'amount', label: 'Amount', kind: 'money', sortable: true, filterable: true },
  { key: 'date_applied', label: 'Date Applied', kind: 'date', sortable: true, filterable: true },
];

const PAGE_SIZES = [25, 50, 100];

const formatMoney = (value: number) =>
  `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// The text shown in a cell (also what the filter box searches)
const displayValue = (row: DonationListRow, col: ColumnDef): string => {
  const value = row[col.key];
  if (value === null || value === undefined) return '';
  return col.kind === 'money' ? formatMoney(value as number) : String(value);
};

export const DonationsList: React.FC<DonationsListProps> = ({ session, onNavigateToDonationLedgers }) => {
  // Donors see their own donations, Admins those of their Non Profit, SuperAdmins all of them.
  // Other roles are refused (re-verified in the database).
  const canView = session.role !== undefined && session.pin !== undefined;
  // Everyone except SuperAdmin and Admin sees only the donations on their own ledgers (a Donor, or
  // a newly created account with the role 'Admin Approval'), so they get the same trimmed-down
  // page: no names and no Contributors card.
  const isDonor = session.role !== 'SuperAdmin' && session.role !== 'Admin';

  const [rows, setRows] = useState<DonationListRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  // Newest date_applied first
  const [sort, setSort] = useState<{ field: ColumnKey; direction: SortDirection }>({
    field: 'date_applied',
    direction: 'desc',
  });
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [paymentType, setPaymentType] = useState<PaymentType>('Allocated');
  // The Year dropdown: a 'YYYY' value or 'All'; it opens on the current year
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [years, setYears] = useState<string[]>([]);
  const [yearsError, setYearsError] = useState('');
  // The Non Profit dropdown: a Non_Profit id (as text) or 'All'
  const [nonProfitId, setNonProfitId] = useState('All');
  const [nonProfits, setNonProfits] = useState<NonProfitFilterOption[]>([]);
  const [nonProfitsError, setNonProfitsError] = useState('');

  // Reloads from the database whenever the Non Profit, Payment Type or Year changes
  const loadDonations = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    const result = await fetchDonationsList(
      session.username,
      session.pin ?? 0,
      paymentType,
      year,
      nonProfitId
    );
    if (result.success) {
      setRows(result.donations);
    } else {
      setLoadError(result.error);
    }
    setLoaded(true);
    setIsLoading(false);
  }, [session.username, session.pin, paymentType, year, nonProfitId]);

  // Dashboard cards above the grid
  const [stats, setStats] = useState<DonationsListStats | null>(null);
  const [statsError, setStatsError] = useState('');

  // The cards follow the Payment Type, Year and Non Profit selections, like the grid
  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    fetchDonationsListStats(session.username, session.pin ?? 0, paymentType, year, nonProfitId).then(
      (result) => {
        if (cancelled) return;
        if (result.success) {
          setStats(result.stats);
          setStatsError('');
        } else {
          setStatsError(result.error);
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [canView, session.username, session.pin, paymentType, year, nonProfitId]);

  // The Non Profits offered depend on the user's role
  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    fetchDonationNonProfits(session.username, session.pin ?? 0).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setNonProfits(result.nonProfits);
        setNonProfitsError('');
      } else {
        setNonProfitsError(result.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [canView, session.username, session.pin]);

  // 'All' is only offered when there is more than one Non Profit to choose between. With exactly
  // one, it is the only option and is shown as selected (the grid already holds only its donations).
  const showAllNonProfits = nonProfits.length > 1;
  const shownNonProfitId =
    nonProfits.length === 1 ? String(nonProfits[0].id) : nonProfitId;

  // The years offered depend on the Payment Type
  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    fetchDonationYears(session.username, session.pin ?? 0).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setYears(result.years);
        setYearsError('');
      } else {
        setYearsError(result.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [canView, session.username, session.pin]);

  // The years from the earliest to the latest date_applied, newest first, then 'All' below the
  // last one. The current year (the default) is always offered, even when it falls outside that
  // span, so the dropdown matches the grid.
  const yearOptions = useMemo(() => {
    const list = year !== 'All' && !years.includes(year) ? [...years, year].sort().reverse() : years;
    return [...list, 'All'];
  }, [years, year]);

  useEffect(() => {
    if (canView) loadDonations();
  }, [canView, loadDonations]);

  // Donors don't see Username, First Name and Last Name, and those are not searched either
  const columns = useMemo(() => COLUMNS.filter((c) => !(isDonor && c.hiddenForDonor)), [isDonor]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return rows;
    const searched = columns.filter((c) => c.filterable);
    return rows.filter((r) => searched.some((col) => displayValue(r, col).toLowerCase().includes(q)));
  }, [rows, searchQuery, columns]);

  const sortedRows = useMemo(() => {
    const factor = sort.direction === 'asc' ? 1 : -1;
    const col = COLUMNS.find((c) => c.key === sort.field) ?? COLUMNS[COLUMNS.length - 1];
    return [...filteredRows].sort((a, b) => {
      const av = a[col.key];
      const bv = b[col.key];
      if (col.kind === 'money') return factor * (Number(av) - Number(bv));
      return factor * String(av ?? '').localeCompare(String(bv ?? '')); // text and ISO dates
    });
  }, [filteredRows, sort]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const firstShown = sortedRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastShown = Math.min(currentPage * pageSize, sortedRows.length);

  const handleSort = (field: ColumnKey) => {
    setSort((prev) =>
      prev.field === field
        ? { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { field, direction: 'asc' }
    );
  };

  const sortIcon = (field: ColumnKey) => {
    if (sort.field !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 shrink-0" />;
    }
    return sort.direction === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
    );
  };

  // Export CSV: downloads the donations in the list (the rows loaded by fetchDonationsList, with the
  // current Non Profit / Payment Type / Year selections, filter text and sort applied, across all
  // pages) as a .csv file. The columns are the ones shown, so a Donor's file has no names.
  const handleExportCsv = () => {
    // Quote every cell; a leading = + - @ would make a spreadsheet run the cell as a formula
    const cell = (value: string) => {
      let text = value;
      if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const csvValue = (row: DonationListRow, col: ColumnDef): string =>
      // amounts as plain numbers (1200.00) so a spreadsheet can total them
      col.kind === 'money' ? Number(row[col.key]).toFixed(2) : displayValue(row, col);

    const lines = [
      columns.map((c) => cell(c.label)).join(','),
      ...sortedRows.map((row) => columns.map((c) => cell(csvValue(row, c))).join(',')),
    ];

    // The leading ﻿ lets Excel read accented names correctly
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `donations_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!canView) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div role="alert" className="max-w-md text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mx-auto text-rose-600">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-800">
            You lack the proper permissions to view this page.
          </p>
        </div>
      </div>
    );
  }

  // The cards shown, left to right. Contributors is hidden for Donors; the Allocated pair is
  // hidden when the Payment Type is 'Remaining' and the Remaining pair when it is 'Allocated'.
  const cards: { title: string; value: string }[] = [
    { title: 'Total Donated', value: stats ? formatMoney(stats.total_donated) : '' },
    ...(isDonor
      ? []
      : [{ title: 'Total Contributors', value: stats ? String(stats.total_contributors) : '' }]),
    { title: 'Non Profits', value: stats ? String(stats.non_profits) : '' },
    ...(paymentType !== 'Remaining'
      ? [
          { title: 'Total Payments Allocated', value: stats ? String(stats.total_allocated) : '' },
          {
            title: 'Total Payments Allocated Amount',
            value: stats ? formatMoney(stats.total_allocated_amount) : '',
          },
        ]
      : []),
    ...(paymentType !== 'Allocated'
      ? [
          { title: 'Total Payments Remaining', value: stats ? String(stats.total_remaining) : '' },
          {
            title: 'Total Payments Remaining Amount',
            value: stats ? formatMoney(stats.total_remaining_amount) : '',
          },
        ]
      : []),
  ];

  const filterPlaceholder = isDonor
    ? 'Filter by Amount or Date Applied...'
    : 'Filter by Username, First Name, Last Name, Amount, or Date Applied...';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      <section className="bg-white border-b border-slate-200 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1480px] mx-auto flex flex-wrap items-end justify-between gap-4">
          <div>
          <div className="text-xs text-slate-500 mb-1">ETS Donations Records Portal · Donations List</div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Donations List</h1>
          </div>

          {/* Top right, level with the title: Export CSV (everyone), then Donation Ledgers (everyone) */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={sortedRows.length === 0}
              className="min-h-11 sm:min-h-0 flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={onNavigateToDonationLedgers}
              className="min-h-11 sm:min-h-0 flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Donation Ledgers</span>
            </button>
          </div>
        </div>
      </section>

      <main className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* Dashboard cards: first line is the title, second line the value */}
        <div
          className="grid gap-4 mb-6"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))' }}
        >
          {cards.map((card) => (
            <div key={card.title} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="text-slate-500 text-xs font-medium mb-1.5">{card.title}</div>
              <div className="text-2xl font-bold tracking-tight text-slate-900 font-mono tabular-nums min-h-8">
                {card.value}
              </div>
            </div>
          ))}
        </div>
        {statsError && (
          <p role="alert" className="-mt-3 mb-4 text-xs font-semibold text-red-600">
            {statsError}
          </p>
        )}

        {/* Filter box + pagination controls */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              maxLength={250}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder={filterPlaceholder}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-8 py-2.5 sm:py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setPage(1);
                }}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                aria-label="Clear filter"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label htmlFor="nonProfit" className="text-xs font-medium text-slate-500 whitespace-nowrap">
              Non Profit:
            </label>
            <select
              id="nonProfit"
              value={shownNonProfitId}
              onChange={(e) => {
                setNonProfitId(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 border border-slate-200 min-h-11 sm:min-h-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer max-w-[14rem]"
            >
              {showAllNonProfits && <option value="All">All</option>}
              {nonProfits.map((np) => (
                <option key={np.id} value={String(np.id)}>
                  {np.name}
                </option>
              ))}
            </select>

            <label htmlFor="paymentType" className="text-xs font-medium text-slate-500 whitespace-nowrap">
              Payment Type:
            </label>
            <select
              id="paymentType"
              value={paymentType}
              onChange={(e) => {
                setPaymentType(e.target.value as PaymentType);
                setPage(1);
              }}
              className="bg-slate-50 border border-slate-200 min-h-11 sm:min-h-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer"
            >
              {PAYMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <label htmlFor="year" className="text-xs font-medium text-slate-500 whitespace-nowrap">
              Year:
            </label>
            <select
              id="year"
              value={year}
              onChange={(e) => {
                setYear(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 border border-slate-200 min-h-11 sm:min-h-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer"
            >
              {yearOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>

            <label htmlFor="pageSize" className="text-xs font-medium text-slate-500 whitespace-nowrap">
              Rows per page:
            </label>
            <select
              id="pageSize"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="bg-slate-50 border border-slate-200 min-h-11 sm:min-h-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2 sm:gap-1">
              {[
                { label: 'First page', icon: ChevronsLeft, disabled: currentPage === 1, go: () => setPage(1) },
                { label: 'Previous page', icon: ChevronLeft, disabled: currentPage === 1, go: () => setPage(currentPage - 1) },
                { label: 'Next page', icon: ChevronRight, disabled: currentPage === totalPages, go: () => setPage(currentPage + 1) },
                { label: 'Last page', icon: ChevronsRight, disabled: currentPage === totalPages, go: () => setPage(totalPages) },
              ].map(({ label, icon: Icon, disabled, go }) => (
                <button
                  key={label}
                  type="button"
                  onClick={go}
                  disabled={disabled}
                  title={label}
                  aria-label={label}
                  className="p-3 sm:p-1.5 text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-1 mb-2 text-xs text-slate-500">
          <div>
            Showing{' '}
            <span className="font-semibold text-slate-800 font-mono tabular-nums">
              {firstShown}–{lastShown}
            </span>{' '}
            of{' '}
            <span className="font-semibold text-slate-800 font-mono tabular-nums">{sortedRows.length}</span>{' '}
            donations
          </div>
          <div>
            Page <span className="font-mono tabular-nums">{currentPage}</span> of{' '}
            <span className="font-mono tabular-nums">{totalPages}</span>
          </div>
        </div>

        {nonProfitsError && (
          <p role="alert" className="mb-3 text-sm font-semibold text-red-600">
            {nonProfitsError}
          </p>
        )}

        {yearsError && (
          <p role="alert" className="mb-3 text-sm font-semibold text-red-600">
            {yearsError}
          </p>
        )}

        {loadError && (
          <p role="alert" className="mb-3 text-sm font-semibold text-red-600">
            {loadError}
          </p>
        )}

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="relative overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-semibold text-slate-700 uppercase tracking-wider select-none">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      scope="col"
                      className={`py-3.5 px-4 ${col.kind === 'money' ? 'text-right' : ''}`}
                    >
                      {col.sortable ? (
                        <button
                          type="button"
                          onClick={() => handleSort(col.key)}
                          className={`group flex items-center gap-1.5 font-semibold text-slate-700 hover:text-emerald-700 transition-colors cursor-pointer uppercase tracking-wider ${
                            col.kind === 'money' ? 'ml-auto text-right' : 'text-left'
                          }`}
                        >
                          <span>{col.label}</span>
                          {sortIcon(col.key)}
                        </button>
                      ) : (
                        col.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {isLoading && !loaded ? (
                  <tr>
                    <td colSpan={columns.length} className="py-12 text-center text-slate-500 text-sm">
                      Loading donations...
                    </td>
                  </tr>
                ) : pageRows.length > 0 ? (
                  pageRows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`py-3.5 px-4 whitespace-nowrap ${
                            col.kind === 'money'
                              ? 'text-right font-mono font-semibold tabular-nums text-slate-900'
                              : col.kind === 'date'
                                ? 'font-mono text-xs text-slate-600 tabular-nums'
                                : ''
                          }`}
                        >
                          {col.key === 'username' ? (
                            <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-mono text-xs font-semibold">
                              {row.username}
                            </span>
                          ) : (
                            displayValue(row, col)
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={columns.length} className="py-12 text-center text-slate-500">
                      <div className="max-w-xs mx-auto space-y-2">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                          <ListChecks className="w-5 h-5" />
                        </div>
                        <p className="text-sm font-semibold text-slate-800">No matching donations</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};
