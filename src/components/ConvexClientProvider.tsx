import { ReactNode } from 'react';
import { ConvexReactClient, ConvexProvider } from 'convex/react';
import RuntimeBootstrapScreen from './RuntimeBootstrapScreen';
import { runtimeConfig } from '../runtimeConfig';
// import { ConvexProviderWithClerk } from 'convex/react-clerk';
// import { ClerkProvider, useAuth } from '@clerk/clerk-react';

const convex = runtimeConfig.convexUrl
  ? new ConvexReactClient(runtimeConfig.convexUrl, { unsavedChangesWarning: false })
  : null;

export default function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) {
    return <RuntimeBootstrapScreen />;
  }

  return (
    // <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string}>
    // <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
    <ConvexProvider client={convex}>{children}</ConvexProvider>
    // </ConvexProviderWithClerk>
    // </ClerkProvider>
  );
}
