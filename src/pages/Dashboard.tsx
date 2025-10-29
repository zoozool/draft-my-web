import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Clock, CheckCircle2, XCircle, Plus, TrendingUp, LogOut, Activity, Settings, Sparkles, Search } from "lucide-react";
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
            <Link to="/scrape">
              <Button variant="outline">
                <Search className="mr-2 h-4 w-4" />
                Web Scraper
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
        <Link to="/composite-generator">
          <Card className="mb-8 shadow-[var(--shadow-elegant)] border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5 hover:shadow-[var(--shadow-glow)] transition-all cursor-pointer group">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-2xl">
                <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-accent group-hover:scale-110 transition-transform">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Composite Generator
                </span>
              </CardTitle>
              <CardDescription>Test logo placement on base images with custom parameters</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Generate composite images by overlaying logos on base images. Perfect for testing before running a campaign.
              </p>
            </CardContent>
          </Card>
        </Link>

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
