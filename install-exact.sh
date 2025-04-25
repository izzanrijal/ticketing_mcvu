#!/bin/bash
# Script untuk menginstal dependensi dengan versi eksak

echo "=== Menginstal dependensi dengan versi eksak ==="

# Pastikan npm menggunakan versi eksak secara default
npm config set save-exact true

# Instal ulang semua dependensi Radix UI dengan versi eksak
npm install \
  @radix-ui/react-checkbox@1.0.4 \
  @radix-ui/react-dialog@1.0.5 \
  @radix-ui/react-dropdown-menu@2.0.6 \
  @radix-ui/react-label@2.0.2 \
  @radix-ui/react-radio-group@1.1.3 \
  @radix-ui/react-scroll-area@1.0.5 \
  @radix-ui/react-select@2.0.0 \
  @radix-ui/react-separator@1.0.3 \
  @radix-ui/react-slot@1.0.2 \
  @radix-ui/react-tabs@1.0.4 \
  react-hook-form@7.49.3 \
  @hookform/resolvers@3.3.4 \
  zod@3.22.4

# Instal shadcn/ui CLI
npm install -D @shadcn/ui@0.5.0

# Kembalikan konfigurasi npm ke default
npm config set save-exact false

echo "=== Instalasi selesai ==="
echo "Pastikan untuk commit package-lock.json ke repositori!"
