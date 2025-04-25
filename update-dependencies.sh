#!/bin/bash
# Script untuk mengupdate dependencies dan reinstall komponen shadcn/ui

echo "=== Memulai proses update dependencies dan reinstall komponen ==="

# 1. Update semua dependencies ke versi terbaru
echo "Updating all dependencies..."
npm update

# 2. Update dependencies Radix UI secara spesifik ke versi terbaru
echo "Updating Radix UI dependencies..."
npm install @radix-ui/react-checkbox@latest @radix-ui/react-dialog@latest @radix-ui/react-dropdown-menu@latest @radix-ui/react-label@latest @radix-ui/react-radio-group@latest @radix-ui/react-scroll-area@latest @radix-ui/react-select@latest @radix-ui/react-separator@latest @radix-ui/react-slot@latest @radix-ui/react-tabs@latest

# 3. Update dependencies lain yang penting
echo "Updating other important dependencies..."
npm install react-hook-form@latest @hookform/resolvers@latest zod@latest

# 4. Install CLI shadcn/ui jika belum ada
echo "Installing shadcn/ui CLI..."
npm install -D @shadcn/ui

# 5. Reinstall komponen yang bermasalah
echo "Reinstalling shadcn/ui components..."
npx shadcn add form --overwrite
npx shadcn add checkbox --overwrite
npx shadcn add radio-group --overwrite
npx shadcn add card --overwrite
npx shadcn add select --overwrite
npx shadcn add tabs --overwrite
npx shadcn add input --overwrite
npx shadcn add textarea --overwrite
npx shadcn add badge --overwrite
npx shadcn add separator --overwrite
npx shadcn add scroll-area --overwrite

echo "=== Proses update dan reinstall selesai ==="
echo "Silakan restart server development dengan 'npm run dev'"
