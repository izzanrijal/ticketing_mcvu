const { execSync } = require("child_process")
const fs = require("fs")
const path = require("path")

// Daftar komponen shadcn/ui yang digunakan dalam proyek
const components = [
  "form",
  "checkbox",
  "radio-group",
  "card",
  "select",
  "tabs",
  "input",
  "textarea",
  "badge",
  "separator",
  "scroll-area",
  "button",
  "dialog",
  "dropdown-menu",
  "label",
  "alert",
]

console.log("=== Memulai update komponen shadcn/ui ===")

// 1. Update CLI shadcn/ui
console.log("Updating shadcn/ui CLI...")
try {
  execSync("npm install -D @shadcn/ui@latest", { stdio: "inherit" })
} catch (error) {
  console.error("Error updating shadcn/ui CLI:", error)
  process.exit(1)
}

// 2. Update semua komponen
console.log("Updating all components...")
components.forEach((component) => {
  try {
    console.log(`Updating ${component}...`)
    execSync(`npx shadcn add ${component} --overwrite`, { stdio: "inherit" })
  } catch (error) {
    console.error(`Error updating component ${component}:`, error)
  }
})

// 3. Baca package.json untuk mendapatkan versi Radix UI
console.log("Updating package.json with exact versions...")
const packageJsonPath = path.join(process.cwd(), "package.json")
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))

// 4. Pastikan semua dependensi Radix UI menggunakan versi eksak
const dependencies = packageJson.dependencies
let updated = false

Object.keys(dependencies).forEach((dep) => {
  if (dep.startsWith("@radix-ui/")) {
    const version = dependencies[dep]
    if (version.startsWith("^") || version.startsWith("~")) {
      dependencies[dep] = version.substring(1)
      updated = true
    }
  }
})

// Juga pastikan react-hook-form, zod, dan resolvers menggunakan versi eksak
const formLibraries = ["react-hook-form", "@hookform/resolvers", "zod"]
formLibraries.forEach((lib) => {
  if (dependencies[lib] && (dependencies[lib].startsWith("^") || dependencies[lib].startsWith("~"))) {
    dependencies[lib] = dependencies[lib].substring(1)
    updated = true
  }
})

// 5. Tulis kembali package.json jika ada perubahan
if (updated) {
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
  console.log("package.json updated with exact versions.")
}

// 6. Update DEPENDENCIES.md dengan versi terbaru
console.log("Updating DEPENDENCIES.md...")
const dependenciesMdPath = path.join(process.cwd(), "DEPENDENCIES.md")
const radixDeps = Object.keys(dependencies)
  .filter((dep) => dep.startsWith("@radix-ui/"))
  .map((dep) => `| ${dep} | ${dependencies[dep]} |`)
  .join("\n")

const formDeps = formLibraries
  .filter((lib) => dependencies[lib])
  .map((lib) => `| ${lib} | ${dependencies[lib]} |`)
  .join("\n")

const shadcnVersion = packageJson.devDependencies["@shadcn/ui"] || "latest"

const dependenciesMd = `# Dependency Management Documentation

## Versi Komponen

### shadcn/ui
Proyek ini menggunakan shadcn/ui versi \`${shadcnVersion}\` sebagai CLI tool untuk menginstal komponen UI.

### Radix UI
Berikut adalah versi eksak dari komponen Radix UI yang digunakan:

| Komponen | Versi |
|----------|-------|
${radixDeps}

### Form Libraries
| Library | Versi |
|---------|-------|
${formDeps}

## Praktik Terbaik untuk Manajemen Dependensi

1. **Gunakan Versi Eksak**: Semua dependensi Radix UI menggunakan versi eksak (tanpa ^ atau ~) untuk menghindari update otomatis yang dapat menyebabkan inkonsistensi.

2. **Commit Lockfile**: Selalu commit \`package-lock.json\` ke repositori untuk memastikan semua developer menggunakan versi yang sama persis dari semua dependensi.

3. **Update Bersamaan**: Gunakan script \`npm run update-shadcn\` untuk mengupdate semua komponen shadcn/ui secara bersamaan.

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
3. Reinstall komponen yang bermasalah dengan \`npx shadcn add [component-name] --overwrite\`
4. Jika masalah berlanjut, hapus \`node_modules\` dan \`package-lock.json\`, lalu jalankan \`npm install\`
`

fs.writeFileSync(dependenciesMdPath, dependenciesMd)

// 7. Reinstall untuk memastikan package-lock.json diperbarui
console.log("Reinstalling dependencies to update package-lock.json...")
try {
  execSync("npm install", { stdio: "inherit" })
} catch (error) {
  console.error("Error reinstalling dependencies:", error)
}

console.log("=== Update komponen shadcn/ui selesai ===")
console.log("Pastikan untuk commit package-lock.json ke repositori!")
