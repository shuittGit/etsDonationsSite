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
import {
  ROLE_OPTIONS,
  UserTableRow,
  UsersTable,
  deleteUser,
  fetchUsersTable,
  updateUserRole,
} from '../data/usersData';

interface UsersProps {
  session: UserSession;
  /** Called when the SuperAdmin-only Non Profits button is clicked. */
  onNavigateToNonProfits?: () => void;
  /** Called when the SuperAdmin-only Donation Ledgers button is clicked. */
  onNavigateToDonationLedgers?: () => void;
}

type SortField = 'username' | 'first_name' | 'last_name';
type SortDirection = 'asc' | 'desc';

const PAGE_SIZES = [25, 50, 100];

export const Users: React.FC<UsersProps> = ({
  session,
  onNavigateToNonProfits,
  onNavigateToDonationLedgers,
}) => {
  // Only SuperAdmin users may view this page (re-verified in the database on every call)
  const isSuperAdmin = session.role === 'SuperAdmin' && session.pin !== undefined;

  const [table, setTable] = useState<UsersTable | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<{ field: SortField; direction: SortDirection }>({
    field: 'username',
    direction: 'asc',
  });
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  const [editingUser, setEditingUser] = useState<UserTableRow | null>(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  // Delete popup
  const [deletingUser, setDeletingUser] = useState<UserTableRow | null>(null);
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

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    const result = await fetchUsersTable(session.username, session.pin ?? 0);
    if (result.success) {
      setTable(result.table);
    } else {
      setLoadError(result.error);
    }
    setIsLoading(false);
  }, [session.username, session.pin]);

  useEffect(() => {
    if (isSuperAdmin) loadUsers();
  }, [isSuperAdmin, loadUsers]);

  // Filter across username, first_name, last_name, pin, role and email
  const filteredRows = useMemo(() => {
    const rows = table?.rows ?? [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.username, r.first_name, r.last_name, String(r.pin), r.role, r.email ?? ''].some((v) =>
        v.toLowerCase().includes(q)
      )
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

  const openRoleEditor = (user: UserTableRow) => {
    setEditingUser(user);
    setSelectedRole(user.role);
    setModalError('');
  };

  // Exit: close the popup and stay on the Users page
  const closeRoleEditor = () => {
    setEditingUser(null);
    setModalError('');
  };

  // Submit: save the edited role to the Users table, then return to the grid
  const handleRoleSubmit = async () => {
    if (!editingUser) return;
    setIsSaving(true);
    setModalError('');
    const result = await updateUserRole(session.username, session.pin ?? 0, editingUser.id, selectedRole);
    setIsSaving(false);
    if (!result.success) {
      setModalError(result.error);
      return;
    }
    closeRoleEditor();
    await loadUsers();
  };

  const closeDelete = () => {
    if (deleteTimer.current) clearTimeout(deleteTimer.current);
    setDeletingUser(null);
    setDeleteMessage(null);
    setIsDeleting(false);
  };

  // Yes: removes the user's donations, ledgers and Non Profit (if any), then the user (one database function)
  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    setDeleteMessage(null);
    const result = await deleteUser(session.username, session.pin ?? 0, deletingUser.id);
    if (!result.success) {
      setDeleteMessage({ type: 'error', text: result.error });
      setIsDeleting(false);
      return;
    }
    setDeleteMessage({ type: 'success', text: 'The User and associated records have been deleted.' });
    // Show the confirmation for 2 seconds, then close the popup and refresh the grid
    deleteTimer.current = setTimeout(() => {
      closeDelete();
      loadUsers();
    }, 2000);
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

  // Export CSV: downloads the users in the list (the rows loaded by fetchUsersTable, with the
  // current filter and sort applied, across all pages) as a .csv file
  const handleExportCsv = () => {
    const header = ['Username', 'First Name', 'Last Name', 'PIN', 'Role', 'Email'];
    // Quote every cell; a leading = + - @ would make a spreadsheet run the cell as a formula
    const cell = (value: string | number | null) => {
      let text = value === null || value === undefined ? '' : String(value);
      if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const lines = [
      header.map(cell).join(','),
      ...sortedRows.map((u) =>
        [u.username, u.first_name, u.last_name, u.pin, u.role, u.email].map(cell).join(',')
      ),
    ];

    // The leading ﻿ lets Excel read accented names correctly
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `users_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Role options: the three allowed values, plus the current value if it is something else
  const roleChoices =
    editingUser && !ROLE_OPTIONS.includes(editingUser.role)
      ? [editingUser.role, ...ROLE_OPTIONS]
      : ROLE_OPTIONS;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      <section className="bg-white border-b border-slate-200 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-wrap items-end justify-between gap-4">
          <div>
          <div className="text-xs text-slate-500 mb-1">ETS Donations Records Portal · Users</div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Users</h1>
          </div>

          {/* SuperAdmin only: Non Profits and Donation Ledgers, top right, level with the title */}
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
                onClick={onNavigateToNonProfits}
                className="min-h-11 sm:min-h-0 flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Non Profits</span>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
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
              placeholder="Filter by Username, First Name, Last Name, PIN, Role, or Email..."
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
            users
          </div>
          <div>
            Page <span className="font-mono tabular-nums">{currentPage}</span> of{' '}
            <span className="font-mono tabular-nums">{totalPages}</span>
          </div>
        </div>

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
                  {sortableHeader('username', 'Username')}
                  {sortableHeader('first_name', 'First Name')}
                  {sortableHeader('last_name', 'Last Name')}
                  <th scope="col" className="py-3.5 px-4">PIN</th>
                  <th scope="col" className="py-3.5 px-4">Role</th>
                  <th scope="col" className="py-3.5 px-4">Email</th>
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
                    <td colSpan={7} className="py-12 text-center text-slate-500 text-sm">
                      Loading users...
                    </td>
                  </tr>
                ) : pageRows.length > 0 ? (
                  pageRows.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-mono text-xs font-semibold">
                          {u.username}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">{u.first_name}</td>
                      <td className="py-3.5 px-4 whitespace-nowrap">{u.last_name}</td>
                      <td className="py-3.5 px-4 font-mono text-xs tabular-nums">{u.pin}</td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openRoleEditor(u)}
                          className="inline-flex items-center min-h-11 px-2 sm:min-h-0 sm:px-0 text-emerald-700 hover:text-emerald-800 hover:underline font-medium cursor-pointer"
                          title="Edit role"
                        >
                          {u.role}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {u.email ? (
                          <a
                            href={`mailto:${u.email}`}
                            className="text-emerald-700 hover:text-emerald-800 hover:underline"
                          >
                            {u.email}
                          </a>
                        ) : null}
                      </td>
                      {isSuperAdmin && (
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {/* A SuperAdmin cannot delete their own account */}
                          {u.username.toLowerCase() !== session.username.toLowerCase() && (
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteMessage(null);
                                setDeletingUser(u);
                              }}
                              className="inline-flex items-center min-h-11 px-2 sm:min-h-0 sm:px-0 text-rose-700 hover:text-rose-800 hover:underline font-medium cursor-pointer"
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      <div className="max-w-xs mx-auto space-y-2">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                          <UsersIcon className="w-5 h-5" />
                        </div>
                        <p className="text-sm font-semibold text-slate-800">No matching users</p>
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
      {isSuperAdmin && deletingUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="deleteUserTitle"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-4 sm:p-6 break-words text-slate-900 max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <h3 id="deleteUserTitle" className="font-bold text-base mb-2">
              Are you sure you want to delete this user?
            </h3>
            <p className="text-sm text-slate-600">
              Doing so will remove the user and their donation ledgers and donations records, and the
              non profit they administer (if any) with its donation ledgers and donations records.
            </p>
            <p className="mt-3 text-sm font-semibold">
              {deletingUser.first_name} {deletingUser.last_name}
              <span className="font-normal text-slate-500"> ({deletingUser.username})</span>
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

      {/* Role editor popup, centered on screen */}
      {editingUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="roleDialogTitle"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-4 sm:p-6 break-words text-slate-900 max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <h3 id="roleDialogTitle" className="font-bold text-base mb-4">
              Edit User Role
            </h3>

            <div className="space-y-2.5 text-sm mb-5">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Username</span>
                <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{editingUser.username}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">First Name</span>
                <span className="font-semibold text-slate-800">{editingUser.first_name}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Last Name</span>
                <span className="font-semibold text-slate-800">{editingUser.last_name}</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="roleSelect" className="text-sm font-medium text-slate-700">
                Role
              </label>
              <select
                id="roleSelect"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
              >
                {roleChoices.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            {modalError && (
              <p role="alert" className="mt-3 text-sm font-semibold text-red-600">
                {modalError}
              </p>
            )}

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleRoleSubmit}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-lg shadow-emerald-950/50 transition-all disabled:opacity-60 cursor-pointer"
              >
                {isSaving ? 'Saving...' : 'Submit'}
              </button>
              <button
                type="button"
                onClick={closeRoleEditor}
                disabled={isSaving}
                className="min-h-11 sm:min-h-0 px-3.5 py-2 text-sm font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 hover:border-rose-300 transition-colors disabled:opacity-60 cursor-pointer"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
