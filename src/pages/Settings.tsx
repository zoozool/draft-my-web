import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, CheckCircle, XCircle, Settings as SettingsIcon } from "lucide-react";
import { z } from "zod";

const settingsSchema = z.object({
  smtp_host: z.string().trim().min(1, "SMTP host is required").max(255),
  smtp_port: z.number().int().min(1, "Port must be at least 1").max(65535, "Port must be at most 65535"),
  smtp_username: z.string().trim().min(1, "Username is required").max(255),
  smtp_password: z.string().min(1, "Password is required").max(500),
  smtp_from_email: z.string().trim().email("Invalid email address").max(255),
  smtp_from_name: z.string().trim().min(1, "From name is required").max(100),
  use_tls: z.boolean(),
  is_active: z.boolean(),
  emails_per_hour_limit: z.number().int().min(1, "Limit must be at least 1").max(10000, "Limit cannot exceed 10,000"),
  composite_batch_size: z.number().int().min(5, "Batch size must be at least 5").max(100, "Batch size cannot exceed 100"),
  search_api_key: z.string().optional(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState<SettingsFormData>({
    smtp_host: "",
    smtp_port: 587,
    smtp_username: "",
    smtp_password: "",
    smtp_from_email: "",
    smtp_from_name: "",
    use_tls: true,
    is_active: true,
    emails_per_hour_limit: 100,
    composite_batch_size: 5,
    search_api_key: "",
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("smtp_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setFormData({
          smtp_host: data.smtp_host,
          smtp_port: data.smtp_port,
          smtp_username: data.smtp_username,
          smtp_password: data.smtp_password,
          smtp_from_email: data.smtp_from_email,
          smtp_from_name: data.smtp_from_name,
          use_tls: data.use_tls,
          is_active: data.is_active,
          emails_per_hour_limit: data.emails_per_hour_limit || 100,
          composite_batch_size: data.composite_batch_size || 5,
          search_api_key: data.search_api_key || "",
        });
        setTestStatus(data.test_status);
      }
    } catch (error: any) {
      console.error("Error fetching settings:", error);
      toast({
        title: "Error",
        description: "Failed to fetch settings",
        variant: "destructive",
      });
    } finally {
      setFetching(false);
    }
  };

  const validateForm = (): boolean => {
    try {
      settingsSchema.parse(formData);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleTestConnection = async () => {
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors before testing",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    setTestStatus(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("test-smtp", {
        body: {
          smtp_host: formData.smtp_host,
          smtp_port: formData.smtp_port,
          smtp_username: formData.smtp_username,
          smtp_password: formData.smtp_password,
          smtp_from_email: formData.smtp_from_email,
          smtp_from_name: formData.smtp_from_name,
          use_tls: formData.use_tls,
          is_active: formData.is_active,
        },
      });

      if (error) throw error;

      if (data.success) {
        setTestStatus('success');
        toast({
          title: "Success",
          description: "SMTP connection test successful!",
        });
      } else {
        setTestStatus('failed');
        toast({
          title: "Connection Failed",
          description: data.error || "Failed to connect to SMTP server",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      setTestStatus('failed');
      toast({
        title: "Error",
        description: error.message || "Failed to test SMTP connection",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors before saving",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("smtp_settings")
        .upsert({
          user_id: user.id,
          smtp_host: formData.smtp_host,
          smtp_port: formData.smtp_port,
          smtp_username: formData.smtp_username,
          smtp_password: formData.smtp_password,
          smtp_from_email: formData.smtp_from_email,
          smtp_from_name: formData.smtp_from_name,
          use_tls: formData.use_tls,
          is_active: formData.is_active,
          emails_per_hour_limit: formData.emails_per_hour_limit,
          composite_batch_size: formData.composite_batch_size,
          search_api_key: formData.search_api_key || null,
          test_status: testStatus || null,
          last_tested_at: testStatus ? new Date().toISOString() : null,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Settings saved successfully",
      });
      
      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      <Button
        variant="ghost"
        onClick={() => navigate("/dashboard")}
        className="mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Dashboard
      </Button>

      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <SettingsIcon className="h-8 w-8" />
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Configure your email campaign settings</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>System</CardTitle>
            <CardDescription>
              View system logs and errors
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => navigate("/settings/logs")}
            >
              View Error Logs
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Email Rate Limit</CardTitle>
            <CardDescription>
              Set the maximum number of emails to send per hour
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="emails_per_hour_limit">Emails per Hour *</Label>
              <Input
                id="emails_per_hour_limit"
                type="number"
                placeholder="100"
                value={formData.emails_per_hour_limit}
                onChange={(e) => setFormData({ ...formData, emails_per_hour_limit: parseInt(e.target.value) || 0 })}
                className={errors.emails_per_hour_limit ? "border-destructive" : ""}
              />
              {errors.emails_per_hour_limit && (
                <p className="text-sm text-destructive">{errors.emails_per_hour_limit}</p>
              )}
              <p className="text-sm text-muted-foreground">
                This limit helps prevent your emails from being marked as spam
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Composite Image Generation</CardTitle>
            <CardDescription>
              Set how many composite images to generate per batch
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="composite_batch_size">Images per Batch *</Label>
              <Input
                id="composite_batch_size"
                type="number"
                min="5"
                max="100"
                placeholder="5"
                value={formData.composite_batch_size}
                onChange={(e) => setFormData({ ...formData, composite_batch_size: parseInt(e.target.value) || 5 })}
                className={errors.composite_batch_size ? "border-destructive" : ""}
              />
              {errors.composite_batch_size && (
                <p className="text-sm text-destructive">{errors.composite_batch_size}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Number of composite images to generate each time you click "Generate Composites" (5-100)
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Web Search API</CardTitle>
            <CardDescription>
              Configure your Bing Search API key for the web scraper
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="search_api_key">Bing Search API Key</Label>
              <Input
                id="search_api_key"
                type="password"
                placeholder="Enter your Bing Search API key"
                value={formData.search_api_key}
                onChange={(e) => setFormData({ ...formData, search_api_key: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                Get your API key from <a href="https://www.microsoft.com/en-us/bing/apis/bing-web-search-api" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Microsoft Bing Search API</a>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SMTP Settings</CardTitle>
            <CardDescription>
              Configure your SMTP server to send emails. Test the connection before saving.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="smtp_host">SMTP Host *</Label>
                <Input
                  id="smtp_host"
                  placeholder="smtp.gmail.com"
                  value={formData.smtp_host}
                  onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
                  className={errors.smtp_host ? "border-destructive" : ""}
                />
                {errors.smtp_host && (
                  <p className="text-sm text-destructive">{errors.smtp_host}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp_port">SMTP Port *</Label>
                <Input
                  id="smtp_port"
                  type="number"
                  placeholder="587"
                  value={formData.smtp_port}
                  onChange={(e) => setFormData({ ...formData, smtp_port: parseInt(e.target.value) || 0 })}
                  className={errors.smtp_port ? "border-destructive" : ""}
                />
                {errors.smtp_port && (
                  <p className="text-sm text-destructive">{errors.smtp_port}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp_username">Username *</Label>
                <Input
                  id="smtp_username"
                  placeholder="your-email@gmail.com"
                  value={formData.smtp_username}
                  onChange={(e) => setFormData({ ...formData, smtp_username: e.target.value })}
                  className={errors.smtp_username ? "border-destructive" : ""}
                />
                {errors.smtp_username && (
                  <p className="text-sm text-destructive">{errors.smtp_username}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp_password">Password *</Label>
                <Input
                  id="smtp_password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.smtp_password}
                  onChange={(e) => setFormData({ ...formData, smtp_password: e.target.value })}
                  className={errors.smtp_password ? "border-destructive" : ""}
                />
                {errors.smtp_password && (
                  <p className="text-sm text-destructive">{errors.smtp_password}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp_from_email">From Email *</Label>
                <Input
                  id="smtp_from_email"
                  type="email"
                  placeholder="noreply@example.com"
                  value={formData.smtp_from_email}
                  onChange={(e) => setFormData({ ...formData, smtp_from_email: e.target.value })}
                  className={errors.smtp_from_email ? "border-destructive" : ""}
                />
                {errors.smtp_from_email && (
                  <p className="text-sm text-destructive">{errors.smtp_from_email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp_from_name">From Name *</Label>
                <Input
                  id="smtp_from_name"
                  placeholder="Campaign Name"
                  value={formData.smtp_from_name}
                  onChange={(e) => setFormData({ ...formData, smtp_from_name: e.target.value })}
                  className={errors.smtp_from_name ? "border-destructive" : ""}
                />
                {errors.smtp_from_name && (
                  <p className="text-sm text-destructive">{errors.smtp_from_name}</p>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="use_tls"
                  checked={formData.use_tls}
                  onCheckedChange={(checked) => setFormData({ ...formData, use_tls: checked })}
                />
                <Label htmlFor="use_tls">Use TLS/SSL</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Enable SMTP (Use SMTP instead of Resend)</Label>
              </div>
            </div>

            {testStatus && (
              <div className={`flex items-center gap-2 p-3 rounded-md ${
                testStatus === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                {testStatus === 'success' ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <XCircle className="h-5 w-5" />
                )}
                <span className="text-sm font-medium">
                  {testStatus === 'success' 
                    ? 'Connection test successful' 
                    : 'Connection test failed'}
                </span>
              </div>
            )}

            <Button
              onClick={handleTestConnection}
              disabled={testing}
              variant="outline"
              className="w-full"
            >
              {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Test Connection
            </Button>
          </CardContent>
        </Card>

        <Button
          onClick={handleSave}
          disabled={loading || testing}
          className="w-full"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save All Settings
        </Button>
      </div>
    </div>
  );
};

export default Settings;
