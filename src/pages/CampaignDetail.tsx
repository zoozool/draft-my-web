import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, CheckCircle2, Clock, XCircle, Download, Mail, Trash2 } from "lucide-react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const CampaignDetail = () => {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleStartCampaign = async () => {
    if (!campaign) return;
    
    setIsStarting(true);
    try {
      const { error } = await supabase
        .from("campaigns")
        .update({ status: "active" })
        .eq("id", campaign.id);

      if (error) throw error;

      toast({
        title: "Campaign started",
        description: "Your campaign is now active and will be processed by the cron job",
      });

      fetchCampaignData();
    } catch (error: any) {
      toast({
        title: "Failed to start campaign",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsStarting(false);
    }
  };

  const handleSendEmails = async () => {
    if (!campaign) return;
    
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-emails", {
        body: { campaignId: campaign.id },
      });

      if (error) throw error;

      toast({
        title: "Emails sent successfully",
        description: `Sent ${data.sent} emails, ${data.failed} failed`,
      });

      // Refresh campaign data
      fetchCampaignData();
    } catch (error: any) {
      toast({
        title: "Failed to send emails",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleResetCampaign = async () => {
    if (!campaign) return;
    
    setIsStarting(true);
    try {
      // Reset all contacts to pending
      const { error: contactsError } = await supabase
        .from("contacts")
        .update({ status: "pending", sent_at: null, error_message: null })
        .eq("campaign_id", campaign.id);

      if (contactsError) throw contactsError;

      // Reset campaign to draft
      const { error } = await supabase
        .from("campaigns")
        .update({ 
          status: "draft",
          sent_count: 0,
          failed_count: 0,
          pending_count: campaign.total_contacts
        })
        .eq("id", campaign.id);

      if (error) throw error;

      toast({
        title: "Campaign reset",
        description: "Campaign has been reset to draft status",
      });

      fetchCampaignData();
    } catch (error: any) {
      toast({
        title: "Failed to reset campaign",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsStarting(false);
    }
  };

  const handleDeleteCampaign = async () => {
    if (!campaign) return;
    
    setIsDeleting(true);
    try {
      // Delete all contacts first
      const { error: contactsError } = await supabase
        .from("contacts")
        .delete()
        .eq("campaign_id", campaign.id);

      if (contactsError) throw contactsError;

      // Delete the campaign
      const { error } = await supabase
        .from("campaigns")
        .delete()
        .eq("id", campaign.id);

      if (error) throw error;

      toast({
        title: "Campaign deleted",
        description: "Campaign and all contacts have been deleted",
      });

      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Failed to delete campaign",
        description: error.message,
        variant: "destructive",
      });
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) {
      fetchCampaignData();
    }
  }, [user, id]);

  const fetchCampaignData = async () => {
    try {
      const { data: campaignData, error: campaignError } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", id)
        .single();

      if (campaignError) throw campaignError;
      setCampaign(campaignData);

      const { data: contactsData, error: contactsError } = await supabase
        .from("contacts")
        .select("*")
        .eq("campaign_id", id)
        .order("created_at", { ascending: false });

      if (contactsError) throw contactsError;
      setContacts(contactsData || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load campaign data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-muted-foreground">Campaign not found</div>
        </div>
      </div>
    );
  }

  const progress = campaign.total_contacts > 0 
    ? (campaign.sent_count / campaign.total_contacts) * 100 
    : 0;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-accent" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "sent":
        return "bg-green-500 text-white";
      case "pending":
        return "bg-accent text-accent-foreground";
      case "failed":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-muted";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">{campaign.name}</h1>
                <Badge className="bg-primary text-primary-foreground">
                  {campaign.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">Campaign ID: {id}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {campaign.status === "draft" && campaign.pending_count > 0 && (
              <Button 
                onClick={handleStartCampaign} 
                disabled={isStarting}
              >
                <Mail className="h-4 w-4 mr-2" />
                {isStarting ? "Starting..." : "Start Campaign"}
              </Button>
            )}
            {campaign.status === "active" && campaign.pending_count > 0 && (
              <Button 
                onClick={handleSendEmails} 
                disabled={isSending}
                variant="secondary"
              >
                <Mail className="h-4 w-4 mr-2" />
                {isSending ? "Sending..." : "Send Now"}
              </Button>
            )}
            {(campaign.status === "completed" || campaign.status === "active") && (
              <Button 
                onClick={handleResetCampaign} 
                disabled={isStarting}
                variant="outline"
              >
                {isStarting ? "Resetting..." : "Reset Campaign"}
              </Button>
            )}
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive"
                  disabled={isDeleting}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the campaign "{campaign.name}" and all {campaign.total_contacts} contacts. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteCampaign} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {isDeleting ? "Deleting..." : "Delete Campaign"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Progress Overview */}
        <Card className="mb-8 shadow-[var(--shadow-card)] border-border/50">
          <CardHeader>
            <CardTitle>Campaign Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">
                  {campaign.sent_count} of {campaign.total_contacts} emails sent
                </span>
                <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <div>
                  <div className="text-2xl font-bold text-foreground">{campaign.sent_count}</div>
                  <div className="text-sm text-muted-foreground">Sent</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-lg bg-accent/10 border border-accent/20">
                <Clock className="h-8 w-8 text-accent" />
                <div>
                  <div className="text-2xl font-bold text-foreground">{campaign.pending_count}</div>
                  <div className="text-sm text-muted-foreground">Pending</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <XCircle className="h-8 w-8 text-destructive" />
                <div>
                  <div className="text-2xl font-bold text-foreground">{campaign.failed_count}</div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Campaign Details */}
        <Card className="mb-8 shadow-[var(--shadow-card)] border-border/50">
          <CardHeader>
            <CardTitle>Campaign Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Created:</span>
                <span className="ml-2 font-medium text-foreground">
                  {new Date(campaign.created_at).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <span className="ml-2 font-medium text-foreground capitalize">{campaign.status}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Subject:</span>
                <span className="ml-2 font-medium text-foreground">{campaign.subject}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Total Contacts:</span>
                <span className="ml-2 font-medium text-foreground">{campaign.total_contacts}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email List */}
        <Card className="shadow-[var(--shadow-card)] border-border/50">
          <CardHeader>
            <CardTitle>Email List</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Sent At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No contacts found
                    </TableCell>
                  </TableRow>
                ) : (
                  contacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(contact.status)}
                          <Badge className={getStatusColor(contact.status)}>
                            {contact.status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{contact.company || "-"}</TableCell>
                      <TableCell>{contact.first_name || ""} {contact.last_name || ""}</TableCell>
                      <TableCell className="text-muted-foreground">{contact.email}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {contact.sent_at ? new Date(contact.sent_at).toLocaleString() : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default CampaignDetail;
