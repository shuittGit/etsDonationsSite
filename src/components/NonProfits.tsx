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
  Building2,
  BookOpen,
  Download,
  Users as UsersIcon,
} from 'lucide-react';
import { UserSession } from '../types';
import { EditNonProfit } from './EditNonProfit';
import {
  NonProfitDetails,
  NonProfitListRow,
  NonProfitsTable,
  deleteNonProfit,
  fetchNonProfitDetails,
  fetchNonProfits,
} from '../data/nonProfitData';

interface NonProfitsProps {
  session: UserSession;
  /** Called when the SuperAdmin-only Users button is clicked. */
  onNavigateToUsers?: () => void;
  /** Called when the SuperAdmin-only Donation Ledgers button is clicked. */
  onNavigateToDonationLedgers?: () => void;
  /** Called when the SuperAdmin-only Create Non Profit link is clicked. */
  onCreateNonProfit?: () => void;
}

type SortField = 'name' | 'first_name' | 'last_name';
type SortDirection = 'asc' | 'desc';

const PAGE_SIZES = [25, 50, 100];
const TOTAL_COLUMNS = 11; // 8 data columns + Edit + Details + Delete

/**
 * Turns a stored web address into a safe link target: http / https as typed, a bare address
 * such as "example.org" gets https://, and anything with another scheme (javascript:, data:, ...)
 * is not linked at all.
 */
function toSafeUrl(value: string): string | null {
  const text = value.trim();
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) return text;
  if (/^[a-z][a-z0-9+.-]*:/i.test(text)) return null;
  return `https://${text}`;
}

const linkClass = 'text-emerald-700 hover:text-emerald-800 hover:underline';

