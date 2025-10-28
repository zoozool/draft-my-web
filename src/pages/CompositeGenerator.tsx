import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, Download, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

const CompositeGenerator = () => {
  const navigate = useNavigate();
  const [testBaseImage, setTestBaseImage] = useState("");
  const [testLogoUrl, setTestLogoUrl] = useState("");
  const [testCoordinates, setTestCoordinates] = useState({
    x: 0,
    y: 0,
    width: 200,
    height: 200,
  });
  const [generatedTestImage, setGeneratedTestImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: campaigns } = useQuery({
    queryKey: ["campaigns-base-images"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, name, base_image_url")
        .not("base_image_url", "is", null)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
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

    if (!ctx) {
      throw new Error("Failed to get canvas context");
    }

    ctx.drawImage(baseImage, 0, 0);
    ctx.drawImage(
      logoImage,
      targetArea.x,
      targetArea.y,
      targetArea.width,
      targetArea.height
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to create blob from canvas"));
        }
      }, "image/png");
    });
  };

  const logError = async (errorMessage: string, errorDetails: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("error_logs").insert({
          user_id: user.id,
          log_type: "client",
          level: "error",
          function_name: "composite-generator",
          error_message: errorMessage,
          error_details: errorDetails,
        });
      }
    } catch (logError) {
      console.error("Failed to log error:", logError);
    }
  };

  const handleGenerateTestComposite = async () => {
    if (!testBaseImage || !testLogoUrl) {
      toast.error("Please provide both base image and logo URL");
      return;
    }

    setIsGenerating(true);
    try {
      const { data: cachedLogoData, error: cacheError } = await supabase.functions.invoke(
        "cache-logo",
        {
          body: { logoUrl: testLogoUrl, contactId: "test" },
        }
      );

      if (cacheError) {
        await logError("Failed to cache logo", { 
          error: cacheError.message,
          logoUrl: testLogoUrl 
        });
        throw cacheError;
      }

      const cachedLogoUrl = cachedLogoData.cachedUrl;
      const [baseImg, logoImg] = await Promise.all([
        loadImage(testBaseImage),
        loadImage(cachedLogoUrl),
      ]);

      const compositeBlob = await generateComposite(baseImg, logoImg, testCoordinates);
      const compositeUrl = URL.createObjectURL(compositeBlob);
      setGeneratedTestImage(compositeUrl);
      toast.success("Test composite generated successfully!");
    } catch (error: any) {
      console.error("Error generating test composite:", error);
      await logError("Failed to generate test composite", {
        error: error.message,
        stack: error.stack,
        baseImage: testBaseImage,
        logoUrl: testLogoUrl,
        coordinates: testCoordinates,
      });
      toast.error("Failed to generate test composite");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadTestImage = () => {
    if (!generatedTestImage) return;
    const link = document.createElement("a");
    link.href = generatedTestImage;
    link.download = "test-composite.png";
    link.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto p-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Composite Generator
          </h1>
          <p className="text-muted-foreground">
            Test composite image generation with custom parameters
          </p>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <div className="space-y-4">
              <Label>Select Base Image from Gallery</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-96 overflow-y-auto">
                {campaigns?.map((campaign) => (
                  <div
                    key={campaign.id}
                    className={`relative cursor-pointer rounded-lg border-2 transition-all ${
                      testBaseImage === campaign.base_image_url
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => setTestBaseImage(campaign.base_image_url || "")}
                  >
                    <img
                      src={campaign.base_image_url || ""}
                      alt={campaign.name}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    {testBaseImage === campaign.base_image_url && (
                      <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                        <Check className="h-4 w-4" />
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-1 truncate px-1">
                      {campaign.name}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="testBaseImage">Or Enter Base Image URL</Label>
                  <Input
                    id="testBaseImage"
                    placeholder="https://example.com/base-image.png"
                    value={testBaseImage}
                    onChange={(e) => setTestBaseImage(e.target.value)}
                  />
                </div>

              <div>
                <Label htmlFor="testLogoUrl">Logo URL</Label>
                <Input
                  id="testLogoUrl"
                  placeholder="https://example.com/logo.png"
                  value={testLogoUrl}
                  onChange={(e) => setTestLogoUrl(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="coordX">X Position</Label>
                  <Input
                    id="coordX"
                    type="number"
                    value={testCoordinates.x}
                    onChange={(e) =>
                      setTestCoordinates({
                        ...testCoordinates,
                        x: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="coordY">Y Position</Label>
                  <Input
                    id="coordY"
                    type="number"
                    value={testCoordinates.y}
                    onChange={(e) =>
                      setTestCoordinates({
                        ...testCoordinates,
                        y: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="coordWidth">Width</Label>
                  <Input
                    id="coordWidth"
                    type="number"
                    value={testCoordinates.width}
                    onChange={(e) =>
                      setTestCoordinates({
                        ...testCoordinates,
                        width: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="coordHeight">Height</Label>
                  <Input
                    id="coordHeight"
                    type="number"
                    value={testCoordinates.height}
                    onChange={(e) =>
                      setTestCoordinates({
                        ...testCoordinates,
                        height: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>

              <Button
                onClick={handleGenerateTestComposite}
                disabled={isGenerating}
                className="w-full"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {isGenerating ? "Generating..." : "Generate Test Composite"}
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <div className="space-y-4">
              <Label>Generated Preview</Label>
              {generatedTestImage ? (
                <div className="space-y-4">
                  <div className="relative rounded-lg overflow-hidden border">
                    <img
                      src={generatedTestImage}
                      alt="Generated composite"
                      className="w-full h-auto"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleDownloadTestImage}
                      className="flex-1"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setGeneratedTestImage(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 bg-muted rounded-lg">
                  <p className="text-muted-foreground">
                    No preview available. Generate a composite to see the result.
                  </p>
                </div>
              )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompositeGenerator;