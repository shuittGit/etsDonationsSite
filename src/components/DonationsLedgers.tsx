import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  BookOpen,
  Building2,
  ListChecks,
  Download,
  Users as UsersIcon,
} from 'lucide-react';
import { UserSession } from '../types';
import { EditDonation } from './EditDonation';
import {
  DonationLedgerDetails,
  DonationLedgerRow,
  DonationLedgersTable,
  fetchDonationLedgerDetails,
  fetchDonationLedgers,
  DonationLedgerStats,
  deleteDonationLedger,
  fetchDonationLedgerStats,
} from '../data/ledgersData';

interface DonationsLedgersProps {
  session: UserSession;
  /** Called when the Create Donation link is clicked. */
  onCreateDonation?: () => void;
  /** Called when the Donations List button (Admin and SuperAdmin) is clicked. */
  onNavigateToDonationsList?: () => void;
  /** Called when the SuperAdmin-only Users button is clicked. */
  onNavigateToUsers?: () => void;
  /** Called when the SuperAdmin-only Non Profits button is clicked. */
  onNavigateToNonProfits?: () => void;
}

type ColumnKey =
  | 'username'
  | 'first_name'
  | 'last_name'
  | 'non_profit_name'
  | 'total_num_of_donations'
  | 'total_amount'
  | 'num_donations_made'
  | 'amount_allocated'
  // | 'num_donations_remaining'
  // | 'amount_remaining'
  | 'donation_start_date'
  | 'donation_end_date';

type SortDirection = 'asc' | 'desc';

interface ColumnDef {
  key: ColumnKey;
  label: string;
  kind: 'text' | 'count' | 'money' | 'date';
  /** Not shown to Admin users (an Admin only ever sees their own Non Profit, so it never varies). */
  hiddenForAdmin?: boolean;
  /** Hidden for users who see only their own ledgers (Donors), who are the donor on every row. */
  hiddenForOwnOnly?: boolean;
}

// Field order as requested
const COLUMNS: ColumnDef[] = [
  { key: 'username', label: 'Username', kind: 'text', hiddenForOwnOnly: true },
  { key: 'first_name', label: 'First Name', kind: 'text', hiddenForOwnOnly: true },
  { key: 'last_name', label: 'Last Name', kind: 'text', hiddenForOwnOnly: true },
  { key: 'non_profit_name', label: 'Non Profit', kind: 'text', hiddenForAdmin: true },
  { key: 'total_num_of_donations', label: 'Total Donations', kind: 'count' },
  { key: 'total_amount', label: 'Total Amount', kind: 'money' },
  { key: 'num_donations_made', label: 'Number Allocated', kind: 'count' },
  { key: 'amount_allocated', label: 'Amount Allocated', kind: 'money' },
  // { key: 'num_donations_remaining', label: 'Number Remaining', kind: 'count' },
  // { key: 'amount_remaining', label: 'Amount Remaining', kind: 'money' },
  { key: 'donation_start_date', label: 'Start Date', kind: 'date' },
  { key: 'donation_end_date', label: 'End Date', kind: 'date' },
];

const PAGE_SIZES = [25, 50, 100];

