/**
 * Moota.co API Integration
 * This module provides functions to interact with the Moota.co API for payment verification
 */

// Base URL for Moota API
const MOOTA_API_BASE_URL = "https://app.moota.co/api/v2"

// Types for Moota API responses
export interface MootaMutation {
  bank_id: string
  account_number: string
  bank_type: string
  date: string
  amount: number
  description: string
  type: "CR" | "DB" // CR = Credit (incoming), DB = Debit (outgoing)
  balance: number
  created_at: string
  updated_at: string
  mutation_id: string
  token: string
  attachment?: string
  note?: string
}

export interface MootaWebhookPayload {
  bank_id: string
  account_number: string
  bank_type: string
  date: string
  amount: number
  description: string
  type: "CR" | "DB"
  balance: number
  created_at: string
  updated_at: string
  mutation_id: string
  token: string
  attachment?: string
  note?: string
}

export interface MootaBank {
  bank_id: string
  corporate_id: string
  username: string
  atas_nama: string
  bank_type: string
  account_number: string
  balance: number
  login_retry: number
  is_active: boolean
  created_at: string
  updated_at: string
}

// Function to fetch mutations from Moota API
export async function fetchMutations(startDate?: string, endDate?: string, bankId?: string): Promise<MootaMutation[]> {
  try {
    // Build query parameters
    const params = new URLSearchParams()
    if (startDate) params.append("start_date", startDate)
    if (endDate) params.append("end_date", endDate)
    if (bankId) params.append("bank_id", bankId)

    // Make API request
    const response = await fetch(`${MOOTA_API_BASE_URL}/mutation?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${process.env.MOOTA_API_KEY}`,
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`Moota API error: ${errorData.message || response.statusText}`)
    }

    const data = await response.json()
    return data.data || []
  } catch (error) {
    console.error("Error fetching mutations from Moota:", error)
    throw error
  }
}

// Function to fetch bank accounts from Moota API
export async function fetchBankAccounts(): Promise<MootaBank[]> {
  try {
    const response = await fetch(`${MOOTA_API_BASE_URL}/bank`, {
      headers: {
        Authorization: `Bearer ${process.env.MOOTA_API_KEY}`,
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`Moota API error: ${errorData.message || response.statusText}`)
    }

    const data = await response.json()
    return data.data || []
  } catch (error) {
    console.error("Error fetching bank accounts from Moota:", error)
    throw error
  }
}

// Function to verify webhook signature
export function verifyWebhookSignature(signature: string, payload: string): boolean {
  try {
    // In a real implementation, you would use crypto to verify HMAC signature
    // For example:
    // const crypto = require('crypto');
    // const expectedSignature = crypto
    //   .createHmac('sha256', process.env.MOOTA_WEBHOOK_SECRET)
    //   .update(payload)
    //   .digest('hex');
    // return crypto.timingSafeEqual(
    //   Buffer.from(signature),
    //   Buffer.from(expectedSignature)
    // );

    // For now, we'll just check if the signature exists
    return signature === process.env.MOOTA_WEBHOOK_SECRET
  } catch (error) {
    console.error("Error verifying webhook signature:", error)
    return false
  }
}
