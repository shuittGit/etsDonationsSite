import React from 'react';
import { LogOut } from 'lucide-react';
import { UserSession } from '../types';
import logo from '../img/ets_ai_consulting_logo.gif';

interface TopBarProps {
  session: UserSession;
  onLogout: () => void;
}

/** The portal name and logo, shown at the left of every top bar. */
const Wordmark: React.FC = () => (
  <div className="flex items-center gap-3 min-w-0">
    <a
      href="#top"
      className="text-base sm:text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2 min-w-0"
    >
      {/* Same 32x32 box the shield icon used; object-contain keeps the logo's proportions */}
      <img
        src={logo}
        alt="ETS AI Consulting"
        title="ETS AI Consulting"
        width={32}
        height={32}
        className="w-8 h-8 shrink-0 rounded-lg object-contain"
      />
      {/* the short name on phones, the full name from 640px up; truncate is a safety net */}
      <span className="truncate sm:hidden">ETS Donations</span>
      <span className="truncate hidden sm:inline">ETS Donations Records Portal</span>
    </a>
  </div>
);

/**
 * The top bar for pages shown before anyone has signed in (such as New User): the same bar, with
 * just the portal name, since there is no user or Log Out to show yet.
 */
export const SignedOutTopBar: React.FC = () => (
  <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <Wordmark />
    </div>
  </header>
);

export const TopBar: React.FC<TopBarProps> = ({ session, onLogout }) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Zone 1: Single text element wordmark */}
        <Wordmark />

        {/* Zone 2: User indicator + Primary Log Out action */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600 border-r border-slate-200 pr-3">
            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-[11px]">
              {session.isAdmin ? 'AD' : session.name.charAt(0)}
            </div>
            <span className="font-medium text-slate-800">{session.name}</span>
          </div>

          <button
            onClick={onLogout}
            className="min-h-11 sm:min-h-0 flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 hover:border-rose-300 transition-colors whitespace-nowrap cursor-pointer"
            title="Log Out of current session"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Out</span>
          </button>
        </div>
      </div>
    </header>
  );
};
