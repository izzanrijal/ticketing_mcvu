import Link from "next/link"
import { Mail, MapPin, Phone } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t bg-card text-card-foreground">
      <div className="container px-4 py-8 md:px-6 md:py-12">
        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-primary">MCVU (Makassar Cardiovascular Update) XXIII 2025</h3>
            <p className="text-sm text-muted-foreground">
            Emerging Paradigms in Acute Cardiovascular Care
            </p>
          </div>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-primary">Tautan</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="text-muted-foreground hover:text-foreground">
                  Beranda
                </Link>
              </li>
              <li>
                <Link href="#info" className="text-muted-foreground hover:text-foreground">
                  Tentang
                </Link>
              </li>
              <li>
                <Link href="#" className="text-muted-foreground hover:text-foreground">
                  Jadwal
                </Link>
              </li>
              <li>
                <Link href="#" className="text-muted-foreground hover:text-foreground">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-primary">Kontak</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4 text-primary" />
                <span>panitia.mcvu@perkimakassar.com</span>
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4 text-primary" />
                <span>+62-821-9061-5922</span>
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                <span>Jln. Letjen Hertasning No.33, Kec Panakukkang, Kota Makassar
                </span>
              </li>
            </ul>
          </div>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-primary">Pendaftaran</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/register" className="text-muted-foreground hover:text-foreground">
                  Daftar Sekarang
                </Link>
              </li>
              <li>
                <Link href="/check-status" className="text-muted-foreground hover:text-foreground">
                  Cek Status Pendaftaran
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
          <p>© 2025 MCVU Symposium. Hak Cipta Dilindungi.</p>
        </div>
      </div>
    </footer>
  )
}
