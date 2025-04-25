"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Input } from "@/components/ui/input"

interface RegistrationNumberInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  required?: boolean
  id?: string
  name?: string
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
}

export function RegistrationNumberInput({
  value,
  onChange,
  placeholder = "12345678",
  className,
  disabled,
  required,
  id,
  name,
  onKeyDown,
  ...props
}: RegistrationNumberInputProps) {
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Format the input to ensure it has the MCVU- prefix
  const formatInput = (input: string) => {
    // If input is empty, return empty
    if (!input) return ""

    // If input already has the prefix, return as is
    if (input.startsWith("MCVU-")) return input

    // If input is just numbers, add the prefix
    const numericPart = input.replace(/\D/g, "")
    if (numericPart) {
      return `MCVU-${numericPart}`
    }

    // Otherwise return as is
    return input
  }

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)
  }

  // Handle blur to format the input
  const handleBlur = () => {
    setIsFocused(false)
    onChange(formatInput(value))
  }

  // Handle focus
  const handleFocus = () => {
    setIsFocused(true)
  }

  return (
    <Input
      ref={inputRef}
      type="text"
      value={value}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={isFocused ? "" : placeholder}
      className={className}
      disabled={disabled}
      required={required}
      id={id}
      name={name}
      onKeyDown={onKeyDown}
      {...props}
    />
  )
}
