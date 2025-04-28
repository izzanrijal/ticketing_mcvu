// components/admin/sponsor-letter-table.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface SponsorLetter {
    id: string;
    registration_number: string | null;
    status: string;
    created_at: string;
    sponsor_letter_url: string;
    participants: { 
        full_name: string;
        email: string;
    } | null; 
}

interface ApiResponse {
    data: SponsorLetter[] | null;
    error: string | null;
    debug: any | null;
}

export function SponsorLetterTable() {
    const [sponsorLetters, setSponsorLetters] = useState<SponsorLetter[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch("/api/admin/sponsor-letters");
                if (!response.ok) {
                    let errorMsg = `HTTP error! status: ${response.status}`;
                    try {
                        const errorData: ApiResponse = await response.json();
                        errorMsg = errorData.error || errorMsg;
                        console.error("API Error Debug Info:", errorData.debug);
                    } catch (e) {
                        // Ignore if response body is not JSON
                    }
                    throw new Error(errorMsg);
                }
                const result: ApiResponse = await response.json();

                if (result.error) {
                    throw new Error(result.error);
                }

                setSponsorLetters(result.data || []);
            } catch (err: any) {
                console.error("Failed to fetch sponsor letters:", err);
                setError(err.message || "An unknown error occurred.");
                setSponsorLetters([]); 
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, []); 

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Sponsor Guarantee Letters</CardTitle>
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-8 w-full mb-4" />
                    <Skeleton className="h-8 w-full mb-4" />
                    <Skeleton className="h-8 w-full" />
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Error</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-red-600">Failed to load sponsor letters: {error}</p>
                </CardContent>
            </Card>
        );
    }

    if (sponsorLetters.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Sponsor Guarantee Letters</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>No sponsor letters found.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Sponsor Guarantee Letters</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Reg. Number</TableHead>
                            <TableHead>Participant Name</TableHead>
                            <TableHead>Participant Email</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
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
                                    {letter.sponsor_letter_url && (
                                        <Button variant="outline" size="sm" asChild>
                                            <Link href={letter.sponsor_letter_url} target="_blank" rel="noopener noreferrer">
                                                <Download className="mr-2 h-4 w-4" /> Download
                                            </Link>
                                        </Button>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
