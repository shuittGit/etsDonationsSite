import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface WelcomeUserProps {
  /** The user's name, used to greet them. */
  name?: string;
  /**
   * 'created': right after the account was created (a thank-you).
   * 'pending': a later sign-in while the account is still awaiting approval.
   */
  variant?: 'created' | 'pending';
}

// Shown to an account that is waiting for the Admin's approval.
export const WelcomeUser: React.FC<WelcomeUserProps> = ({ name, variant = 'created' }) => {
  return (
    // Centered both ways in the space under the 4rem (h-16) top bar
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 text-slate-900 px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-xl shadow-xs p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto text-emerald-600 mb-4">
          <CheckCircle2 className="w-6 h-6" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight mb-3">
          {name ? `Welcome, ${name}!` : 'Welcome!'}
        </h1>

        <p className="text-sm text-slate-600 leading-relaxed">
          {variant === 'pending'
            ? 'We are still working on providing you access and will let you know once that is completed.'
            : 'Thank you for creating your account. You will be able to access the site fully once the Admin has approved your request.'}
        </p>
      </div>
    </div>
  );
};
