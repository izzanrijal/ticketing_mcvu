// components/admin/sponsor-letter-table.tsx

import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import Link from "next/link";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface SponsorLetter {
    id: number;
    registration_number: string;
    status: string;
    created_at: string;
    sponsor_letter_url: string;
    participants: {
        full_name: string;
        email: string;
    };
}

async function getData(): Promise<SponsorLetter[]> {
    const supabase = createServerComponentClient({ cookies });

    const { data, error } = await supabase
        .from("registrations")
        .select(`
      id,
      registration_number,
      status,
      created_at,
      sponsor_letter_url,
      participants (
        full_name,
        email
      )
    `)
        .eq("payment_type", "sponsor")
        .not("sponsor_letter_url", "is", null)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching sponsor letters:", error);
        return [];
    }

    return data;
}

export async function SponsorLetterTable() {
    const sponsorLetters = await getData();

    if (!sponsorLetters || sponsorLetters.length === 0) {
        return <p>No sponsor letters found.</p>;
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Registration #</TableHead>
                        <TableHead>Participant</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Uploaded At</TableHead>
                        <TableHead className="text-right">Download</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sponsorLetters.map((letter) => (
                        <TableRow key={letter.id}>
                            <TableCell className="font-medium">{letter.registration_number || 'N/A'}</TableCell>
                            <TableCell>{letter.participants?.full_name || 'N/A'}</TableCell> 
                            <TableCell>{letter.participants?.email || 'N/A'}</TableCell>
                            <TableCell><Badge variant={letter.status === 'confirmed' ? 'default' : 'secondary'}>{letter.status}</Badge></TableCell>
                            <TableCell>{new Date(letter.created_at).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                                {letter.sponsor_letter_url ? (
                                    <Button asChild variant="outline" size="sm">
                                        <Link href={letter.sponsor_letter_url} target="_blank" download>
                                            <Download className="mr-2 h-4 w-4" />
                                            Download
                                        </Link>
                                    </Button>
                                ) : (
                                    <span>No Letter</span>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
