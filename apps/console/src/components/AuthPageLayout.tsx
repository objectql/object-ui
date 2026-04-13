/**
 * Shared layout for authentication pages (login, register, forgot password).
 * Provides a widescreen-optimized split-panel design with branding on the left
 * and form content on the right, inspired by enterprise platforms like Airtable and Salesforce.
 */

import type React from 'react';

export function AuthPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Left branding panel - hidden on mobile, shown on lg+ */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center bg-primary p-12">
        <div className="max-w-md space-y-6 text-primary-foreground">
          <div className="flex items-center gap-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-10 w-10"
              role="img"
              aria-label="ObjectStack logo"
            >
              <title>ObjectStack</title>
              <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
            </svg>
            <span className="text-2xl font-bold">ObjectStack</span>
          </div>
          <h2 className="text-3xl font-bold leading-tight">
            Build powerful business applications, faster.
          </h2>
          <p className="text-lg opacity-90">
            The universal platform for enterprise data management, workflows, and analytics.
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex w-full lg:w-1/2 items-center justify-center bg-background px-6 py-12">
        {children}
      </div>
    </div>
  );
}
