/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { DonationRecord, UserSession } from './types';
import { fetchDonations } from './data/donationsData';
import { LoginPage } from './components/LoginPage';
import { SignedOutTopBar, TopBar } from './components/TopBar';
import { NewUser } from './components/NewUser';
import { Users } from './components/Users';
import { NewNonProfit } from './components/NewNonProfit';
import { DonationsLedgers } from './components/DonationsLedgers';
import { DonationsList } from './components/DonationsList';
import { NewDonation } from './components/NewDonation';
import { NonProfits } from './components/NonProfits';
import { WelcomeUser } from './components/WelcomeUser';
import { loginUser } from './data/usersData';
import { ShieldCheck } from 'lucide-react';

type ActiveView =
  | 'users'
  | 'donationLedgers'
  | 'newDonation'
  | 'nonProfits'
  | 'newNonProfit'
  | 'donationsList'
  | 'welcomeUser'
  | 'pendingApproval';

const ACTIVE_VIEWS: ActiveView[] = [
  'users',
  'donationLedgers',
  'newDonation',
  'nonProfits',
  'newNonProfit',
  'donationsList',
  'welcomeUser',
  'pendingApproval',
];
// Roles of accounts that are still waiting for approval. 'Awaiting Approval' is the choice on the
// Users page; 'Admin Approval' is the role the Users table gives a new account.
const PENDING_ROLES = ['Awaiting Approval', 'Admin Approval'];
// The page shown when none is remembered (also what an old saved value falls back to)
const DEFAULT_VIEW: ActiveView = 'donationLedgers';
const ACTIVE_VIEW_KEY = 'donation_portal_view';

