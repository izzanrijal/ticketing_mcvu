import { DashboardLayout } from "@/components/admin/dashboard-layout"
import { RegistrationTroubleshooter } from "@/components/admin/registration-troubleshooter"

export default function RegistrationTroubleshooterPage() {
  return (
    <DashboardLayout>
      <div className="container py-10">
        <RegistrationTroubleshooter />
      </div>
    </DashboardLayout>
  )
}
