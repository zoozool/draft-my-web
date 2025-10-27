import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Clock, CheckCircle2, XCircle, Plus, TrendingUp, LogOut, Activity, Settings, Sparkles, Download, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const Dashboard = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  
  // Composite Generator state
  const [testBaseImage, setTestBaseImage] = useState("");
  const [testLogoUrl, setTestLogoUrl] = useState("");
  const [testCoordinates, setTestCoordinates] = useState({ x: 888, y: 500, width: 313, height: 226 });
  const [isGeneratingTest, setIsGeneratingTest] = useState(false);
  const [generatedTestImage, setGeneratedTestImage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCampaigns();
    }
  }, [user]);

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load campaigns",
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
  };

  const handleGenerateTestComposite = async () => {
    if (!testBaseImage || !testLogoUrl) {
      toast({
        title: "Missing fields",
        description: "Please provide both base image URL and logo URL",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingTest(true);
    setGeneratedTestImage(null);

    try {
      const loadImage = (url: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
          const img = window.document.createElement('img') as HTMLImageElement;
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
          img.src = url;
        });
      };

      // Cache logo to avoid CORS issues
      const { data: cacheData, error: cacheError } = await supabase.functions.invoke('cache-logo', {
        body: { logoUrl: testLogoUrl, contactId: 'test-' + Date.now() }
      });

      if (cacheError) throw cacheError;
      const cachedLogoUrl = cacheData.cachedUrl;

      // Load images
      const [baseImage, logoImage] = await Promise.all([
        loadImage(testBaseImage),
        loadImage(cachedLogoUrl)
      ]);

      // Create canvas
      const canvas = document.createElement("canvas");
      canvas.width = baseImage.width;
      canvas.height = baseImage.height;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get canvas context");

      // Draw base image
      ctx.drawImage(baseImage, 0, 0);

      // Calculate logo dimensions to fit within target area
      const logoAspect = logoImage.width / logoImage.height;
      const targetAspect = testCoordinates.width / testCoordinates.height;

      let drawWidth, drawHeight, drawX, drawY;

      if (logoAspect > targetAspect) {
        drawWidth = testCoordinates.width;
        drawHeight = drawWidth / logoAspect;
        drawX = testCoordinates.x;
        drawY = testCoordinates.y + (testCoordinates.height - drawHeight) / 2;
      } else {
        drawHeight = testCoordinates.height;
        drawWidth = drawHeight * logoAspect;
        drawX = testCoordinates.x + (testCoordinates.width - drawWidth) / 2;
        drawY = testCoordinates.y;
      }

      // Draw logo
      ctx.drawImage(logoImage, drawX, drawY, drawWidth, drawHeight);

      // Convert to data URL
      const dataUrl = canvas.toDataURL("image/png", 1.0);
      setGeneratedTestImage(dataUrl);

      toast({
        title: "Test composite generated",
        description: "Your test composite image has been generated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Failed to generate test composite",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingTest(false);
    }
  };

  const stats = {
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter((c) => c.status === "active").length,
    totalEmails: campaigns.reduce((sum, c) => sum + c.total_contacts, 0),
    sentEmails: campaigns.reduce((sum, c) => sum + c.sent_count, 0),
    pendingEmails: campaigns.reduce((sum, c) => sum + c.pending_count, 0),
    failedEmails: campaigns.reduce((sum, c) => sum + c.failed_count, 0),
  };

  const successRate = stats.totalEmails > 0 
    ? ((stats.sentEmails / stats.totalEmails) * 100).toFixed(1)
    : 0;

  const chartData = [
    { name: "Sent", value: stats.sentEmails, color: "hsl(var(--chart-1))" },
    { name: "Pending", value: stats.pendingEmails, color: "hsl(var(--chart-2))" },
    { name: "Failed", value: stats.failedEmails, color: "hsl(var(--chart-5))" },
  ].filter(item => item.value > 0);

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-primary text-primary-foreground";
      case "completed":
        return "bg-green-500 text-white";
      case "draft":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Logo Mailer
            </h1>
            <p className="text-sm text-muted-foreground">Campaign Management System</p>
          </div>
          <div className="flex gap-2">
            <Link to="/settings">
              <Button variant="outline">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
            </Link>
            <Link to="/campaigns/new">
              <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity">
                <Plus className="mr-2 h-4 w-4" />
                New Campaign
              </Button>
            </Link>
            <Button variant="outline" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <Card className="shadow-[var(--shadow-card)] border-border/50 hover:shadow-[var(--shadow-elegant)] transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Success Rate
              </CardTitle>
              <Activity className="h-4 w-4 text-chart-1" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{successRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                delivery rate
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-[var(--shadow-card)] border-border/50 hover:shadow-[var(--shadow-elegant)] transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Campaigns
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{stats.totalCampaigns}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.activeCampaigns} active
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-[var(--shadow-card)] border-border/50 hover:shadow-[var(--shadow-elegant)] transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Sent Emails
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{stats.sentEmails}</div>
              <p className="text-xs text-muted-foreground mt-1">
                of {stats.totalEmails} total
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-[var(--shadow-card)] border-border/50 hover:shadow-[var(--shadow-elegant)] transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending
              </CardTitle>
              <Clock className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{stats.pendingEmails}</div>
              <p className="text-xs text-muted-foreground mt-1">in queue</p>
            </CardContent>
          </Card>

          <Card className="shadow-[var(--shadow-card)] border-border/50 hover:shadow-[var(--shadow-elegant)] transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Failed
              </CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{stats.failedEmails}</div>
              <p className="text-xs text-muted-foreground mt-1">errors</p>
            </CardContent>
          </Card>
        </div>

        {/* Composite Generator */}
        <Card className="mb-8 shadow-[var(--shadow-elegant)] border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-2xl">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-accent">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Composite Generator
              </span>
            </CardTitle>
            <CardDescription>Test logo placement on base images</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="test-base-image">Base Image URL</Label>
                  <Input
                    id="test-base-image"
                    type="url"
                    value={testBaseImage}
                    onChange={(e) => setTestBaseImage(e.target.value)}
                    placeholder="https://example.com/base-image.jpg"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the URL of your base image
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="test-logo-url">Logo URL</Label>
                  <Input
                    id="test-logo-url"
                    type="url"
                    value={testLogoUrl}
                    onChange={(e) => setTestLogoUrl(e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the URL of the logo to overlay
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Logo Placement Coordinates</Label>
                  <div className="grid grid-cols-2 gap-3 p-4 bg-muted/50 rounded-lg">
                    <div>
                      <Label htmlFor="test-x" className="text-xs">X Position</Label>
                      <Input
                        id="test-x"
                        type="number"
                        value={testCoordinates.x}
                        onChange={(e) => setTestCoordinates({ ...testCoordinates, x: parseInt(e.target.value) || 0 })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="test-y" className="text-xs">Y Position</Label>
                      <Input
                        id="test-y"
                        type="number"
                        value={testCoordinates.y}
                        onChange={(e) => setTestCoordinates({ ...testCoordinates, y: parseInt(e.target.value) || 0 })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="test-width" className="text-xs">Width</Label>
                      <Input
                        id="test-width"
                        type="number"
                        value={testCoordinates.width}
                        onChange={(e) => setTestCoordinates({ ...testCoordinates, width: parseInt(e.target.value) || 0 })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="test-height" className="text-xs">Height</Label>
                      <Input
                        id="test-height"
                        type="number"
                        value={testCoordinates.height}
                        onChange={(e) => setTestCoordinates({ ...testCoordinates, height: parseInt(e.target.value) || 0 })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Define the target area (x, y, width, height) where the logo will be placed
                  </p>
                </div>

                <Button
                  onClick={handleGenerateTestComposite}
                  disabled={isGeneratingTest || !testBaseImage || !testLogoUrl}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
                  size="lg"
                >
                  <Sparkles className="h-5 w-5 mr-2" />
                  {isGeneratingTest ? "Generating..." : "Generate Test Composite"}
                </Button>
              </div>

              <div className="space-y-3">
                {generatedTestImage ? (
                  <>
                    <Label>Generated Composite Image</Label>
                    <div className="relative border border-border/50 rounded-lg overflow-hidden bg-muted shadow-[var(--shadow-elegant)]">
                      <img
                        src={generatedTestImage}
                        alt="Generated composite"
                        className="w-full h-auto"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = generatedTestImage;
                          link.download = 'test-composite.png';
                          link.click();
                        }}
                        className="flex-1"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setGeneratedTestImage(null)}
                        className="flex-1"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Clear
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="h-full min-h-[300px] border-2 border-dashed border-border/50 rounded-lg flex items-center justify-center bg-muted/20">
                    <div className="text-center p-6">
                      <Sparkles className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                      <p className="text-muted-foreground">
                        Generated composite will appear here
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Analytics Section */}
        {stats.totalEmails > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card className="shadow-[var(--shadow-card)] border-border/50">
              <CardHeader>
                <CardTitle className="text-xl">Email Delivery Status</CardTitle>
                <CardDescription>Breakdown of email performance</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="shadow-[var(--shadow-card)] border-border/50">
              <CardHeader>
                <CardTitle className="text-xl">Performance Metrics</CardTitle>
                <CardDescription>Overall campaign statistics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Sent</span>
                    <span className="text-sm font-semibold">{stats.sentEmails}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-chart-1 h-2 rounded-full transition-all" 
                      style={{ width: `${stats.totalEmails > 0 ? (stats.sentEmails / stats.totalEmails) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Pending</span>
                    <span className="text-sm font-semibold">{stats.pendingEmails}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-chart-2 h-2 rounded-full transition-all" 
                      style={{ width: `${stats.totalEmails > 0 ? (stats.pendingEmails / stats.totalEmails) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Failed</span>
                    <span className="text-sm font-semibold">{stats.failedEmails}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-chart-5 h-2 rounded-full transition-all" 
                      style={{ width: `${stats.totalEmails > 0 ? (stats.failedEmails / stats.totalEmails) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Success Rate</span>
                    <span className="text-2xl font-bold text-chart-1">{successRate}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Recent Campaigns */}
        <Card className="shadow-[var(--shadow-card)] border-border/50">
          <CardHeader>
            <CardTitle className="text-xl">Recent Campaigns</CardTitle>
            <CardDescription>Manage and monitor your email campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            {campaigns.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No campaigns yet. Create your first campaign to get started!
              </div>
            ) : (
              <div className="space-y-4">
                {campaigns.map((campaign) => (
                <Link
                  key={campaign.id}
                  to={`/campaigns/${campaign.id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-accent/5 transition-colors cursor-pointer">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                        <Mail className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground">{campaign.name}</h3>
                          <Badge className={getStatusColor(campaign.status)}>
                            {campaign.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Created {new Date(campaign.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-center">
                          <div className="font-semibold text-foreground">{campaign.sent_count}</div>
                          <div className="text-xs text-muted-foreground">Sent</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-foreground">{campaign.pending_count}</div>
                          <div className="text-xs text-muted-foreground">Pending</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-foreground">{campaign.failed_count}</div>
                          <div className="text-xs text-muted-foreground">Failed</div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;
