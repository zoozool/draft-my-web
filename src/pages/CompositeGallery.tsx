import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw, Download, Trash2, Edit, XCircle, Save } from "lucide-react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

const CompositeGallery = () => {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [compositeErrors, setCompositeErrors] = useState<string[]>([]);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    email: "",
    first_name: "",
    last_name: "",
    company: "",
    logo_url: "",
  });

  const itemsPerPage = 50;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) {
      fetchData();
    }
  }, [user, id]);

  const fetchData = async () => {
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
        .not("composite_image_url", "is", null)
        .order("created_at", { ascending: false });

      if (contactsError) throw contactsError;
      setContacts(contactsData || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load composite images",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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
          baseImageUrl: campaign.base_image_url || undefined
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

      fetchData();
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

  const handleDownloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to download image",
        variant: "destructive",
      });
    }
  };

  const handleEditClick = (contact: any) => {
    setEditingContact(contact);
    setEditForm({
      email: contact.email,
      first_name: contact.first_name || "",
      last_name: contact.last_name || "",
      company: contact.company || "",
      logo_url: contact.logo_url || "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editingContact) return;

    try {
      const { error } = await supabase
        .from("contacts")
        .update(editForm)
        .eq("id", editingContact.id);

      if (error) throw error;

      toast({
        title: "Contact updated",
        description: "Contact information has been updated successfully",
      });

      setEditingContact(null);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRegenerateContact = async (contactId: string) => {
    try {
      // Clear the composite image for this specific contact
      const { error: clearError } = await supabase
        .from("contacts")
        .update({ composite_image_url: null })
        .eq("id", contactId);

      if (clearError) throw clearError;

      toast({
        title: "Regenerating composite",
        description: "The composite image will be regenerated for this contact",
      });

      // Refresh the data
      fetchData();
    } catch (error: any) {
      toast({
        title: "Failed to regenerate",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteContact = async () => {
    if (!deleteContactId) return;

    try {
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("id", deleteContactId);

      if (error) throw error;

      toast({
        title: "Contact deleted",
        description: "Contact has been removed from the campaign",
      });

      setDeleteContactId(null);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
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

  const totalPages = Math.ceil(contacts.length / itemsPerPage);
  const paginatedContacts = contacts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-card/90 backdrop-blur-md shadow-[var(--shadow-card)] sticky top-0 z-10">
        <div className="container mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={`/campaigns/${id}`}>
              <Button variant="ghost" size="icon" className="hover:bg-primary/10">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Composite Gallery
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {campaign.name} • {contacts.length} images generated
              </p>
            </div>
          </div>
          <Button 
            variant="outline"
            onClick={handleRegenerateComposites}
            disabled={isRegenerating}
            className="hover:border-primary hover:text-primary transition-[var(--transition-smooth)]"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRegenerating ? 'animate-spin' : ''}`} />
            {isRegenerating ? "Regenerating..." : "Regenerate All"}
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Composite Errors Display */}
        {compositeErrors.length > 0 && (
          <Card className="mb-8 shadow-[var(--shadow-elegant)] border-destructive/60 bg-gradient-to-br from-destructive/10 to-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <XCircle className="h-5 w-5" />
                Generation Errors ({compositeErrors.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {compositeErrors.map((error, index) => (
                  <div key={index} className="p-4 bg-card border border-destructive/30 rounded-lg hover:border-destructive/50 transition-[var(--transition-smooth)]">
                    <p className="text-sm text-foreground font-mono leading-relaxed">{error}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Gallery */}
        <Card className="shadow-[var(--shadow-elegant)] border-border/60 bg-card/80 backdrop-blur-sm">
          <CardHeader className="border-b border-border/40">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl">
                Page {currentPage} of {totalPages}
              </CardTitle>
              <Badge variant="secondary" className="text-sm px-4 py-1">
                {paginatedContacts.length} of {contacts.length} images
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {contacts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No composite images found</p>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {paginatedContacts.map((contact) => (
                    <div key={contact.id} className="group">
                      <Card className="overflow-hidden border-border/60 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elegant)] transition-[var(--transition-smooth)] hover:border-primary/40">
                        <CardContent className="p-0">
                          <div className="aspect-video relative bg-muted/30 overflow-hidden">
                            <img
                              src={contact.composite_image_url}
                              alt={`Composite for ${contact.company || contact.email}`}
                              className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                  handleDownloadImage(
                                    contact.composite_image_url,
                                    `composite-${contact.company || contact.email}.png`
                                  )
                                }
                                className="shadow-lg"
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </Button>
                            </div>
                          </div>
                          <div className="p-4 space-y-3">
                            <div className="space-y-1">
                              <p className="font-semibold text-foreground truncate">
                                {contact.company || "No company"}
                              </p>
                              <p className="text-muted-foreground text-xs truncate">{contact.email}</p>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditClick(contact)}
                                className="hover:bg-primary/10 hover:border-primary hover:text-primary"
                              >
                                <Edit className="h-3.5 w-3.5 mr-1.5" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRegenerateContact(contact.id)}
                                className="hover:bg-accent/10 hover:border-accent hover:text-accent"
                              >
                                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                                Regen
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setDeleteContactId(contact.id)}
                                className="hover:bg-destructive/10 hover:border-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      
                      {Array.from({ length: totalPages }).map((_, i) => {
                        const pageNum = i + 1;
                        
                        // Show first page, last page, current page, and pages around current
                        if (
                          pageNum === 1 ||
                          pageNum === totalPages ||
                          Math.abs(pageNum - currentPage) <= 1
                        ) {
                          return (
                            <PaginationItem key={pageNum}>
                              <PaginationLink
                                onClick={() => setCurrentPage(pageNum)}
                                isActive={currentPage === pageNum}
                                className="cursor-pointer"
                              >
                                {pageNum}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        } else if (
                          pageNum === currentPage - 2 ||
                          pageNum === currentPage + 2
                        ) {
                          return (
                            <PaginationItem key={pageNum}>
                              <PaginationEllipsis />
                            </PaginationItem>
                          );
                        }
                        return null;
                      })}
                      
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                          className={
                            currentPage >= totalPages
                              ? "pointer-events-none opacity-50" 
                              : "cursor-pointer"
                          }
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Edit Dialog */}
      <Dialog open={!!editingContact} onOpenChange={(open) => !open && setEditingContact(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl">Edit Contact</DialogTitle>
            <DialogDescription>Update contact information and regenerate the composite image if needed</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                value={editForm.first_name}
                onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                value={editForm.last_name}
                onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={editForm.company}
                onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="logo_url">Logo URL</Label>
              <Input
                id="logo_url"
                value={editForm.logo_url}
                onChange={(e) => setEditForm({ ...editForm, logo_url: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingContact(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} className="bg-gradient-to-r from-primary to-accent hover:opacity-90">
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteContactId} onOpenChange={(open) => !open && setDeleteContactId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Delete Contact
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Are you sure you want to permanently delete this contact and their composite image? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteContact} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CompositeGallery;
