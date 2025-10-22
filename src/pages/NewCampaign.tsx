import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Upload, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const NewCampaign = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [campaignName, setCampaignName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyTemplate, setBodyTemplate] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [baseImage, setBaseImage] = useState<File | null>(null);
  const [perspectiveMode, setPerspectiveMode] = useState(false);
  const [launching, setLaunching] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

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

  const handleLaunch = async () => {
    if (!campaignName || !subject || !bodyTemplate || !csvFile || !user) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setLaunching(true);

    try {
      // Create campaign
      const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .insert({
          name: campaignName,
          subject,
          body_template: bodyTemplate,
          user_id: user.id,
          status: "draft",
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Read CSV file
      const csvText = await csvFile.text();

      // Process CSV via edge function
      const { data: processData, error: processError } = await supabase.functions.invoke(
        "process-csv",
        {
          body: {
            campaignId: campaign.id,
            csvContent: csvText,
          },
        }
      );

      if (processError) throw processError;

      toast({
        title: "Campaign Created!",
        description: `${processData.contactsCreated} contacts added successfully.`,
      });

      navigate(`/campaigns/${campaign.id}`);
    } catch (error: any) {
      console.error("Error creating campaign:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create campaign",
        variant: "destructive",
      });
    } finally {
      setLaunching(false);
    }
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
                <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                  <p className="text-sm text-muted-foreground font-semibold mb-2">
                    Available variables:
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <code className="text-primary bg-primary/10 px-2 py-1 rounded">{'{{company}}'}</code>
                      <span className="text-muted-foreground ml-2">- Company name</span>
                    </div>
                    <div>
                      <code className="text-primary bg-primary/10 px-2 py-1 rounded">{'{{first_name}}'}</code>
                      <span className="text-muted-foreground ml-2">- First name</span>
                    </div>
                    <div>
                      <code className="text-primary bg-primary/10 px-2 py-1 rounded">{'{{last_name}}'}</code>
                      <span className="text-muted-foreground ml-2">- Last name</span>
                    </div>
                    <div>
                      <code className="text-primary bg-primary/10 px-2 py-1 rounded">{'{{contact}}'}</code>
                      <span className="text-muted-foreground ml-2">- Full name</span>
                    </div>
                    <div>
                      <code className="text-primary bg-primary/10 px-2 py-1 rounded">{'{{email}}'}</code>
                      <span className="text-muted-foreground ml-2">- Email address</span>
                    </div>
                    <div>
                      <code className="text-primary bg-primary/10 px-2 py-1 rounded">{'{{logo_url}}'}</code>
                      <span className="text-muted-foreground ml-2">- Logo image URL</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Example: Use <code className="text-primary bg-primary/10 px-1 rounded">{'<img src="{{logo_url}}" alt="{{company}} logo" />'}</code> to insert logo
                  </p>
                </div>

                <div>
                  <Label htmlFor="subject">Email Subject</Label>
                  <Input
                    id="subject"
                    placeholder="e.g., Special offer for {{company}}"
                    className="mt-2"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="body">Email Body (HTML)</Label>
                  <Textarea
                    id="body"
                    placeholder="Hello {{first_name}},..."
                    className="mt-2 font-mono text-sm"
                    rows={8}
                    value={bodyTemplate}
                    onChange={(e) => setBodyTemplate(e.target.value)}
                  />
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
                <Button 
                  onClick={handleLaunch} 
                  className="bg-gradient-to-r from-primary to-accent"
                  disabled={launching}
                >
                  <Check className="mr-2 h-4 w-4" />
                  {launching ? "Creating..." : "Create Campaign"}
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
