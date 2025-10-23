import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, RefreshCw, Download } from "lucide-react";
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
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={`/campaigns/${id}`}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Composite Images Gallery</h1>
              <p className="text-sm text-muted-foreground">
                {campaign.name} - {contacts.length} images
              </p>
            </div>
          </div>
          <Button 
            variant="outline"
            onClick={handleRegenerateComposites}
            disabled={isRegenerating}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {isRegenerating ? "Regenerating..." : "Regenerate All"}
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Composite Errors Display */}
        {compositeErrors.length > 0 && (
          <Card className="mb-8 shadow-[var(--shadow-card)] border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive">Composite Generation Errors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {compositeErrors.map((error, index) => (
                  <div key={index} className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                    <p className="text-sm text-foreground font-mono">{error}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Gallery */}
        <Card className="shadow-[var(--shadow-card)] border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Page {currentPage} of {totalPages}
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  (Showing {paginatedContacts.length} of {contacts.length} images)
                </span>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {contacts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No composite images found</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {paginatedContacts.map((contact) => (
                    <div key={contact.id} className="space-y-2">
                      <div className="aspect-video relative rounded-lg overflow-hidden border border-border/50 bg-muted group">
                        <img
                          src={contact.composite_image_url}
                          alt={`Composite for ${contact.company || contact.email}`}
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              handleDownloadImage(
                                contact.composite_image_url,
                                `composite-${contact.company || contact.email}.png`
                              )
                            }
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        </div>
                      </div>
                      <div className="text-sm space-y-1">
                        <p className="font-medium text-foreground">
                          {contact.company || "No company"}
                        </p>
                        <p className="text-muted-foreground text-xs">{contact.email}</p>
                      </div>
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
    </div>
  );
};

export default CompositeGallery;
