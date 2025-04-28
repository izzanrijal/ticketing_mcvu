"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { uploadSponsorLetter } from "@/lib/sponsor-letter-utils";

interface SponsorLetterHandlerProps {
  registrationId: string;
  registrationNumber: string;
  sponsorLetterFile?: File;
  onSuccess: (url: string) => void;
  onError: (error: string) => void;
}

export function SponsorLetterHandler({
  registrationId,
  registrationNumber,
  sponsorLetterFile,
  onSuccess,
  onError,
}: SponsorLetterHandlerProps) {
  const [file, setFile] = useState<File | undefined>(sponsorLetterFile);
  const [uploading, setUploading] = useState(false);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };
  
  const handleUpload = async () => {
    if (!file) {
      onError("No file selected");
      return;
    }
    
    setUploading(true);
    try {
      const result = await uploadSponsorLetter(file, registrationId, registrationNumber);
      if (result.success && result.url) {
        onSuccess(result.url);
      } else {
        throw new Error(result.error || "Upload failed");
      }
    } catch (error) {
      console.error("Error uploading sponsor letter:", error);
      onError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sponsor Letter</CardTitle>
        <CardDescription>Upload guarantee letter from your sponsoring organization</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid w-full items-center gap-4">
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="sponsor-letter">Guarantee Letter</Label>
            <Input
              id="sponsor-letter"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button
          onClick={handleUpload}
          disabled={!file || uploading}
        >
          {uploading ? "Uploading..." : "Upload Guarantee Letter"}
        </Button>
      </CardFooter>
    </Card>
  );
}
