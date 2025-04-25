// Error logger utility
type ErrorLogLevel = "info" | "warning" | "error" | "critical"

interface ErrorLogEntry {
  id: string
  timestamp: string
  level: ErrorLogLevel
  message: string
  source: string
  stack?: string
  context?: Record<string, any>
}

// In-memory storage for logs (will be cleared on page refresh)
let errorLogs: ErrorLogEntry[] = []

export function logError(
  message: string,
  source: string,
  level: ErrorLogLevel = "error",
  error?: Error,
  context?: Record<string, any>,
) {
  const entry: ErrorLogEntry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    level,
    message,
    source,
    stack: error?.stack,
    context,
  }

  errorLogs.unshift(entry) // Add to beginning of array

  // Keep only the last 100 logs
  if (errorLogs.length > 100) {
    errorLogs = errorLogs.slice(0, 100)
  }

  // Also log to console for development
  console.error(`[${level.toUpperCase()}] ${source}: ${message}`, error || "", context || "")

  return entry.id
}

export function getErrorLogs() {
  return [...errorLogs]
}

export function clearErrorLogs() {
  errorLogs = []
}

function generateId() {
  return Math.random().toString(36).substring(2, 15)
}
