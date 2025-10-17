import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Upload, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const NewCampaign = () => {
  const [step, setStep] = useState(1);
  const [campaignName, setCampaignName] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [baseImage, setBaseImage] = useState<File | null>(null);
  const [perspectiveMode, setPerspectiveMode] = useState(false);
  const { toast } = useToast();

  const steps = [
    { number: 1, title: "Campaign Details", description: "Basic information" },
    { number: 2, title: "Upload Files", description: "CSV and base image" },
    { number: 3, title: "Email Templates", description: "Subject and body" },
    { number: 4, title: "Review & Launch", description: "Final confirmation" },
  ];

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleLaunch = () => {
    toast({
      title: "Campaign Launched!",
      description: "Your campaign has been queued for processing.",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4 flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Create New Campaign</h1>
            <p className="text-sm text-muted-foreground">Follow the steps to set up your campaign</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            {steps.map((s, idx) => (
              <div key={s.number} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold transition-all ${
                      step >= s.number
                        ? "bg-gradient-to-r from-primary to-accent text-white shadow-[var(--shadow-elegant)]"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {step > s.number ? <Check className="h-6 w-6" /> : s.number}
                  </div>
                  <div className="mt-2 text-center">
                    <div className="text-sm font-medium text-foreground">{s.title}</div>
                    <div className="text-xs text-muted-foreground">{s.description}</div>
                  </div>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-4 rounded transition-colors ${
                      step > s.number ? "bg-gradient-to-r from-primary to-accent" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <Card className="max-w-3xl mx-auto shadow-[var(--shadow-card)] border-border/50">
          <CardHeader>
            <CardTitle>Step {step}: {steps[step - 1].title}</CardTitle>
            <CardDescription>{steps[step - 1].description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="campaignName">Campaign Name</Label>
                  <Input
                    id="campaignName"
                    placeholder="e.g., Q4 Product Launch"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of this campaign..."
                    className="mt-2"
                    rows={4}
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <Label htmlFor="csv">CSV File</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Upload CSV with headers: Company, Email, Contact, LogoURL
                  </p>
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
                    <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <input
                      type="file"
                      id="csv"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                    />
                    <label htmlFor="csv" className="cursor-pointer">
                      <span className="text-sm text-foreground font-medium">
                        {csvFile ? csvFile.name : "Click to upload CSV"}
                      </span>
                      <p className="text-xs text-muted-foreground mt-1">
                        or drag and drop
                      </p>
                    </label>
                  </div>
                </div>

                <div>
                  <Label htmlFor="baseImage">Base Image</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    The background image where logos will be composited
                  </p>
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
                    <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                    <input
                      type="file"
                      id="baseImage"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setBaseImage(e.target.files?.[0] || null)}
                    />
                    <label htmlFor="baseImage" className="cursor-pointer">
                      <span className="text-sm text-foreground font-medium">
                        {baseImage ? baseImage.name : "Click to upload image"}
                      </span>
                      <p className="text-xs text-muted-foreground mt-1">
                        PNG or JPG
                      </p>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
                  <div>
                    <Label htmlFor="perspective">Perspective Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Warp logos to fit screen quadrilateral
                    </p>
                  </div>
                  <Switch
                    id="perspective"
                    checked={perspectiveMode}
                    onCheckedChange={setPerspectiveMode}
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Available variables: <code className="text-primary">{'{{Company}}'}</code>,{' '}
                    <code className="text-primary">{'{{Contact}}'}</code>,{' '}
                    <code className="text-primary">{'{{INLINE_CID}}'}</code>
                  </p>
                </div>

                <div>
                  <Label htmlFor="subject1">First Email Subject</Label>
                  <Input
                    id="subject1"
                    placeholder="e.g., Special offer for {{Company}}"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="body1">First Email Body (HTML)</Label>
                  <Textarea
                    id="body1"
                    placeholder="Hello {{Contact}},..."
                    className="mt-2 font-mono text-sm"
                    rows={8}
                  />
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-semibold mb-4">Follow-up Email</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="subject2">Subject</Label>
                      <Input
                        id="subject2"
                        placeholder="Follow-up for {{Company}}"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="body2">Body (HTML)</Label>
                      <Textarea
                        id="body2"
                        placeholder="Hi {{Contact}}, just following up..."
                        className="mt-2 font-mono text-sm"
                        rows={6}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6">
                <div className="p-6 bg-gradient-to-br from-primary/10 to-accent/10 rounded-lg border border-primary/20">
                  <h3 className="font-semibold text-lg mb-4">Campaign Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Campaign Name:</span>
                      <span className="font-medium">{campaignName || "Untitled"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CSV File:</span>
                      <span className="font-medium">{csvFile?.name || "Not uploaded"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Base Image:</span>
                      <span className="font-medium">{baseImage?.name || "Not uploaded"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Perspective Mode:</span>
                      <span className="font-medium">{perspectiveMode ? "Enabled" : "Disabled"}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <p className="text-sm text-amber-900 dark:text-amber-200">
                    <strong>Note:</strong> Once launched, emails will be queued for processing. 
                    Monitor progress on the campaign detail page.
                  </p>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-6 border-t">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={step === 1}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              {step < 4 ? (
                <Button onClick={handleNext} className="bg-gradient-to-r from-primary to-accent">
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleLaunch} className="bg-gradient-to-r from-primary to-accent">
                  <Check className="mr-2 h-4 w-4" />
                  Launch Campaign
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default NewCampaign;