export default function App() {
  const [donations, setDonations] = useState<DonationRecord[]>([]);
  const [session, setSession] = useState<UserSession | null>(() => {
    try {
      const saved = sessionStorage.getItem('donation_portal_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  // The page being shown. It is kept in sessionStorage (like the session) so a refresh / reload
  // stays on the same page instead of falling back to the default one.
  const [activeView, setActiveView] = useState<ActiveView>(() => {
    try {
      const saved = sessionStorage.getItem(ACTIVE_VIEW_KEY);
      return ACTIVE_VIEWS.includes(saved as ActiveView) ? (saved as ActiveView) : DEFAULT_VIEW;
    } catch {
      return DEFAULT_VIEW;
    }
  });
  const [showNewUser, setShowNewUser] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.setItem(ACTIVE_VIEW_KEY, activeView);
    } catch {
      // ignore storage errors
    }
  }, [activeView]);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const records = await fetchDonations();
        setDonations(records);
      } catch (err) {
        console.error('Failed to load donations dataset:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const handleLoginSuccess = (newSession: UserSession) => {
    setActiveView(DEFAULT_VIEW); // the caller may choose a different landing page right after
    setSession(newSession);
    try {
      sessionStorage.setItem('donation_portal_session', JSON.stringify(newSession));
    } catch {
      // ignore storage errors
    }
  };

  const handleLogout = () => {
    setActiveView(DEFAULT_VIEW);
    setSession(null);
    try {
      sessionStorage.removeItem('donation_portal_session');
    } catch {
      // ignore storage errors
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-slate-100">
        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 animate-pulse">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <p className="text-sm font-medium text-slate-300">
          Loading donations ledger...
        </p>
      </div>
    );
  }

  // Not logged in: Show the Login Page asking for UserId and 4-digit PIN
  if (!session) {
    if (showNewUser) {
      return (
        <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
          <SignedOutTopBar />
          <main className="flex-1">
            <NewUser
              onCancel={() => setShowNewUser(false)}
              onCreated={async (user) => {
                // Sign the new user in with the details the database holds for them (id, role,
                // PIN) and show the Welcome page
                const name = `${user.first_name.trim()} ${user.last_name.trim()}`;
                const pin = Number(user.pin);
                const dbUser = await loginUser(user.username.trim(), pin);
                handleLoginSuccess(
                  dbUser
                    ? {
                        username: dbUser.username,
                        name: `${dbUser.first_name} ${dbUser.last_name}`.trim(),
                        isAdmin: false,
                        loginTime: new Date().toISOString(),
                        role: dbUser.role,
                        pin,
                        id: dbUser.id,
                        hasNonProfit: dbUser.has_non_profit,
                      }
                    : {
                        username: user.username.trim(),
                        name,
                        isAdmin: false,
                        loginTime: new Date().toISOString(),
                      }
                );
                // A new account lands on the Welcome page, which says the Admin still has to
                // approve the request
                setActiveView('welcomeUser');
                setShowNewUser(false);
              }}
            />
          </main>
        </div>
      );
    }
    return (
      <LoginPage
        donations={donations}
        onLoginSuccess={(newSession) => {
          handleLoginSuccess(newSession);
          // Signing in lands on the Donation Ledgers page (a Donor sees only the ledgers tied to
          // their own user id: Donation_Ledgers.user_id = Users.id), except accounts still waiting
          // for approval, who land on the Welcome page
          setActiveView(PENDING_ROLES.includes(newSession.role ?? '') ? 'pendingApproval' : 'donationLedgers');
        }}
        onCreateAccount={() => setShowNewUser(true)}
      />
    );
  }

  // An Admin (a user in the Users table whose id is not yet an admin_id in Non_Profit)
  // must set up their Non Profit before reaching the donations page. The user's id is
  // passed along for later use.
  if (session.role === 'Admin' && session.hasNonProfit === false) {
    return (
      <NewNonProfit
        session={session}
        adminUserId={session.id}
        onCreated={() => {
          const updated = { ...session, hasNonProfit: true };
          setActiveView('donationLedgers'); // then on to the Donation Ledgers page
          setSession(updated);
          try {
            sessionStorage.setItem('donation_portal_session', JSON.stringify(updated));
          } catch {
            // ignore storage errors
          }
        }}
        onCancel={handleLogout}
      />
    );
  }

  // Logged in: Show the TopBar and the current page
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopBar session={session} onLogout={handleLogout} />
      <main className="flex-1">
        {activeView === 'users' ? (
          <Users
            session={session}
            onNavigateToNonProfits={() => setActiveView('nonProfits')}
            onNavigateToDonationLedgers={() => setActiveView('donationLedgers')}
          />
        ) : activeView === 'welcomeUser' ? (
          <WelcomeUser name={session.name} variant="created" />
        ) : activeView === 'pendingApproval' ? (
          <WelcomeUser name={session.name} variant="pending" />
        ) : activeView === 'donationsList' ? (
          <DonationsList
            session={session}
            onNavigateToDonationLedgers={() => setActiveView('donationLedgers')}
          />
        ) : activeView === 'nonProfits' ? (
          <NonProfits
            session={session}
            onNavigateToUsers={() => setActiveView('users')}
            onNavigateToDonationLedgers={() => setActiveView('donationLedgers')}
            onCreateNonProfit={() => setActiveView('newNonProfit')}
          />
        ) : activeView === 'newNonProfit' ? (
          <NewNonProfit
            session={session}
            onCreated={() => setActiveView('nonProfits')}
            onCancel={() => setActiveView('nonProfits')}
            cancelLabel="Back to Non Profits"
          />
        ) : activeView === 'newDonation' ? (
          <NewDonation
            session={session}
            onBack={() => setActiveView('donationLedgers')}
            onCreated={() => setActiveView('donationLedgers')}
          />
        ) : (
          // 'donationLedgers', also the page shown when nothing else applies
          <DonationsLedgers
            session={session}
            onCreateDonation={() => setActiveView('newDonation')}
            onNavigateToDonationsList={() => setActiveView('donationsList')}
            onNavigateToUsers={() => setActiveView('users')}
            onNavigateToNonProfits={() => setActiveView('nonProfits')}
          />
        )}
      </main>
    </div>
  );
}
