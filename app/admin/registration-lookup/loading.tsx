import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function RegistrationLookupLoading() {
  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Registration Lookup Diagnostic</h1>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Lookup Registration</CardTitle>
          <CardDescription>Enter a registration number to test different lookup methods</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-24" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lookup Results</CardTitle>
          <CardDescription>Results from different lookup methods</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold mb-2">Input Information</h3>
            <div className="space-y-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          </div>

          <Skeleton className="h-px w-full" />

          <div>
            <h3 className="font-semibold mb-2">Direct Lookup</h3>
            <div className="space-y-2">
              <Skeleton className="h-24 w-full" />
            </div>
          </div>

          <Skeleton className="h-px w-full" />

          <div>
            <h3 className="font-semibold mb-2">Flexible Lookup</h3>
            <div className="space-y-2">
              <Skeleton className="h-24 w-full" />
            </div>
          </div>

          <Skeleton className="h-px w-full" />

          <div>
            <h3 className="font-semibold mb-2">Raw Results</h3>
            <Skeleton className="h-64 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
