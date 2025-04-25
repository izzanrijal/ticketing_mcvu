import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function CheckStatusLoading() {
  return (
    <div className="container max-w-3xl py-10">
      <h1 className="text-3xl font-bold mb-6 text-center">Cek Status Pembayaran</h1>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Masukkan Nomor Pendaftaran</CardTitle>
          <CardDescription>Masukkan nomor pendaftaran yang Anda terima setelah melakukan registrasi</CardDescription>
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
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32 mb-3" />
            <Skeleton className="h-24 w-full rounded-md" />
          </div>

          <Skeleton className="h-px w-full my-4" />

          <div className="space-y-2">
            <Skeleton className="h-5 w-32 mb-3" />
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>

          <Skeleton className="h-px w-full my-4" />

          <div className="space-y-2">
            <Skeleton className="h-5 w-32 mb-3" />
            <div className="space-y-4">
              <Skeleton className="h-20 w-full rounded-md" />
              <Skeleton className="h-20 w-full rounded-md" />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-48" />
        </CardFooter>
      </Card>
    </div>
  )
}
