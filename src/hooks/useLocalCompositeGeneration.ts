import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Contact {
  id: string;
  email: string;
  logo_url: string;
  company: string;
}

interface GenerationProgress {
  current: number;
  total: number;
  currentContact: string;
  errors: string[];
}

export const useLocalCompositeGeneration = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress>({
    current: 0,
    total: 0,
    currentContact: "",
    errors: [],
  });

  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  };

  const generateComposite = async (
    baseImage: HTMLImageElement,
    logoImage: HTMLImageElement,
    targetArea: { x: number; y: number; width: number; height: number }
  ): Promise<Blob> => {
    const canvas = document.createElement("canvas");
    canvas.width = baseImage.width;
    canvas.height = baseImage.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get canvas context");

    // Draw base image
    ctx.drawImage(baseImage, 0, 0);

    // Calculate logo dimensions to fit within target area
    const logoAspect = logoImage.width / logoImage.height;
    const targetAspect = targetArea.width / targetArea.height;

    let drawWidth, drawHeight, drawX, drawY;

    if (logoAspect > targetAspect) {
      // Logo is wider
      drawWidth = targetArea.width;
      drawHeight = drawWidth / logoAspect;
      drawX = targetArea.x;
      drawY = targetArea.y + (targetArea.height - drawHeight) / 2;
    } else {
      // Logo is taller
      drawHeight = targetArea.height;
      drawWidth = drawHeight * logoAspect;
      drawX = targetArea.x + (targetArea.width - drawWidth) / 2;
      drawY = targetArea.y;
    }

    // Draw logo
    ctx.drawImage(logoImage, drawX, drawY, drawWidth, drawHeight);

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to create blob"));
        },
        "image/png",
        1.0
      );
    });
  };

  const cacheLogo = async (logoUrl: string, contactId: string): Promise<string> => {
    try {
      const { data, error } = await supabase.functions.invoke('cache-logo', {
        body: { logoUrl, contactId }
      });

      if (error) throw error;
      return data.cachedUrl;
    } catch (error) {
      console.error('Failed to cache logo, using original:', error);
      return logoUrl; // Fallback to original
    }
  };

  const generateComposites = async (
    campaignId: string,
    baseImageUrl: string | null
  ) => {
    setIsGenerating(true);
    const errors: string[] = [];

    try {
      // Fetch contacts without composite images
      const { data: contacts, error: fetchError } = await supabase
        .from("contacts")
        .select("id, email, logo_url, company")
        .eq("campaign_id", campaignId)
        .is("composite_image_url", null)
        .not("logo_url", "is", null);

      if (fetchError) throw fetchError;
      if (!contacts || contacts.length === 0) {
        toast({
          title: "No contacts to process",
          description: "All contacts already have composite images",
        });
        return;
      }

      setProgress({
        current: 0,
        total: contacts.length,
        currentContact: "",
        errors: [],
      });

      // Use default base image if not provided
      const baseUrl = baseImageUrl || "https://via.placeholder.com/1920x1080/FFFFFF/000000?text=Base+Image";
      
      // Load base image once
      const baseImage = await loadImage(baseUrl);

      // Target area for logo placement (adjust these values as needed)
      const targetArea = {
        x: 888,
        y: 500,
        width: 313,
        height: 226,
      };

      // Process each contact
      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        
        try {
          setProgress((prev) => ({
            ...prev,
            current: i + 1,
            currentContact: contact.company || contact.email,
          }));

          // Cache logo first to avoid CORS issues
          const cachedLogoUrl = await cacheLogo(contact.logo_url, contact.id);
          
          // Load logo from cached URL
          const logoImage = await loadImage(cachedLogoUrl);

          // Generate composite
          const compositeBlob = await generateComposite(
            baseImage,
            logoImage,
            targetArea
          );

          // Upload to storage
          const fileName = `composites/${contact.id}-${Date.now()}.png`;
          const { error: uploadError } = await supabase.storage
            .from("logos")
            .upload(fileName, compositeBlob, {
              contentType: "image/png",
              upsert: true,
            });

          if (uploadError) throw uploadError;

          // Get public URL
          const { data: urlData } = supabase.storage
            .from("logos")
            .getPublicUrl(fileName);

          // Update contact record
          const { error: updateError } = await supabase
            .from("contacts")
            .update({ composite_image_url: urlData.publicUrl })
            .eq("id", contact.id);

          if (updateError) throw updateError;

        } catch (error: any) {
          const errorMsg = `${contact.email}: ${error.message}`;
          errors.push(errorMsg);
          setProgress((prev) => ({
            ...prev,
            errors: [...prev.errors, errorMsg],
          }));
        }
      }

      // Show completion toast
      const successCount = contacts.length - errors.length;
      toast({
        title: errors.length > 0 ? "Generation completed with errors" : "Generation completed",
        description: `Successfully generated ${successCount} of ${contacts.length} images`,
        variant: errors.length > 0 ? "destructive" : "default",
      });

    } catch (error: any) {
      toast({
        title: "Failed to generate composites",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    isGenerating,
    progress,
    generateComposites,
  };
};
