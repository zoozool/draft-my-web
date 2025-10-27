import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, CheckCircle2, Clock, XCircle, Download, Mail, Trash2, Image, Edit2, Save, X, Plus, UserPlus, RefreshCw, Upload, Pencil, Laptop } from "lucide-react";
import { useLocalCompositeGeneration } from "@/hooks/useLocalCompositeGeneration";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";


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
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newContact, setNewContact] = useState({
    email: "",
    first_name: "",
    last_name: "",
    company: "",
    logo_url: "",
  });
  const [isUploadingBase, setIsUploadingBase] = useState(false);
  const [baseImageFile, setBaseImageFile] = useState<File | null>(null);
  const [isEditContactOpen, setIsEditContactOpen] = useState(false);
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [editContactForm, setEditContactForm] = useState({
    email: "",
    first_name: "",
    last_name: "",
    company: "",
    logo_url: "",
  });
  const [compositeErrors, setCompositeErrors] = useState<string[]>([]);
  const [compositePage, setCompositePage] = useState(1);
  const [isEditingCoordinates, setIsEditingCoordinates] = useState(false);
  const [batchSize, setBatchSize] = useState(5);
  const [isProcessingPipeline, setIsProcessingPipeline] = useState(false);
  const [coordinates, setCoordinates] = useState({
    topLeft: { x: 888, y: 500 },
    topRight: { x: 1201, y: 493 },
    bottomRight: { x: 1198, y: 724 },
    bottomLeft: { x: 886, y: 726 }
  });
  
  const { 
    isGenerating: isGeneratingLocally, 
    progress: localProgress, 
    generateComposites: generateLocalComposites 
  } = useLocalCompositeGeneration();

  const handleGenerateLocalComposites = async () => {
    if (!campaign) return;
    await generateLocalComposites(campaign.id, campaign.base_image_url);
    fetchCampaignData();
  };

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

      const result = data?.results?.[0] || { sent: 0, failed: 0 };
      
      toast({
        title: "Emails sent successfully",
        description: `Sent ${result.sent} emails, ${result.failed} failed`,
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

  const handleUploadBaseImage = async () => {
    if (!campaign || !baseImageFile) return;

    setIsUploadingBase(true);
    try {
      const fileName = `base-${campaign.id}-${Date.now()}.${baseImageFile.name.split('.').pop()}`;
      
      const { error: uploadError } = await supabase
        .storage
        .from("logos")
        .upload(`base-images/${fileName}`, baseImageFile, {
          contentType: baseImageFile.type,
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase
        .storage
        .from("logos")
        .getPublicUrl(`base-images/${fileName}`);

      const { error: updateError } = await supabase
        .from("campaigns")
        .update({ base_image_url: urlData.publicUrl })
        .eq("id", campaign.id);

      if (updateError) throw updateError;

      toast({
        title: "Base image uploaded",
        description: "Your base image has been set successfully",
      });

      setBaseImageFile(null);
      fetchCampaignData();
    } catch (error: any) {
      toast({
        title: "Failed to upload base image",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploadingBase(false);
    }
  };

  const handleGenerateComposites = async () => {
    if (!campaign) return;
    
    setIsGenerating(true);
    setCompositeErrors([]);
    try {
      const { data, error } = await supabase.functions.invoke("generate-composite-images", {
        body: { 
          campaignId: campaign.id,
          baseImageUrl: campaign.base_image_url || undefined,
          limit: batchSize
        },
      });

      if (error) throw error;

      const hasErrors = data.errors && data.errors.length > 0;
      
      if (hasErrors) {
        setCompositeErrors(data.errors);
      }
      
      toast({
        title: hasErrors ? "Composite generation completed with errors" : "Composite images generated",
        description: hasErrors 
          ? `${data.successful} succeeded, ${data.failed} failed. See error details below.`
          : `Successfully generated ${data.successful} images`,
        variant: hasErrors ? "destructive" : "default",
      });

      fetchCampaignData();
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

  const handleRegenerateComposites = async () => {
    if (!campaign) return;
    
    setIsRegenerating(true);
    setCompositeErrors([]);
    try {
      const { error: clearError } = await supabase
        .from("contacts")
        .update({ composite_image_url: null })
        .eq("campaign_id", campaign.id)
        .not("logo_url", "is", null);

      if (clearError) throw clearError;

      toast({
        title: "Cleared existing composites",
        description: "Regenerating images...",
      });

      const { data, error } = await supabase.functions.invoke("generate-composite-images", {
        body: { 
          campaignId: campaign.id,
          baseImageUrl: campaign.base_image_url || undefined,
          limit: batchSize
        },
      });

      if (error) throw error;

      const hasErrors = data.errors && data.errors.length > 0;
      
      if (hasErrors) {
        setCompositeErrors(data.errors);
      }
      
      toast({
        title: hasErrors ? "Regeneration completed with errors" : "Composites regenerated",
        description: hasErrors 
          ? `${data.successful} succeeded, ${data.failed} failed. See error details below.`
          : `Successfully generated ${data.successful} images`,
        variant: hasErrors ? "destructive" : "default",
      });

      fetchCampaignData();
    } catch (error: any) {
      toast({
        title: "Failed to regenerate composites",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleResetToPending = async () => {
    if (!campaign) return;
    
    try {
      const sentContacts = contacts.filter(c => c.status === "sent");
      
      if (sentContacts.length === 0) {
        toast({
          title: "No contacts to reset",
          description: "There are no sent contacts to reset",
        });
        return;
      }

      const { error } = await supabase
        .from("contacts")
        .update({ status: "pending", sent_at: null })
        .eq("campaign_id", campaign.id)
        .eq("status", "sent");

      if (error) throw error;

      // Update campaign counts
      const { error: updateError } = await supabase
        .from("campaigns")
        .update({
          sent_count: 0,
          pending_count: campaign.pending_count + sentContacts.length,
        })
        .eq("id", campaign.id);

      if (updateError) throw updateError;

      toast({
        title: "Contacts reset to pending",
        description: `${sentContacts.length} contact(s) can now be resent with composite images`,
      });

      fetchCampaignData();
    } catch (error: any) {
      toast({
        title: "Error resetting contacts",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditClick = () => {
    if (campaign) {
      setEditSubject(campaign.subject);
      setEditBody(campaign.body_template);
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditSubject("");
    setEditBody("");
  };

  const handleSaveEdit = async () => {
    if (!campaign) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("campaigns")
        .update({ 
          subject: editSubject,
          body_template: editBody
        })
        .eq("id", campaign.id);

      if (error) throw error;

      toast({
        title: "Campaign updated",
        description: "Subject and body template have been updated successfully",
      });

      setIsEditing(false);
      fetchCampaignData();
    } catch (error: any) {
      toast({
        title: "Failed to update campaign",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddContact = async () => {
    if (!campaign || !newContact.email) {
      toast({
        title: "Email required",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    setIsAdding(true);
    try {
      const { error } = await supabase
        .from("contacts")
        .insert({
          campaign_id: campaign.id,
          email: newContact.email,
          first_name: newContact.first_name || null,
          last_name: newContact.last_name || null,
          company: newContact.company || null,
          logo_url: newContact.logo_url || null,
          status: "pending",
        });

      if (error) throw error;

      // Update campaign counts
      const { error: updateError } = await supabase
        .from("campaigns")
        .update({
          total_contacts: campaign.total_contacts + 1,
          pending_count: campaign.pending_count + 1,
        })
        .eq("id", campaign.id);

      if (updateError) throw updateError;

      toast({
        title: "Contact added",
        description: "New contact has been added to the campaign",
      });

      setIsAddDialogOpen(false);
      setNewContact({
        email: "",
        first_name: "",
        last_name: "",
        company: "",
        logo_url: "",
      });
      fetchCampaignData();
    } catch (error: any) {
      toast({
        title: "Failed to add contact",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteContact = async (contactId: string, contactStatus: string) => {
    if (!campaign) return;

    try {
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("id", contactId);

      if (error) throw error;

      // Update campaign counts based on contact status
      const updates: any = {
        total_contacts: campaign.total_contacts - 1,
      };

      if (contactStatus === "pending") {
        updates.pending_count = campaign.pending_count - 1;
      } else if (contactStatus === "sent") {
        updates.sent_count = campaign.sent_count - 1;
      } else if (contactStatus === "failed") {
        updates.failed_count = campaign.failed_count - 1;
      }

      const { error: updateError } = await supabase
        .from("campaigns")
        .update(updates)
        .eq("id", campaign.id);

      if (updateError) throw updateError;

      toast({
        title: "Contact deleted",
        description: "Contact has been removed from the campaign",
      });

      fetchCampaignData();
    } catch (error: any) {
      toast({
        title: "Failed to delete contact",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditContactClick = (contact: any) => {
    setEditingContact(contact);
    setEditContactForm({
      email: contact.email,
      first_name: contact.first_name || "",
      last_name: contact.last_name || "",
      company: contact.company || "",
      logo_url: contact.logo_url || "",
    });
    setIsEditContactOpen(true);
  };

  const handleSaveEditContact = async () => {
    if (!editingContact) return;

    setIsEditingContact(true);
    try {
      const { error } = await supabase
        .from("contacts")
        .update({
          email: editContactForm.email,
          first_name: editContactForm.first_name || null,
          last_name: editContactForm.last_name || null,
          company: editContactForm.company || null,
          logo_url: editContactForm.logo_url || null,
        })
        .eq("id", editingContact.id);

      if (error) throw error;

      toast({
        title: "Contact updated",
        description: "Contact details have been updated successfully",
      });

      setIsEditContactOpen(false);
      setEditingContact(null);
      fetchCampaignData();
    } catch (error: any) {
      toast({
        title: "Failed to update contact",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsEditingContact(false);
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

  useEffect(() => {
    const fetchBatchSize = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from("smtp_settings")
          .select("composite_batch_size")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;
        if (data?.composite_batch_size) {
          setBatchSize(data.composite_batch_size);
        }
      } catch (error) {
        console.error("Error fetching batch size:", error);
        // Keep default value of 5 if error
      }
    };

    if (user) {
      fetchBatchSize();
    }
  }, [user]);

  // Auto-refresh when processing
  useEffect(() => {
    if (!campaign) return;
    
    const isProcessing = campaign.processing_status === "processing_images" || 
                        campaign.processing_status === "sending_emails";
    
    if (!isProcessing) return;

    const interval = setInterval(() => {
      fetchCampaignData();
    }, 3000); // Refresh every 3 seconds

    return () => clearInterval(interval);
  }, [campaign?.processing_status]);

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

  const handleProcessPipeline = async () => {
    if (!campaign) return;
    
    setIsProcessingPipeline(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-campaign-pipeline", {
        body: { campaignId: campaign.id },
      });

      if (error) throw error;

      toast({
        title: "Pipeline started",
        description: "Automated processing has been initiated. Images will be generated and emails sent automatically.",
      });

      fetchCampaignData();
    } catch (error: any) {
      toast({
        title: "Failed to start pipeline",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessingPipeline(false);
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
                {campaign.processing_status && campaign.processing_status !== "idle" && (
                  <Badge variant="outline" className="animate-pulse">
                    {campaign.processing_status === "processing_images" && "🖼️ Generating Images"}
                    {campaign.processing_status === "sending_emails" && "📧 Sending Emails"}
                    {campaign.processing_status === "completed" && "✅ Completed"}
                    {campaign.processing_status === "error" && "❌ Error"}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Campaign ID: {id}
                {campaign.last_processed_at && (
                  <span className="ml-3">
                    Last processed: {new Date(campaign.last_processed_at).toLocaleString()}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {campaign.status === "draft" && campaign.pending_count > 0 && (
              <>
                <Button 
                  onClick={handleGenerateComposites} 
                  disabled={isGenerating || isProcessingPipeline || isGeneratingLocally}
                  variant="outline"
                >
                  <Image className="h-4 w-4 mr-2" />
                  {isGenerating ? "Generating..." : "Generate (Server)"}
                </Button>
                <Button 
                  onClick={handleGenerateLocalComposites} 
                  disabled={isGenerating || isProcessingPipeline || isGeneratingLocally}
                  variant="outline"
                >
                  <Laptop className="h-4 w-4 mr-2" />
                  {isGeneratingLocally ? `Generating ${localProgress.current}/${localProgress.total}...` : "Generate Locally"}
                </Button>
                <Button 
                  onClick={handleProcessPipeline} 
                  disabled={isProcessingPipeline || campaign.processing_status !== "idle" || isGeneratingLocally}
                  variant="default"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isProcessingPipeline ? "animate-spin" : ""}`} />
                  {isProcessingPipeline ? "Processing..." : "Process Now (Auto)"}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={isStarting}>
                      <Mail className="h-4 w-4 mr-2" />
                      {isStarting ? "Starting..." : "Start Campaign"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Start Campaign?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will activate your campaign for automatic cron processing. 
                        The system will automatically generate images and send emails every 4 hours.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleStartCampaign}>
                        Start Campaign
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
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
            {contacts.some(c => c.composite_image_url) && (
              <Link to={`/campaigns/${id}/composites`}>
                <Button variant="outline">
                  <Image className="h-4 w-4 mr-2" />
                  View Gallery
                </Button>
              </Link>
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
        {/* Local Generation Progress */}
        {isGeneratingLocally && (
          <Card className="mb-8 shadow-[var(--shadow-card)] border-border/50 bg-accent/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Laptop className="h-5 w-5 animate-pulse" />
                Generating Locally in Browser
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">
                    Processing: {localProgress.currentContact}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {localProgress.current} of {localProgress.total}
                  </span>
                </div>
                <Progress 
                  value={(localProgress.current / localProgress.total) * 100} 
                  className="h-3" 
                />
              </div>
              {localProgress.errors.length > 0 && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm font-medium text-destructive mb-2">
                    Errors ({localProgress.errors.length}):
                  </p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {localProgress.errors.map((error, i) => (
                      <p key={i} className="text-xs text-destructive/90">{error}</p>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                💡 Local generation runs in your browser - no server limits or timeouts!
              </p>
            </CardContent>
          </Card>
        )}
        
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

        {/* Base Image Upload */}
        <Card className="mb-8 shadow-[var(--shadow-card)] border-border/50">
          <CardHeader>
            <CardTitle>Base Image (bazowy.jpg)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {campaign.base_image_url && (
              <div className="space-y-2">
                <Label>Current Base Image</Label>
                <div className="border border-border/50 rounded-lg overflow-hidden bg-muted">
                  <img 
                    src={campaign.base_image_url} 
                    alt="Base image" 
                    className="w-full max-h-[300px] object-contain"
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="base-image">Upload New Base Image</Label>
              <div className="flex gap-2">
                <Input
                  id="base-image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setBaseImageFile(e.target.files?.[0] || null)}
                  className="flex-1"
                />
                <Button
                  onClick={handleUploadBaseImage}
                  disabled={!baseImageFile || isUploadingBase}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploadingBase ? "Uploading..." : "Upload"}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Upload a base image with a white rectangle area where logos will be placed.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Logo Placement Coordinates</Label>
                {!isEditingCoordinates ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingCoordinates(true)}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Coordinates
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsEditingCoordinates(false);
                        setCoordinates({
                          topLeft: { x: 888, y: 500 },
                          topRight: { x: 1201, y: 493 },
                          bottomRight: { x: 1198, y: 724 },
                          bottomLeft: { x: 886, y: 726 }
                        });
                      }}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setIsEditingCoordinates(false);
                        toast({
                          title: "Coordinates saved",
                          description: "New coordinates will be used for composite generation",
                        });
                      }}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                  </div>
                )}
              </div>
              {isEditingCoordinates ? (
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <Label className="text-xs">Top Left (X, Y)</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        type="number"
                        value={coordinates.topLeft.x}
                        onChange={(e) => setCoordinates({
                          ...coordinates,
                          topLeft: { ...coordinates.topLeft, x: parseInt(e.target.value) || 0 }
                        })}
                        placeholder="X"
                      />
                      <Input
                        type="number"
                        value={coordinates.topLeft.y}
                        onChange={(e) => setCoordinates({
                          ...coordinates,
                          topLeft: { ...coordinates.topLeft, y: parseInt(e.target.value) || 0 }
                        })}
                        placeholder="Y"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Top Right (X, Y)</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        type="number"
                        value={coordinates.topRight.x}
                        onChange={(e) => setCoordinates({
                          ...coordinates,
                          topRight: { ...coordinates.topRight, x: parseInt(e.target.value) || 0 }
                        })}
                        placeholder="X"
                      />
                      <Input
                        type="number"
                        value={coordinates.topRight.y}
                        onChange={(e) => setCoordinates({
                          ...coordinates,
                          topRight: { ...coordinates.topRight, y: parseInt(e.target.value) || 0 }
                        })}
                        placeholder="Y"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Bottom Left (X, Y)</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        type="number"
                        value={coordinates.bottomLeft.x}
                        onChange={(e) => setCoordinates({
                          ...coordinates,
                          bottomLeft: { ...coordinates.bottomLeft, x: parseInt(e.target.value) || 0 }
                        })}
                        placeholder="X"
                      />
                      <Input
                        type="number"
                        value={coordinates.bottomLeft.y}
                        onChange={(e) => setCoordinates({
                          ...coordinates,
                          bottomLeft: { ...coordinates.bottomLeft, y: parseInt(e.target.value) || 0 }
                        })}
                        placeholder="Y"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Bottom Right (X, Y)</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        type="number"
                        value={coordinates.bottomRight.x}
                        onChange={(e) => setCoordinates({
                          ...coordinates,
                          bottomRight: { ...coordinates.bottomRight, x: parseInt(e.target.value) || 0 }
                        })}
                        placeholder="X"
                      />
                      <Input
                        type="number"
                        value={coordinates.bottomRight.y}
                        onChange={(e) => setCoordinates({
                          ...coordinates,
                          bottomRight: { ...coordinates.bottomRight, y: parseInt(e.target.value) || 0 }
                        })}
                        placeholder="Y"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-muted/50 rounded-md text-sm font-mono">
                  <div>TL: ({coordinates.topLeft.x}, {coordinates.topLeft.y})</div>
                  <div>TR: ({coordinates.topRight.x}, {coordinates.topRight.y})</div>
                  <div>BR: ({coordinates.bottomRight.x}, {coordinates.bottomRight.y})</div>
                  <div>BL: ({coordinates.bottomLeft.x}, {coordinates.bottomLeft.y})</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Campaign Details */}
        <Card className="mb-8 shadow-[var(--shadow-card)] border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Campaign Details</CardTitle>
              {!isEditing && campaign.status === "draft" && (
                <Button variant="outline" size="sm" onClick={handleEditClick}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-subject">Email Subject</Label>
                  <Input
                    id="edit-subject"
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    className="mt-2"
                    placeholder="Enter email subject..."
                  />
                </div>
                <div>
                  <Label htmlFor="edit-body">Email Body Template</Label>
                  <p className="text-sm text-muted-foreground mt-1 mb-2">
                    Available variables: <code className="text-primary">{'{{company}}'}</code>, <code className="text-primary">{'{{first_name}}'}</code>, <code className="text-primary">{'{{composite_image}}'}</code>, <code className="text-primary">{'{{logo_url}}'}</code>
                  </p>
                  <Textarea
                    id="edit-body"
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    placeholder="Enter email body HTML..."
                    className="mt-2 font-mono text-sm"
                    rows={12}
                  />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button 
                    variant="outline" 
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSaveEdit}
                    disabled={isSaving}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 text-sm">
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
                  <div className="mt-1 p-3 bg-muted/50 rounded-md font-medium text-foreground">
                    {campaign.subject}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Email Body Template:</span>
                  <div className="mt-1 p-3 bg-muted/50 rounded-md font-mono text-xs text-foreground max-h-48 overflow-y-auto">
                    {campaign.body_template}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Contacts:</span>
                  <span className="ml-2 font-medium text-foreground">{campaign.total_contacts}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Composite Errors Display */}
        {compositeErrors.length > 0 && (
          <Card className="mb-8 shadow-[var(--shadow-card)] border-destructive/50 bg-destructive/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-destructive">Composite Generation Errors</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setCompositeErrors([])}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {compositeErrors.map((error, index) => (
                  <div key={index} className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                    <p className="text-sm text-foreground font-mono">{error}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-4 bg-muted/50 rounded-md">
                <p className="text-sm text-muted-foreground">
                  <strong>Common solutions:</strong>
                </p>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                  <li>WebP logos: Convert to PNG or JPEG format</li>
                  <li>Invalid URLs: Check that logo URLs are accessible</li>
                  <li>Large files: Ensure logos are under 10MB</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Email List */}
        <Card className="shadow-[var(--shadow-card)] border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Email List</CardTitle>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Contact
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Contact</DialogTitle>
                    <DialogDescription>
                      Manually add a contact to this campaign
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newContact.email}
                        onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                        placeholder="contact@example.com"
                        className="mt-2"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="first_name">First Name</Label>
                        <Input
                          id="first_name"
                          value={newContact.first_name}
                          onChange={(e) => setNewContact({ ...newContact, first_name: e.target.value })}
                          placeholder="John"
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label htmlFor="last_name">Last Name</Label>
                        <Input
                          id="last_name"
                          value={newContact.last_name}
                          onChange={(e) => setNewContact({ ...newContact, last_name: e.target.value })}
                          placeholder="Doe"
                          className="mt-2"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="company">Company</Label>
                      <Input
                        id="company"
                        value={newContact.company}
                        onChange={(e) => setNewContact({ ...newContact, company: e.target.value })}
                        placeholder="Company Name"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="logo_url">Logo URL</Label>
                      <Input
                        id="logo_url"
                        value={newContact.logo_url}
                        onChange={(e) => setNewContact({ ...newContact, logo_url: e.target.value })}
                        placeholder="https://example.com/logo.png"
                        className="mt-2"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isAdding}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddContact} disabled={isAdding}>
                      {isAdding ? "Adding..." : "Add Contact"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
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
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No contacts found
                    </TableCell>
                  </TableRow>
                ) : (
                  contacts.map((contact) => {
                    const getRowColor = () => {
                      if (!contact.email || contact.email.trim() === "") {
                        return "bg-red-500/10 hover:bg-red-500/20";
                      }
                      if (!contact.logo_url || contact.logo_url.trim() === "") {
                        return "bg-orange-500/10 hover:bg-orange-500/20";
                      }
                      if (!contact.composite_image_url) {
                        return "bg-blue-500/10 hover:bg-blue-500/20";
                      }
                      return "";
                    };

                    return (
                      <TableRow key={contact.id} className={getRowColor()}>
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
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditContactClick(contact)}
                            className="h-8 w-8"
                          >
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteContact(contact.id, contact.status)}
                            className="h-8 w-8"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit Contact Dialog */}
        <Dialog open={isEditContactOpen} onOpenChange={setIsEditContactOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Contact</DialogTitle>
              <DialogDescription>
                Update contact information
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="edit-email">Email *</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editContactForm.email}
                  onChange={(e) => setEditContactForm({ ...editContactForm, email: e.target.value })}
                  placeholder="contact@example.com"
                  className="mt-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-first-name">First Name</Label>
                  <Input
                    id="edit-first-name"
                    value={editContactForm.first_name}
                    onChange={(e) => setEditContactForm({ ...editContactForm, first_name: e.target.value })}
                    placeholder="John"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-last-name">Last Name</Label>
                  <Input
                    id="edit-last-name"
                    value={editContactForm.last_name}
                    onChange={(e) => setEditContactForm({ ...editContactForm, last_name: e.target.value })}
                    placeholder="Doe"
                    className="mt-2"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-company">Company</Label>
                <Input
                  id="edit-company"
                  value={editContactForm.company}
                  onChange={(e) => setEditContactForm({ ...editContactForm, company: e.target.value })}
                  placeholder="Company Name"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="edit-logo-url">Logo URL</Label>
                <Input
                  id="edit-logo-url"
                  value={editContactForm.logo_url}
                  onChange={(e) => setEditContactForm({ ...editContactForm, logo_url: e.target.value })}
                  placeholder="https://example.com/logo.png"
                  className="mt-2"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditContactOpen(false)} disabled={isEditingContact}>
                Cancel
              </Button>
              <Button onClick={handleSaveEditContact} disabled={isEditingContact}>
                {isEditingContact ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default CampaignDetail;
