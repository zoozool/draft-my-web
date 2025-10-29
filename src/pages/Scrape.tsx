import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Search } from "lucide-react";

const Scrape = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const handleSearch = async () => {
    if (!companyName.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a company name",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setResults([]);

    try {
      const { data, error } = await supabase.functions.invoke("web-search", {
        body: { query: companyName },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Search Failed",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      setResults(data.results || []);
      
      toast({
        title: "Success",
        description: `Found ${data.results?.length || 0} results`,
      });
    } catch (error: any) {
      console.error("Search error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to perform search",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
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
          <Search className="h-8 w-8" />
          <div>
            <h1 className="text-3xl font-bold">Web Scraper</h1>
            <p className="text-muted-foreground">Search for company information on the web</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Company Search</CardTitle>
            <CardDescription>
              Enter a company name to search for information online
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Names</Label>
              <Textarea
                id="company_name"
                placeholder="Enter company names (one per line)&#10;e.g.,&#10;Microsoft&#10;Apple&#10;Tesla"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="min-h-[150px]"
              />
            </div>

            <Button
              onClick={handleSearch}
              disabled={loading || !companyName.trim()}
              className="w-full"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </CardContent>
        </Card>

        {results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Search Results</CardTitle>
              <CardDescription>
                Found {results.length} results for "{companyName}"
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {results.map((result, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-2">
                    <h3 className="font-semibold text-lg">
                      <a 
                        href={result.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {result.name}
                      </a>
                    </h3>
                    <p className="text-sm text-muted-foreground">{result.snippet}</p>
                    <p className="text-xs text-muted-foreground">{result.url}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Scrape;
