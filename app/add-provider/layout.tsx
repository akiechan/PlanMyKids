'use client';

import ErrorBoundary from '@/components/ErrorBoundary';

export default function AddProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
