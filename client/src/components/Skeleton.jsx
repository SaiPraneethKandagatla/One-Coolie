/* ============================================================
   SKELETON COMPONENT — Restrained Monochromatic Shimmer
   ============================================================ */

import TrainLoader from './TrainLoader';

export default function Skeleton({ className = '' }) {
  return (
    <div
      className={`animate-pulse bg-zinc-100 dark:bg-zinc-800 rounded-lg ${className}`}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

export function BookingSkeleton() {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-6 shadow-2xs">
      <TrainLoader fullScreen={false} size="sm" text="Loading Trip Records..." subtext="" />
    </div>
  );
}

export { TrainLoader };