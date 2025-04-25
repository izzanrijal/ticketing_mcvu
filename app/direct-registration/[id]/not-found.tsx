import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function NotFound() {
  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <Alert variant="destructive" className="mb-4">
        <AlertTitle>Not Found</AlertTitle>
        <AlertDescription>The registration you are looking for could not be found.</AlertDescription>
      </Alert>

      <div className="flex justify-center mt-8">
        <Link href="/check-status">
          <Button>Return to Check Status</Button>
        </Link>
      </div>
    </div>
  )
}
