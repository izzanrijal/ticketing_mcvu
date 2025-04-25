import { Loader2 } from "lucide-react"

export default function Loading() {
  return (
    <div className="container max-w-4xl py-10">
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg">Memuat data registrasi...</p>
      </div>
    </div>
  )
}