export const NonProfits: React.FC<NonProfitsProps> = ({
  session,
  onNavigateToUsers,
  onNavigateToDonationLedgers,
  onCreateNonProfit,
}) => {
  // Only SuperAdmin users may view this page (re-verified in the database)
  const isSuperAdmin = session.role === 'SuperAdmin' && session.pin !== undefined;

  const [table, setTable] = useState<NonProfitsTable | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<{ field: SortField; direction: SortDirection }>({
    field: 'name',
    direction: 'asc',
  });
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  const loadNonProfits = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    const result = await fetchNonProfits(session.username, session.pin ?? 0);
    if (result.success) {
      setTable(result.table);
    } else {
      setLoadError(result.error);
    }
    setIsLoading(false);
  }, [session.username, session.pin]);

  useEffect(() => {
    if (isSuperAdmin) loadNonProfits();
  }, [isSuperAdmin, loadNonProfits]);

  // Edit Non Profit popup
  const [editingNonProfit, setEditingNonProfit] = useState<NonProfitListRow | null>(null);

  // Delete popup
  const [deletingNonProfit, setDeletingNonProfit] = useState<NonProfitListRow | null>(null);
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
    setDeletingNonProfit(null);
    setDeleteMessage(null);
    setIsDeleting(false);
  };

  // Yes: removes the non profit's donations, then its ledgers, then the non profit (one database function)
  const handleConfirmDelete = async () => {
    if (!deletingNonProfit) return;
    setIsDeleting(true);
    setDeleteMessage(null);
    const result = await deleteNonProfit(session.username, session.pin ?? 0, deletingNonProfit.id);
    if (!result.success) {
      setDeleteMessage({ type: 'error', text: result.error });
      setIsDeleting(false);
      return;
    }
    setDeleteMessage({
      type: 'success',
      text: 'The Non Profit and its donation ledgers and donations have been deleted.',
    });
    // Show the confirmation for 2 seconds, then close the popup and refresh the grid
    deleteTimer.current = setTimeout(() => {
      closeDelete();
      loadNonProfits();
    }, 2000);
  };

  // Details popup
  const [detailsFor, setDetailsFor] = useState<NonProfitListRow | null>(null);
  const [details, setDetails] = useState<NonProfitDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const openNonProfitId = useRef<number | null>(null);

  const openDetails = async (nonProfit: NonProfitListRow) => {
    setDetailsFor(nonProfit);
    setDetails(null);
    setDetailsError('');
    setDetailsLoading(true);
    openNonProfitId.current = nonProfit.id;
    const result = await fetchNonProfitDetails(session.username, session.pin ?? 0, nonProfit.id);
    // Ignore the answer if a different row was opened or the popup was closed meanwhile
    if (openNonProfitId.current !== nonProfit.id) return;
    if (result.success) {
      setDetails(result.details);
    } else {
      setDetailsError(result.error);
    }
    setDetailsLoading(false);
  };

  const closeDetails = () => {
    openNonProfitId.current = null;
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

  // Filter on username, first_name, last_name, non profit name and role
  const filteredRows = useMemo(() => {
    const rows = table?.rows ?? [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.username, r.first_name, r.last_name, r.name, r.role].some((v) => v.toLowerCase().includes(q))
    );
  }, [table, searchQuery]);

  const sortedRows = useMemo(() => {
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...filteredRows].sort((a, b) => factor * a[sort.field].localeCompare(b[sort.field]));
  }, [filteredRows, sort]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = sortedRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const firstShown = sortedRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastShown = Math.min(currentPage * pageSize, sortedRows.length);

  const handleSort = (field: SortField) => {
    setSort((prev) =>
      prev.field === field
        ? { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { field, direction: 'asc' }
    );
  };

  const sortIcon = (field: SortField) => {
    if (sort.field !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 shrink-0" />;
    }
    return sort.direction === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
    );
  };

  const sortableHeader = (field: SortField, label: string) => (
    <th scope="col" className="py-3.5 px-4">
      <button
        type="button"
        onClick={() => handleSort(field)}
        className="group flex items-center gap-1.5 font-semibold text-slate-700 hover:text-emerald-700 transition-colors cursor-pointer text-left uppercase tracking-wider"
      >
        <span>{label}</span>
        {sortIcon(field)}
      </button>
    </th>
  );

  // Export CSV: downloads the non profits in the list (the rows loaded by fetchNonProfits, with the
  // current filter and sort applied, across all pages) as a .csv file
  const handleExportCsv = () => {
    const header = ['Non Profit', 'First Name', 'Last Name', 'Username', 'Email', 'Phone', 'Address', 'Url'];
    // Quote every cell; a leading = + - @ would make a spreadsheet run the cell as a formula
    const cell = (value: string | null) => {
      let text = value === null || value === undefined ? '' : String(value);
      if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const lines = [
      header.map(cell).join(','),
      ...sortedRows.map((np) =>
        [np.name, np.first_name, np.last_name, np.username, np.email, np.phone_number, np.address, np.url]
          .map(cell)
          .join(',')
      ),
    ];

    // The leading ﻿ lets Excel read accented names correctly
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `non_profits_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isSuperAdmin) {
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
        <div className="max-w-[1380px] mx-auto flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500 mb-1">ETS Donations Records Portal · Non Profits</div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Non Profits</h1>
          </div>

          {/* SuperAdmin only: Users and Donation Ledgers, top right, level with the title */}
          {session.role === 'SuperAdmin' && (
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
                onClick={onNavigateToUsers}
                className="min-h-11 sm:min-h-0 flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
              >
                <UsersIcon className="w-3.5 h-3.5" />
                <span>Users</span>
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
          )}
        </div>
      </section>

      <main className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 mt-6">
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
              placeholder="Filter by Non Profit, First Name, Last Name, Username, or Role..."
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
            non profits
          </div>
          <div>
            Page <span className="font-mono tabular-nums">{currentPage}</span> of{' '}
            <span className="font-mono tabular-nums">{totalPages}</span>
          </div>
        </div>

        {/* SuperAdmin only: Create Non Profit link, far right above the grid */}
        {session.role === 'SuperAdmin' && (
          <div className="flex justify-end px-1 mb-2">
            <a
              href="#new-non-profit"
              onClick={(e) => {
                e.preventDefault();
                onCreateNonProfit?.();
              }}
              className="text-sm font-medium text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
            >
              Create Non Profit
            </a>
          </div>
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
                  {sortableHeader('name', 'Non Profit')}
                  {sortableHeader('first_name', 'First Name')}
                  {sortableHeader('last_name', 'Last Name')}
                  <th scope="col" className="py-3.5 px-4">Username</th>
                  <th scope="col" className="py-3.5 px-4">Email</th>
                  <th scope="col" className="py-3.5 px-4">Phone</th>
                  <th scope="col" className="py-3.5 px-4">Address</th>
                  <th scope="col" className="py-3.5 px-4">Url</th>
                  <th scope="col" className="py-3.5 px-4">
                    <span className="sr-only">Edit</span>
                  </th>
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
                    <td colSpan={TOTAL_COLUMNS} className="py-12 text-center text-slate-500 text-sm">
                      Loading non profits...
                    </td>
                  </tr>
                ) : pageRows.length > 0 ? (
                  pageRows.map((np) => {
                    const href = np.url ? toSafeUrl(np.url) : null;
                    return (
                      <tr key={np.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-medium text-slate-900 whitespace-nowrap">{np.name}</td>
                        <td className="py-3.5 px-4 whitespace-nowrap">{np.first_name}</td>
                        <td className="py-3.5 px-4 whitespace-nowrap">{np.last_name}</td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-mono text-xs font-semibold">
                            {np.username}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {np.email ? (
                            <a href={`mailto:${np.email}`} className={linkClass}>
                              {np.email}
                            </a>
                          ) : null}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">{np.phone_number ?? ''}</td>
                        <td className="py-3.5 px-4">{np.address ?? ''}</td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {np.url ? (
                            href ? (
                              <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                                {np.url}
                              </a>
                            ) : (
                              np.url
                            )
                          ) : null}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setEditingNonProfit(np)}
                            className={`inline-flex items-center min-h-11 px-2 sm:min-h-0 sm:px-0 ${linkClass} font-medium cursor-pointer`}
                          >
                            Edit
                          </button>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openDetails(np)}
                            className={`inline-flex items-center min-h-11 px-2 sm:min-h-0 sm:px-0 ${linkClass} font-medium cursor-pointer`}
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
                                setDeletingNonProfit(np);
                              }}
                              className="inline-flex items-center min-h-11 px-2 sm:min-h-0 sm:px-0 text-rose-700 hover:text-rose-800 hover:underline font-medium cursor-pointer"
                            >
                              Delete
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={TOTAL_COLUMNS} className="py-12 text-center text-slate-500">
                      <div className="max-w-xs mx-auto space-y-2">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <p className="text-sm font-semibold text-slate-800">No matching non profits</p>
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
      {isSuperAdmin && deletingNonProfit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="deleteNonProfitTitle"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-4 sm:p-6 break-words text-slate-900 max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <h3 id="deleteNonProfitTitle" className="font-bold text-base mb-2">
              Are you sure you want to delete this non profit?
            </h3>
            <p className="text-sm text-slate-600">
              Doing so will remove the non profit and its donation ledgers and donations records.
            </p>
            <p className="mt-3 text-sm font-semibold">{deletingNonProfit.name}</p>

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
                className="min-h-11 sm:min-h-0 px-3.5 py-2 text-sm font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 hover:border-rose-300 transition-colors whitespace-nowrap disabled:opacity-60 cursor-pointer"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={closeDelete}
                disabled={isDeleting}
                className="min-h-11 sm:min-h-0 px-3.5 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap disabled:opacity-60 cursor-pointer"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Non Profit popup */}
      {editingNonProfit && (
        <EditNonProfit
          session={session}
          nonProfitId={editingNonProfit.id}
          onClose={() => setEditingNonProfit(null)}
          onUpdated={() => {
            setEditingNonProfit(null);
            loadNonProfits(); // refresh the grid with the saved values
          }}
        />
      )}

      {/* Details popup, centered on screen */}
      {detailsFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="nonProfitDetailsTitle"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-4 sm:p-6 break-words text-slate-900 max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 mb-5">
              <h3 id="nonProfitDetailsTitle" className="font-bold text-base">
                Non Profit Details
              </h3>
              <button
                type="button"
                onClick={closeDetails}
                className="p-3 sm:p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
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
              <div className="flex flex-col gap-4 text-center">
                <div>
                  <div className="text-xs font-medium text-slate-500">Non Profit</div>
                  <div className="text-sm font-semibold">{details.name}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500">Name</div>
                  <div className="text-sm font-semibold">
                    {details.first_name} {details.last_name}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500">Email</div>
                  <div className="text-sm font-semibold">
                    {details.email ? (
                      <a href={`mailto:${details.email}`} className={linkClass}>
                        {details.email}
                      </a>
                    ) : null}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500">Phone</div>
                  <div className="text-sm font-semibold">{details.phone_number ?? ''}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500">Url</div>
                  <div className="text-sm font-semibold break-all">
                    {details.url ? (
                      toSafeUrl(details.url) ? (
                        <a
                          href={toSafeUrl(details.url)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={linkClass}
                        >
                          {details.url}
                        </a>
                      ) : (
                        details.url
                      )
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
