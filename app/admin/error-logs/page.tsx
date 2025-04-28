import { ErrorLogs } from "@/components/admin/error-logs"
import { AdminDashboardLayout } from "@/components/admin/dashboard-layout"

export default function ErrorLogsPage() {
  return (
    <AdminDashboardLayout user={{}}>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Error Logs</h1>
          <p className="text-muted-foreground">Monitor and diagnose application errors in real-time</p>
        </div>

        <ErrorLogs />
      </div>
    </AdminDashboardLayout>
  )
}
