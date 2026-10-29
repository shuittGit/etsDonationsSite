import React, { useState } from 'react';
import { Lock, Eye, EyeOff, User, KeyRound, ArrowRight } from 'lucide-react';
import logo from '../img/ets_ai_consulting_logo.gif';
import { DonationRecord, UserSession } from '../types';
import { authenticateUser } from '../data/donationsData';
import { loginUser } from '../data/usersData';

interface LoginPageProps {
  donations: DonationRecord[];
  onLoginSuccess: (session: UserSession) => void;
  onCreateAccount: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ donations, onLoginSuccess, onCreateAccount }) => {
  const [username, setUserName] = useState('');
  const [pin, setPin] = useState<number | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    // No PIN entered: nothing to look up
    if (pin === null) {
      setErrorMessage('Incorrect Login, Please try again!');
      return;
    }
    const pinValue: number = pin;
    setIsSubmitting(true);

    // Simulate standard authentication delay for security verification feel
    setTimeout(async () => {
      // 1. Query the Users table with the username and PIN
      const dbUser = await loginUser(username.trim(), pinValue);

      if (dbUser) {
        // Matching record: go to the donations page
        onLoginSuccess({
          username: dbUser.username,
          name: `${dbUser.first_name} ${dbUser.last_name}`.trim(),
          isAdmin: false,
          loginTime: new Date().toISOString(),
          role: dbUser.role,
          pin: pinValue,
          id: dbUser.id,
          hasNonProfit: dbUser.has_non_profit,
        });
      } else {
        // 2. Fall back to the built-in CSV demo accounts (admin, johnsond, ...)
        const result = authenticateUser(username, String(pinValue), donations);
        if (result.success && result.session) {
          onLoginSuccess(result.session);
        } else {
          setErrorMessage('Incorrect Login, Please try again!');
        }
      }
      setIsSubmitting(false);
    }, 180);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-white">
      {/* Top security header bar */}
      <header className="border-b border-slate-800/80 px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-3">
          {/* Same 32x32 box the shield icon used; object-contain keeps the logo's proportions */}
          <img
            src={logo}
            alt="ETS AI Consulting"
            title="ETS AI Consulting"
            width={32}
            height={32}
            className="w-8 h-8 shrink-0 rounded-lg object-contain"
          />
          <div>
            <span className="text-base font-bold tracking-tight text-white block">
              ETS Donations Records Portal
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>TLS 1.3 · 256-Bit Ledger Verification</span>
        </div>
      </header>

      {/* Main Login Card Area */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Card Container */}
          <div className="bg-slate-800/90 backdrop-blur border border-slate-700/80 rounded-2xl p-8 shadow-2xl">
            {/* Header / Brand Icon */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-emerald-400 mb-4 shadow-inner">
                <Lock className="w-7 h-7" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
                Secure Portal Authentication
              </h1>
              <p className="text-sm text-slate-400 leading-relaxed">
                Enter your assigned User Name, and 4-digit PIN to access donation records.
              </p>
            </div>

            {/* Error Message display */}
            {errorMessage && (
              <div
                role="alert"
                aria-live="polite"
                className="mb-6 p-3.5 bg-red-950/60 border border-red-500/40 rounded-xl flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200"
              >
                <div className="w-2 h-2 rounded-full bg-red-500 shrink-0"></div>
                <p className="text-red-500 font-semibold text-sm leading-tight">
                  {errorMessage}
                </p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* UserId field */}
              <div>
                <label
                  htmlFor="username"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2"
                >
                  User Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required
                    value={username}
                    onChange={(e) => {
                      setUserName(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="e.g. johnsond or admin"
                    className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              {/* 4-digit PIN field */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="pin"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
                  >
                    4-Digit PIN
                  </label>
                  <span className="text-[11px] font-mono text-slate-400">
                    4 numerical digits
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    id="pin"
                    name="pin"
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]{4}"
                    maxLength={4}
                    required
                    value={pin ?? ''}
                    onChange={(e) => {
                      // Keep only digits, store the PIN as a number (null when empty)
                      const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
                      setPin(digits === '' ? null : parseInt(digits, 10));
                      if (errorMessage) setErrorMessage('');
                    }}
                    placeholder="••••"
                    className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-10 pr-11 py-2.5 text-sm text-white font-mono tracking-widest placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                    aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-950/50 hover:shadow-emerald-900/50 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-60 cursor-pointer"
              >
                <span>{isSubmitting ? 'Authenticating...' : 'Sign In to Portal'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Create New Account link */}
            <div className="mt-6 text-center">
              <a
                href="#users"
                onClick={(e) => {
                  e.preventDefault();
                  onCreateAccount();
                }}
                className="text-sm font-medium text-emerald-400 hover:text-emerald-300 hover:underline transition-colors cursor-pointer"
              >
                Create New Account
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 px-6 py-4 text-center text-xs text-slate-500">
        <p>ETS Donations Records Portal · Powered by Secure CSV Ledger Verification</p>
      </footer>
    </div>
  );
};
