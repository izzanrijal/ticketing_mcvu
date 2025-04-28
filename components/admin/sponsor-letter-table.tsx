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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Download, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getSponsorLetterSignedUrl } from "@/lib/sponsor-letter-utils";

interface SponsorLetter {
    id: string;
    registration_number: string | null;
    status: string;
    created_at: string;
    sponsor_letter_url: string;
    participants: { 
        id: string;
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

    // Function to extract filename from URL
    const getFilenameFromUrl = (url: string) => {
        try {
            // Try to extract from the pathname
            const pathname = new URL(url).pathname;
            const parts = pathname.split('/');
            return parts[parts.length - 1] || 'sponsor-letter.pdf';
        } catch (e) {
            // If URL parsing fails, just return a default
            return 'sponsor-letter.pdf';
        }
    };

    // Validate the URL to ensure it's properly formatted
    const getValidUrl = (url: string) => {
        if (!url) return '';
        
        // Check if the URL is already complete with scheme
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }
        
        // If it's a relative path or just a filename, assume it's in the Supabase bucket
        if (url.startsWith('/') || !url.includes('/')) {
            // Construct a proper Supabase storage URL
            const bucketName = 'sponsor_letters';
            const fileName = url.startsWith('/') ? url.substring(1) : url;
            return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucketName}/${fileName}`;
        }
        
        return url;
    };

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Sponsor Guarantee Letters</CardTitle>
                    <CardDescription>Loading sponsor letters...</CardDescription>
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
                <CardDescription>Review and download uploaded sponsor guarantee letters.</CardDescription>
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
                                    {letter.sponsor_letter_url ? (
                                        <Button variant="outline" size="sm" asChild>
                                            <a 
                                                href={getValidUrl(letter.sponsor_letter_url)} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                download={getFilenameFromUrl(letter.sponsor_letter_url)}
                                            >
                                                <Download className="mr-2 h-4 w-4" /> Download
                                            </a>
                                        </Button>
                                    ) : (
                                        <span className="text-muted-foreground text-sm">No file</span>
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
