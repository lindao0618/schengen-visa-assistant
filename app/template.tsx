// app/template.tsx
'use client' // SessionProvider needs to be in a client component

import { SessionProvider } from "next-auth/react";
import React from "react"; // Import React if not already

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    // SessionProvider should wrap the content that needs access to session state
    <SessionProvider>
      <div className="flex flex-col min-h-screen bg-gradient-to-br from-white via-gray-50 to-gray-100">
        {children}
      </div>
    </SessionProvider>
  );
}
