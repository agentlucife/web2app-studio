import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { BuilderClient } from "./builder-client";

export const dynamic = "force-dynamic";

export default function BuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-10 w-72" />
          <div className="grid gap-6 lg:grid-cols-3">
            <Skeleton className="h-[32rem] lg:col-span-2" />
            <Skeleton className="h-[32rem]" />
          </div>
        </div>
      }
    >
      <BuilderClient />
    </Suspense>
  );
}
