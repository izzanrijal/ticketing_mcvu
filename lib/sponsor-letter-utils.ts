/**
 * Utility functions for handling sponsor letter uploads
 */

/**
 * Uploads a sponsor letter file and associates it with a registration
 * The file will be prefixed with the registration number
 */
export async function uploadSponsorLetter(
  file: File,
  registrationId: string,
  registrationNumber: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Create form data for the upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('registrationId', registrationId);
    formData.append('registrationNumber', registrationNumber);
    
    // Send to our API endpoint
    const response = await fetch('/api/sponsor-letter-upload', {
      method: 'POST',
      body: formData,
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to upload sponsor letter');
    }
    
    return {
      success: true,
      url: result.url,
    };
  } catch (error) {
    console.error('Error uploading sponsor letter:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Gets a signed URL for a sponsor letter
 * This can be used if you want to switch to private storage bucket in the future
 */
export async function getSponsorLetterSignedUrl(path: string): Promise<{ 
  success: boolean; 
  url?: string; 
  error?: string 
}> {
  try {
    const response = await fetch(`/api/sponsor-letter-signed-url?path=${encodeURIComponent(path)}`);
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to get signed URL');
    }
    
    return {
      success: true,
      url: result.signedUrl,
    };
  } catch (error) {
    console.error('Error getting signed URL:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
