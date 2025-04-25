import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Skeleton className="h-10 w-full md:w-[250px]" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-full md:w-[180px]" />
          <Skeleton className="h-10 w-10" />
        </div>
      </div>
      <div className="rounded-md border">
        <div className="h-[400px] animate-pulse bg-muted"></div>
      </div>
    </div>
  )
}
