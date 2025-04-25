import { DashboardLayout } from "@/components/admin/dashboard-layout"
import { Skeleton } from "@/components/ui/skeleton"

export default function PromotionsLoading() {
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-[500px] w-full" />
      </div>
    </DashboardLayout>
  )
}
