import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function NotFound() {
  return (
    <div className="container mx-auto py-10">
      <Alert variant="destructive">
        <AlertTitle>Not Found</AlertTitle>
        <AlertDescription>The registration you are looking for could not be found.</AlertDescription>
      </Alert>
      <div className="mt-4">
        <Button asChild>
          <Link href="/check-status">Back to Check Status</Link>
        </Button>
      </div>
    </div>
  )
}
