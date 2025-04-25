"use client"

import { useState, useEffect } from "react"
import { getErrorLogs, clearErrorLogs } from "@/lib/error-logger"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

export function ErrorLogs() {
  const [logs, setLogs] = useState<any[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    // Initial load
    setLogs(getErrorLogs())

    // Set up interval to refresh logs
    const interval = setInterval(() => {
      setLogs(getErrorLogs())
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  const handleClearLogs = () => {
    clearErrorLogs()
    setLogs([])
  }

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  const getLevelBadge = (level: string) => {
    switch (level) {
      case "info":
        return <Badge variant="outline">Info</Badge>
      case "warning":
        return <Badge variant="secondary">Warning</Badge>
      case "error":
        return <Badge variant="destructive">Error</Badge>
      case "critical":
        return <Badge className="bg-red-700 text-white">Critical</Badge>
      default:
        return <Badge variant="outline">{level}</Badge>
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Error Logs</span>
          <Button variant="outline" size="sm" onClick={handleClearLogs}>
            Clear
          </Button>
        </CardTitle>
        <CardDescription>Real-time error logs from the application</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No errors logged</div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="border rounded-md p-3 hover:bg-muted/50 cursor-pointer"
                  onClick={() => toggleExpand(log.id)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {getLevelBadge(log.level)}
                        <span>{log.message}</span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">Source: {log.source}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">{formatTime(log.timestamp)}</div>
                  </div>

                  {expanded[log.id] && (
                    <div className="mt-3 pt-3 border-t text-sm">
                      {log.context && (
                        <div className="mb-2">
                          <div className="font-medium mb-1">Context:</div>
                          <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                            {JSON.stringify(log.context, null, 2)}
                          </pre>
                        </div>
                      )}

                      {log.stack && (
                        <div>
                          <div className="font-medium mb-1">Stack Trace:</div>
                          <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">{log.stack}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
