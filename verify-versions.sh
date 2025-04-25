#!/bin/bash
# Script untuk memverifikasi versi dependencies

echo "=== Memeriksa versi dependencies Radix UI ==="
npm list @radix-ui/react-checkbox @radix-ui/react-label @radix-ui/react-radio-group @radix-ui/react-slot

echo "=== Memeriksa versi React dan Next.js ==="
npm list react next

echo "=== Memeriksa versi React Hook Form dan Zod ==="
npm list react-hook-form @hookform/resolvers zod
