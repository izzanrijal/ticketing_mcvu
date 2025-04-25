"use client"

import { useState, useEffect } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Plus, Edit, Trash2, Tag, Calendar, Percent } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"

export function AdminPromotions() {
  const [promos, setPromos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedPromo, setSelectedPromo] = useState<any>(null)
  const [formData, setFormData] = useState({
    code: "",
    discount_type: "percentage", // percentage or fixed
    discount_value: 0,
    participant_type: "", // student, regular, corporate, or empty for all
    valid_from: "",
    valid_until: "",
    max_uses: null,
    is_active: true,
  })
  const supabase = createClientComponentClient()

  useEffect(() => {
    fetchPromos()
  }, [])

  async function fetchPromos() {
    try {
      setLoading(true)
      const { data, error } = await supabase.from("promo_codes").select("*").order("created_at", { ascending: false })

      if (error) throw error
      setPromos(data || [])
    } catch (error) {
      console.error("Error fetching promo codes:", error)
      toast({
        title: "Error",
        description: "Gagal mengambil data promo. Silakan coba lagi.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setFormData({
      code: "",
      discount_type: "percentage",
      discount_value: 0,
      participant_type: "",
      valid_from: "",
      valid_until: "",
      max_uses: null,
      is_active: true,
    })
  }

  function handleCreatePromo() {
    resetForm()
    setCreateDialogOpen(true)
  }

  function handleEditPromo(promo: any) {
    setFormData({
      code: promo.code || "",
      discount_type: promo.discount_type || "percentage",
      discount_value: promo.discount_value || 0,
      participant_type: promo.participant_type || "",
      valid_from: promo.valid_from ? new Date(promo.valid_from).toISOString().slice(0, 16) : "",
      valid_until: promo.valid_until ? new Date(promo.valid_until).toISOString().slice(0, 16) : "",
      max_uses: promo.max_uses,
      is_active: promo.is_active !== false,
    })
    setSelectedPromo(promo)
    setEditDialogOpen(true)
  }

  function handleDeletePromo(promo: any) {
    setSelectedPromo(promo)
    setDeleteDialogOpen(true)
  }

  async function createPromo() {
    try {
      setLoading(true)

      // Validate form
      if (!formData.code || !formData.discount_value) {
        toast({
          title: "Error",
          description: "Kode promo dan nilai diskon harus diisi.",
          variant: "destructive",
        })
        return
      }

      const { data, error } = await supabase
        .from("promo_codes")
        .insert({
          code: formData.code.toUpperCase(),
          discount_type: formData.discount_type,
          discount_value: formData.discount_value,
          participant_type: formData.participant_type || null,
          valid_from: formData.valid_from || null,
          valid_until: formData.valid_until || null,
          max_uses: formData.max_uses,
          used_count: 0,
          is_active: formData.is_active,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()

      if (error) throw error

      toast({
        title: "Berhasil",
        description: "Promo berhasil dibuat.",
      })

      setCreateDialogOpen(false)
      resetForm()
      fetchPromos()
    } catch (error: any) {
      console.error("Error creating promo:", error)
      toast({
        title: "Error",
        description: error.message || "Gagal membuat promo. Silakan coba lagi.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  async function updatePromo() {
    try {
      setLoading(true)

      // Validate form
      if (!formData.code || !formData.discount_value) {
        toast({
          title: "Error",
          description: "Kode promo dan nilai diskon harus diisi.",
          variant: "destructive",
        })
        return
      }

      const { error } = await supabase
        .from("promo_codes")
        .update({
          code: formData.code.toUpperCase(),
          discount_type: formData.discount_type,
          discount_value: formData.discount_value,
          participant_type: formData.participant_type || null,
          valid_from: formData.valid_from || null,
          valid_until: formData.valid_until || null,
          max_uses: formData.max_uses,
          is_active: formData.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedPromo.id)

      if (error) throw error

      toast({
        title: "Berhasil",
        description: "Promo berhasil diperbarui.",
      })

      setEditDialogOpen(false)
      resetForm()
      fetchPromos()
    } catch (error: any) {
      console.error("Error updating promo:", error)
      toast({
        title: "Error",
        description: error.message || "Gagal memperbarui promo. Silakan coba lagi.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  async function deletePromo() {
    try {
      setLoading(true)

      const { error } = await supabase.from("promo_codes").delete().eq("id", selectedPromo.id)

      if (error) throw error

      toast({
        title: "Berhasil",
        description: "Promo berhasil dihapus.",
      })

      setDeleteDialogOpen(false)
      fetchPromos()
    } catch (error: any) {
      console.error("Error deleting promo:", error)
      toast({
        title: "Error",
        description: error.message || "Gagal menghapus promo. Silakan coba lagi.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  function formatDiscount(promo: any) {
    if (promo.discount_type === "percentage") {
      return `${promo.discount_value}%`
    } else {
      return `Rp ${promo.discount_value.toLocaleString("id-ID")}`
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Manajemen Promo</h2>
        <Button onClick={handleCreatePromo}>
          <Plus className="mr-2 h-4 w-4" />
          Tambah Promo
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Promo</CardTitle>
          <CardDescription>Kelola kode promo dan diskon untuk pendaftaran MCVU 2025.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Diskon</TableHead>
                  <TableHead>Tipe Peserta</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Penggunaan</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(3)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7} className="h-12 animate-pulse bg-muted"></TableCell>
                    </TableRow>
                  ))
                ) : promos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      Tidak ada data promo
                    </TableCell>
                  </TableRow>
                ) : (
                  promos.map((promo) => (
                    <TableRow key={promo.id}>
                      <TableCell className="font-mono font-medium">{promo.code}</TableCell>
                      <TableCell>{formatDiscount(promo)}</TableCell>
                      <TableCell>
                        {promo.participant_type ? (
                          <Badge variant="outline">{promo.participant_type}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Semua tipe</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {promo.valid_from && promo.valid_until ? (
                          <span className="text-xs">
                            {new Date(promo.valid_from).toLocaleDateString("id-ID")} -{" "}
                            {new Date(promo.valid_until).toLocaleDateString("id-ID")}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Tidak dibatasi</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {promo.is_active ? (
                          <Badge variant="success">Aktif</Badge>
                        ) : (
                          <Badge variant="secondary">Nonaktif</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {promo.used_count || 0}
                        {promo.max_uses && <span className="text-xs text-muted-foreground">/{promo.max_uses}</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEditPromo(promo)}>
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeletePromo(promo)}>
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create Promo Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Promo Baru</DialogTitle>
            <DialogDescription>Buat kode promo baru untuk pendaftaran MCVU 2025.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">Kode Promo</Label>
              <div className="flex items-center space-x-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="MCVU2025"
                  className="uppercase"
                />
              </div>
              <p className="text-xs text-muted-foreground">Kode yang akan dimasukkan pengguna saat pendaftaran</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discount_type">Tipe Diskon</Label>
                <Select
                  value={formData.discount_type}
                  onValueChange={(value) => setFormData({ ...formData, discount_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih tipe diskon" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Persentase (%)</SelectItem>
                    <SelectItem value="fixed">Nominal Tetap (Rp)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount_value">Nilai Diskon</Label>
                <div className="flex items-center space-x-2">
                  <Percent className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="discount_value"
                    type="number"
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: Number.parseFloat(e.target.value) })}
                    placeholder={formData.discount_type === "percentage" ? "10" : "50000"}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {formData.discount_type === "percentage" ? "Persentase diskon (0-100)" : "Nilai diskon dalam Rupiah"}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="participant_type">Tipe Peserta</Label>
              <Select
                value={formData.participant_type}
                onValueChange={(value) => setFormData({ ...formData, participant_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Semua tipe peserta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua tipe peserta</SelectItem>
                  <SelectItem value="student">Mahasiswa</SelectItem>
                  <SelectItem value="regular">Umum</SelectItem>
                  <SelectItem value="corporate">Korporat</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Kosongkan untuk mengizinkan semua tipe peserta menggunakan promo ini
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valid_from">Tanggal Mulai</Label>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="valid_from"
                    type="datetime-local"
                    value={formData.valid_from}
                    onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="valid_until">Tanggal Berakhir</Label>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="valid_until"
                    type="datetime-local"
                    value={formData.valid_until}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_uses">Batas Penggunaan</Label>
              <Input
                id="max_uses"
                type="number"
                value={formData.max_uses || ""}
                onChange={(e) =>
                  setFormData({ ...formData, max_uses: e.target.value ? Number.parseInt(e.target.value) : null })
                }
                placeholder="Tidak terbatas"
                min={1}
              />
              <p className="text-xs text-muted-foreground">Kosongkan untuk penggunaan tidak terbatas</p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Aktif</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={createPromo} disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan Promo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Promo Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Promo</DialogTitle>
            <DialogDescription>Perbarui informasi promo untuk pendaftaran MCVU 2025.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-code">Kode Promo</Label>
              <div className="flex items-center space-x-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="edit-code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="MCVU2025"
                  className="uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-discount_type">Tipe Diskon</Label>
                <Select
                  value={formData.discount_type}
                  onValueChange={(value) => setFormData({ ...formData, discount_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih tipe diskon" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Persentase (%)</SelectItem>
                    <SelectItem value="fixed">Nominal Tetap (Rp)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-discount_value">Nilai Diskon</Label>
                <div className="flex items-center space-x-2">
                  <Percent className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="edit-discount_value"
                    type="number"
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: Number.parseFloat(e.target.value) })}
                    placeholder={formData.discount_type === "percentage" ? "10" : "50000"}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-participant_type">Tipe Peserta</Label>
              <Select
                value={formData.participant_type}
                onValueChange={(value) => setFormData({ ...formData, participant_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Semua tipe peserta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua tipe peserta</SelectItem>
                  <SelectItem value="student">Mahasiswa</SelectItem>
                  <SelectItem value="regular">Umum</SelectItem>
                  <SelectItem value="corporate">Korporat</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-valid_from">Tanggal Mulai</Label>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="edit-valid_from"
                    type="datetime-local"
                    value={formData.valid_from}
                    onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-valid_until">Tanggal Berakhir</Label>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="edit-valid_until"
                    type="datetime-local"
                    value={formData.valid_until}
                    onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-max_uses">Batas Penggunaan</Label>
              <Input
                id="edit-max_uses"
                type="number"
                value={formData.max_uses || ""}
                onChange={(e) =>
                  setFormData({ ...formData, max_uses: e.target.value ? Number.parseInt(e.target.value) : null })
                }
                placeholder="Tidak terbatas"
                min={1}
              />
            </div>

            <div className="space-y-2">
              <Label>Penggunaan Saat Ini</Label>
              <Input value={selectedPromo?.used_count || 0} disabled />
              <p className="text-xs text-muted-foreground">
                Jumlah penggunaan promo ini tidak dapat diubah secara manual
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="edit-is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="edit-is_active">Aktif</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={updatePromo} disabled={loading}>
              {loading ? "Menyimpan..." : "Perbarui Promo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Promo Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Promo</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus promo ini? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <div className="font-medium">
                Kode Promo: <span className="font-mono">{selectedPromo?.code}</span>
              </div>
              <div>Diskon: {selectedPromo && formatDiscount(selectedPromo)}</div>
              <div>Penggunaan: {selectedPromo?.used_count || 0} kali</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={deletePromo} disabled={loading}>
              {loading ? "Menghapus..." : "Hapus Promo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