const formatMoney = (value: number | null) =>
  value === null || value === undefined
    ? ''
    : `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// The text shown in a cell (also what the filter box searches)
const displayValue = (row: DonationLedgerRow, col: ColumnDef): string => {
  const value = row[col.key];
  if (value === null || value === undefined) return '';
  return col.kind === 'money' ? formatMoney(value as number) : String(value);
};

export const DonationsLedgers: React.FC<DonationsLedgersProps> = ({
  session,
  onCreateDonation,
  onNavigateToDonationsList,
  onNavigateToUsers,
  onNavigateToNonProfits,
}) => {
  // SuperAdmin sees every ledger; Admin sees the ledgers of their own Non Profit; any other
  // signed-in user (a Donor, or a newly created account) sees only the ledgers tied to their own
  // user id. All re-verified in the database.
  const canView = session.role !== undefined && session.pin !== undefined;
  // Only SuperAdmin and Admin get the totals, Edit and the Create Donation link
  const isManager = session.role === 'SuperAdmin' || session.role === 'Admin';

  const [table, setTable] = useState<DonationLedgersTable | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  // Managers start sorted by username; users who see only their own ledgers have no name columns,
  // so they start with the latest start date first
  const [sort, setSort] = useState<{ field: ColumnKey; direction: SortDirection }>(
    isManager
      ? { field: 'username', direction: 'asc' }
      : { field: 'donation_start_date', direction: 'desc' }
  );
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  const loadLedgers = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    const result = await fetchDonationLedgers(session.username, session.pin ?? 0);
    if (result.success) {
      setTable(result.table);
    } else {
      setLoadError(result.error);
    }
    setIsLoading(false);
  }, [session.username, session.pin]);

  useEffect(() => {
    if (canView) loadLedgers();
  }, [canView, loadLedgers]);

  // Summary cards above the grid
  const [stats, setStats] = useState<DonationLedgerStats | null>(null);
  const [statsError, setStatsError] = useState('');

  const loadStats = useCallback(async () => {
    const result = await fetchDonationLedgerStats(session.username, session.pin ?? 0);
    if (result.success) {
      setStats(result.stats);
      setStatsError('');
    } else {
      setStatsError(result.error);
    }
  }, [session.username, session.pin]);

  useEffect(() => {
    if (canView && isManager) loadStats();
  }, [canView, isManager, loadStats]);

  // Edit Donation popup
  const [editingLedger, setEditingLedger] = useState<DonationLedgerRow | null>(null);

  // Details popup
  const [detailsFor, setDetailsFor] = useState<DonationLedgerRow | null>(null);
  const [details, setDetails] = useState<DonationLedgerDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const openLedgerId = useRef<number | null>(null);

  const openDetails = async (ledger: DonationLedgerRow) => {
    setDetailsFor(ledger);
    setDetails(null);
    setDetailsError('');
    setDetailsLoading(true);
    openLedgerId.current = ledger.id;
    const result = await fetchDonationLedgerDetails(session.username, session.pin ?? 0, ledger.id);
    // Ignore the answer if a different ledger was opened or the popup was closed meanwhile
    if (openLedgerId.current !== ledger.id) return;
    if (result.success) {
      setDetails(result.details);
    } else {
      setDetailsError(result.error);
    }
    setDetailsLoading(false);
  };

  const closeDetails = () => {
    openLedgerId.current = null;
    setDetailsFor(null);
    setDetails(null);
    setDetailsError('');
    setDetailsLoading(false);
  };

  useEffect(() => {
    if (!detailsFor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDetails();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailsFor]);

  // The columns shown: Non Profit is for SuperAdmin and Donors (not Admin); the name columns are
  // for SuperAdmin and Admin (not users who see only their own ledgers)
  const isSuperAdmin = session.role === 'SuperAdmin';
  const isAdmin = session.role === 'Admin';
  const columns = useMemo(
    () =>
      COLUMNS.filter((c) => !(c.hiddenForAdmin && isAdmin) && !(c.hiddenForOwnOnly && !isManager)),
    [isAdmin, isManager]
  );
  // + Details (everyone), Edit (Admin and SuperAdmin) and Delete (SuperAdmin)
  const totalColumns = columns.length + 1 + (isManager ? 1 : 0) + (isSuperAdmin ? 1 : 0);

  // Delete popup (SuperAdmin only)
  const [deletingLedger, setDeletingLedger] = useState<DonationLedgerRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Don't fire the close if the page is left before the 2 seconds are up
  useEffect(() => {
    return () => {
      if (deleteTimer.current) clearTimeout(deleteTimer.current);
    };
  }, []);

  const closeDelete = () => {
    if (deleteTimer.current) clearTimeout(deleteTimer.current);
    setDeletingLedger(null);
    setDeleteMessage(null);
    setIsDeleting(false);
  };

  // Yes: removes the ledger's Donations records, then the ledger itself (one database function)
  const handleConfirmDelete = async () => {
    if (!deletingLedger) return;
    setIsDeleting(true);
    setDeleteMessage(null);
    const result = await deleteDonationLedger(session.username, session.pin ?? 0, deletingLedger.id);
    if (!result.success) {
      setDeleteMessage({ type: 'error', text: result.error });
      setIsDeleting(false);
      return;
    }
    setDeleteMessage({ type: 'success', text: 'The Donation Ledger and Donations have been deleted.' });
    // Show the confirmation for 2 seconds, then close the popup and refresh the grid and cards
    deleteTimer.current = setTimeout(() => {
      closeDelete();
      loadLedgers();
      loadStats();
    }, 2000);
  };

  // Filter across every shown column
  const filteredRows = useMemo(() => {
    const rows = table?.rows ?? [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((r) => columns.some((col) => displayValue(r, col).toLowerCase().includes(q)));
  }, [table, searchQuery, columns]);

  const sortedRows = useMemo(() => {
    const factor = sort.direction === 'asc' ? 1 : -1;
    const col = columns.find((c) => c.key === sort.field) ?? columns[0];
    return [...filteredRows].sort((a, b) => {
      const av = a[col.key];
      const bv = b[col.key];
      // Empty values sort first when ascending
      if (av === null || av === undefined) return bv === null || bv === undefined ? 0 : -factor;
      if (bv === null || bv === undefined) return factor;
      if (col.kind === 'count' || col.kind === 'money') {
        return factor * (Number(av) - Number(bv));
      }
      return factor * String(av).localeCompare(String(bv)); // text and ISO dates
    });
  }, [filteredRows, sort, columns]);

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

  // Export CSV: downloads the donation ledgers in the list (the rows loaded by fetchDonationLedgers,
  // with the current filter and sort applied, across all pages) as a .csv file. The columns are the
  // ones shown, so what you can't see on the page isn't in the file either.
  const handleExportCsv = () => {
    // Quote every cell; a leading = + - @ would make a spreadsheet run the cell as a formula
    const cell = (value: string) => {
      let text = value;
      if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const csvValue = (row: DonationLedgerRow, col: ColumnDef): string => {
      const value = row[col.key];
      if (value === null || value === undefined) return '';
      // amounts as plain numbers (1200.00) so a spreadsheet can total them
      return col.kind === 'money' ? Number(value).toFixed(2) : String(value);
    };

    const lines = [
      columns.map((c) => cell(c.label)).join(','),
      ...sortedRows.map((row) => columns.map((c) => cell(csvValue(row, c))).join(',')),
    ];

    // The leading ﻿ lets Excel read accented names correctly
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `donation_ledgers_${new Date().toISOString().slice(0, 10)}.csv`;
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      <section className="bg-white border-b border-slate-200 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1480px] mx-auto flex items-end justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500 mb-1">ETS Donations Records Portal · Donation Ledgers</div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Donation Ledgers</h1>
          </div>

          {/* Top right, level with the title: Donations List (everyone), then Users and
              Non Profits (SuperAdmin only) */}
          {canView && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={sortedRows.length === 0}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                onClick={onNavigateToDonationsList}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
              >
                <ListChecks className="w-3.5 h-3.5" />
                <span>Donations List</span>
              </button>
              {session.role === 'SuperAdmin' && (
                <>
              <button
                type="button"
                onClick={onNavigateToUsers}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
              >
                <UsersIcon className="w-3.5 h-3.5" />
                <span>Users</span>
              </button>
              <button
                type="button"
                onClick={onNavigateToNonProfits}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Non Profits</span>
              </button>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      <main className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* Summary cards (Admin and SuperAdmin): first line is the title, second line the value */}
        {isManager && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {[
            { title: 'Total Donated', value: stats ? formatMoney(stats.total_donated) : '' },
            { title: 'Total Contributors', value: stats ? String(stats.total_contributors) : '' },
            { title: 'Non Profits', value: stats ? String(stats.non_profits) : '' },
            { title: 'Total Payments Allocated', value: stats ? String(stats.total_allocated) : '' },
            {
              title: 'Total Payments Allocated Amount',
              value: stats ? formatMoney(stats.total_allocated_amount) : '',
            },
          ].map((card) => (
            <div key={card.title} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="text-slate-500 text-xs font-medium mb-1.5">{card.title}</div>
              <div className="text-2xl font-bold tracking-tight text-slate-900 font-mono tabular-nums min-h-8">
                {card.value}
              </div>
            </div>
          ))}
        </div>
        )}
        {isManager && statsError && (
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
              placeholder="Filter by any column..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-8 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all"
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
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1">
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
                  className="p-1.5 text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
            ledgers
          </div>
          <div>
            Page <span className="font-mono tabular-nums">{currentPage}</span> of{' '}
            <span className="font-mono tabular-nums">{totalPages}</span>
          </div>
        </div>

        {/* Create Donation link, top right above the grid (Admin and SuperAdmin) */}
        {isManager && (
          <div className="flex justify-end px-1 mb-2">
            <a
              href="#new-donation"
              onClick={(e) => {
                e.preventDefault();
                onCreateDonation?.();
              }}
              className="text-sm font-medium text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
            >
              Create Donation
            </a>
          </div>
        )}

        {loadError && (
          <p role="alert" className="mb-3 text-sm font-semibold text-red-600">
            {loadError}
          </p>
        )}

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-semibold text-slate-700 uppercase tracking-wider select-none">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      scope="col"
                      className={`py-3.5 px-4 ${col.kind === 'count' || col.kind === 'money' ? 'text-right' : ''}`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSort(col.key)}
                        className={`group flex items-center gap-1.5 font-semibold text-slate-700 hover:text-emerald-700 transition-colors cursor-pointer uppercase tracking-wider ${
                          col.kind === 'count' || col.kind === 'money' ? 'ml-auto text-right' : 'text-left'
                        }`}
                      >
                        <span>{col.label}</span>
                        {sortIcon(col.key)}
                      </button>
                    </th>
                  ))}
                  {isManager && (
                    <th scope="col" className="py-3.5 px-4">
                      <span className="sr-only">Edit</span>
                    </th>
                  )}
                  <th scope="col" className="py-3.5 px-4">
                    <span className="sr-only">Details</span>
                  </th>
                  {isSuperAdmin && (
                    <th scope="col" className="py-3.5 px-4">
                      <span className="sr-only">Delete</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {isLoading && !table ? (
                  <tr>
                    <td colSpan={totalColumns} className="py-12 text-center text-slate-500 text-sm">
                      Loading donation ledgers...
                    </td>
                  </tr>
                ) : pageRows.length > 0 ? (
                  pageRows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`py-3.5 px-4 whitespace-nowrap ${
                            col.kind === 'count' || col.kind === 'money'
                              ? 'text-right font-mono tabular-nums'
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
                      {isManager && (
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setEditingLedger(row)}
                            className="text-emerald-700 hover:text-emerald-800 hover:underline font-medium cursor-pointer"
                          >
                            Edit
                          </button>
                        </td>
                      )}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openDetails(row)}
                          className="text-emerald-700 hover:text-emerald-800 hover:underline font-medium cursor-pointer"
                        >
                          Details
                        </button>
                      </td>
                      {isSuperAdmin && (
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteMessage(null);
                              setDeletingLedger(row);
                            }}
                            className="text-rose-700 hover:text-rose-800 hover:underline font-medium cursor-pointer"
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={totalColumns} className="py-12 text-center text-slate-500">
                      <div className="max-w-xs mx-auto space-y-2">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <p className="text-sm font-semibold text-slate-800">No matching donation ledgers</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Delete confirmation popup (SuperAdmin only), centered on screen */}
      {isSuperAdmin && deletingLedger && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="deleteLedgerTitle"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-slate-900">
            <h3 id="deleteLedgerTitle" className="font-bold text-base mb-2">
              Are you sure you want to delete this donation ledger?
            </h3>
            <p className="text-sm text-slate-600">
              Doing so will remove the ledger and all {deletingLedger.non_profit_name} donation records
              for {deletingLedger.first_name} {deletingLedger.last_name}.
            </p>

            {deleteMessage && (
              <p
                role="alert"
                className={`mt-4 text-sm font-semibold ${
                  deleteMessage.type === 'success' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {deleteMessage.text}
              </p>
            )}

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting || deleteMessage?.type === 'success'}
                className="px-3.5 py-2 text-sm font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 hover:border-rose-300 transition-colors whitespace-nowrap disabled:opacity-60 cursor-pointer"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={closeDelete}
                disabled={isDeleting}
                className="px-3.5 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap disabled:opacity-60 cursor-pointer"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Donation popup */}
      {editingLedger && (
        <EditDonation
          session={session}
          ledgerId={editingLedger.id}
          onClose={() => setEditingLedger(null)}
          onUpdated={() => {
            setEditingLedger(null);
            loadLedgers(); // refresh the grid and the cards with the saved values
            loadStats();
          }}
        />
      )}

      {/* Details popup, centered on screen */}
      {detailsFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ledgerDetailsTitle"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 text-slate-900">
            {/* Non Profit name, top left */}
            <div className="flex items-start justify-between gap-4 mb-5">
              <h3 id="ledgerDetailsTitle" className="font-bold text-base text-left">
                {details?.non_profit_name ?? detailsFor.non_profit_name}
              </h3>
              <button
                type="button"
                onClick={closeDetails}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Close details"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {detailsLoading && <p className="py-8 text-center text-sm text-slate-500">Loading details...</p>}

            {detailsError && (
              <p role="alert" className="py-4 text-center text-sm font-semibold text-red-600">
                {detailsError}
              </p>
            )}

            {details && (
              // Left aligned; every value sits on the same line as its label
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-left text-sm">
                {/* Row 1 */}
                <div className="col-span-2 flex items-baseline gap-1.5">
                  <span className="font-medium text-slate-500">Name:</span>
                  <span className="font-semibold">
                    {details.first_name} {details.last_name}
                  </span>
                </div>

                {/* Row 2 */}
                <div className="col-span-2 flex items-baseline gap-1.5">
                  <span className="font-medium text-slate-500">Total Number of Donations:</span>
                  <span className="font-semibold font-mono tabular-nums">
                    {details.total_num_of_donations ?? ''}
                  </span>
                </div>

                {/* Row 3 */}
                <div className="col-span-2 flex items-baseline gap-1.5">
                  <span className="font-medium text-slate-500">Total Donation Amount:</span>
                  <span className="font-semibold font-mono tabular-nums">
                    {formatMoney(details.total_amount)}
                  </span>
                </div>

                {/* Row 4: allocated */}
                <div className="flex items-baseline gap-1.5">
                  <span className="font-medium text-slate-500">Donations Allocated:</span>
                  <span className="font-semibold font-mono tabular-nums">
                    {details.num_donations_allocated}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-medium text-slate-500">Amount Allocated:</span>
                  <span className="font-semibold font-mono tabular-nums">
                    {formatMoney(details.amount_allocated)}
                  </span>
                </div>

                {/* Row 5: remaining */}
                <div className="flex items-baseline gap-1.5">
                  <span className="font-medium text-slate-500">Donations Remaining:</span>
                  <span className="font-semibold font-mono tabular-nums">
                    {details.num_donations_remaining ?? ''}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-medium text-slate-500">Amount Remaining:</span>
                  <span className="font-semibold font-mono tabular-nums">
                    {formatMoney(details.amount_remaining)}
                  </span>
                </div>

                {/* Row 6 */}
                <div className="col-span-2 flex items-baseline gap-1.5">
                  <span className="font-medium text-slate-500">Avg. Donation Amount:</span>
                  <span className="font-semibold font-mono tabular-nums">
                    {formatMoney(details.avg_donation_amount)}
                  </span>
                </div>

                {/* Start and end dates, kept from before */}
                <div className="flex items-baseline gap-1.5">
                  <span className="font-medium text-slate-500">Start Date:</span>
                  <span className="font-semibold font-mono tabular-nums">
                    {details.donation_start_date ?? ''}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-medium text-slate-500">End Date:</span>
                  <span className="font-semibold font-mono tabular-nums">
                    {details.donation_end_date ?? ''}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
