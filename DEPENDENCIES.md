# Dependency Management Documentation

## Versi Komponen

### shadcn/ui
Proyek ini menggunakan shadcn/ui versi `0.5.0` sebagai CLI tool untuk menginstal komponen UI.

### Radix UI
Berikut adalah versi eksak dari komponen Radix UI yang digunakan:

| Komponen | Versi |
|----------|-------|
| @radix-ui/react-checkbox | 1.0.4 |
| @radix-ui/react-dialog | 1.0.5 |
| @radix-ui/react-dropdown-menu | 2.0.6 |
| @radix-ui/react-label | 2.0.2 |
| @radix-ui/react-radio-group | 1.1.3 |
| @radix-ui/react-scroll-area | 1.0.5 |
| @radix-ui/react-select | 2.0.0 |
| @radix-ui/react-separator | 1.0.3 |
| @radix-ui/react-slot | 1.0.2 |
| @radix-ui/react-tabs | 1.0.4 |

### Form Libraries
| Library | Versi |
|---------|-------|
| react-hook-form | 7.49.3 |
| @hookform/resolvers | 3.3.4 |
| zod | 3.22.4 |

## Praktik Terbaik untuk Manajemen Dependensi

1. **Gunakan Versi Eksak**: Semua dependensi Radix UI menggunakan versi eksak (tanpa ^ atau ~) untuk menghindari update otomatis yang dapat menyebabkan inkonsistensi.

2. **Commit Lockfile**: Selalu commit `package-lock.json` ke repositori untuk memastikan semua developer menggunakan versi yang sama persis dari semua dependensi.

3. **Update Bersamaan**: Gunakan script `npm run update-shadcn` untuk mengupdate semua komponen shadcn/ui secara bersamaan.

4. **Verifikasi Setelah Update**: Setelah mengupdate dependensi, selalu verifikasi bahwa semua komponen masih berfungsi dengan benar.

## Cara Mengupdate Komponen

Untuk mengupdate semua komponen shadcn/ui secara bersamaan:

\`\`\`bash
npm run update-shadcn
\`\`\`

Script ini akan mengupdate semua komponen shadcn/ui dan memastikan versi Radix UI tetap konsisten.

## Troubleshooting

Jika terjadi masalah dengan komponen setelah update:

1. Periksa konsol browser untuk error
2. Verifikasi bahwa semua komponen Radix UI menggunakan versi yang sama
3. Reinstall komponen yang bermasalah dengan `npx shadcn add [component-name] --overwrite`
4. Jika masalah berlanjut, hapus `node_modules` dan `package-lock.json`, lalu jalankan `npm install`
