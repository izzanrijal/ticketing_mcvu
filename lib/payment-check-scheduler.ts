/**
 * Payment Check Scheduler
 * This module schedules payment checks for registrations
 */

import { supabaseAdmin } from "@/lib/supabase"
import { checkPaymentForRegistration } from "@/lib/payment-processor"

// Use the pre-configured Supabase admin client
const supabase = supabaseAdmin

// Schedule a payment check for a registration
export async function schedulePaymentCheck(registrationId: string) {
  try {
    // Create a scheduled task in the database
    const { data, error } = await supabase
      .from("scheduled_tasks")
      .insert({
        task_type: "payment_check",
        registration_id: registrationId,
        scheduled_at: new Date(Date.now() + 1 * 60 * 1000).toISOString(), // 1 minutes from now
        status: "pending",
      })
      .select()
      .single()

    if (error) throw error

    console.log(`Scheduled payment check for registration ${registrationId} in 1 minutes`)
    return {
      success: true,
      task_id: data.id,
      registration_id: registrationId,
      scheduled_at: data.scheduled_at,
    }
  } catch (error) {
    console.error(`Error scheduling payment check for registration ${registrationId}:`, error)
    return {
      success: false,
      registration_id: registrationId,
      message: `Error: ${error.message}`,
    }
  }
}

// Process scheduled payment checks
export async function processScheduledPaymentChecks() {
  try {
    // Get tasks that are due
    const now = new Date().toISOString()
    const { data: tasks, error } = await supabase
      .from("scheduled_tasks")
      .select("*")
      .eq("task_type", "payment_check")
      .eq("status", "pending")
      .lte("scheduled_at", now)
      .order("scheduled_at", { ascending: true })
      .limit(50) // Process in batches

    if (error) throw error

    if (!tasks || tasks.length === 0) {
      return {
        success: true,
        message: "No scheduled payment checks to process",
      }
    }

    // Process each task
    const results = await Promise.all(
      tasks.map(async (task) => {
        try {
          // Mark task as processing
          await supabase
            .from("scheduled_tasks")
            .update({
              status: "processing",
              started_at: now,
            })
            .eq("id", task.id)

          // Check payment for this registration
          const result = await checkPaymentForRegistration(task.registration_id)

          // Update task status
          const taskUpdate: any = {
            status: "completed",
            completed_at: new Date().toISOString(),
            result: result,
          }

          // If we should continue checking, schedule the next check
          if (result.continue_checking) {
            // Schedule next check in 5 minutes
            await schedulePaymentCheck(task.registration_id)
            taskUpdate.notes = "Scheduled next check"
          }

          await supabase.from("scheduled_tasks").update(taskUpdate).eq("id", task.id)

          return {
            success: true,
            task_id: task.id,
            registration_id: task.registration_id,
            result,
          }
        } catch (error) {
          console.error(`Error processing task ${task.id}:`, error)

          // Mark task as failed
          await supabase
            .from("scheduled_tasks")
            .update({
              status: "failed",
              completed_at: new Date().toISOString(),
              result: { error: error.message },
            })
            .eq("id", task.id)

          // Schedule next check despite error
          await schedulePaymentCheck(task.registration_id)

          return {
            success: false,
            task_id: task.id,
            registration_id: task.registration_id,
            message: `Error: ${error.message}`,
          }
        }
      }),
    )

    return {
      success: true,
      processed: results.length,
      results,
    }
  } catch (error) {
    console.error("Error processing scheduled payment checks:", error)
    return {
      success: false,
      message: `Error processing scheduled payment checks: ${error.message}`,
    }
  }
}
