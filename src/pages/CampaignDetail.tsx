import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Mail, CheckCircle2, Clock, XCircle, Download, Pause, Play } from "lucide-react";
import { Link, useParams } from "react-router-dom";
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
  const [campaign] = useState({
    id: 1,
    name: "Q4 Product Launch",
    status: "active",
    total: 450,
    sent: 312,
    pending: 138,
    failed: 0,
    createdAt: "2025-01-15",
    csvFile: "companies_q4.csv",
    baseImage: "base_mockup.jpg",
    perspectiveMode: true,
  });

  const [emails] = useState([
    {
      id: 1,
      company: "Acme Corp",
      email: "contact@acme.com",
      contact: "John Smith",
      status: "sent",
      sentAt: "2025-01-15 10:30",
      logoUrl: "https://example.com/acme-logo.png",
    },
    {
      id: 2,
      company: "TechStart Inc",
      email: "hello@techstart.io",
      contact: "Jane Doe",
      status: "sent",
      sentAt: "2025-01-15 10:31",
      logoUrl: "https://example.com/techstart-logo.png",
    },
    {
      id: 3,
      company: "Global Industries",
      email: "info@global.com",
      contact: "Bob Wilson",
      status: "pending",
      sentAt: null,
      logoUrl: "https://example.com/global-logo.png",
    },
  ]);

  const progress = (campaign.sent / campaign.total) * 100;

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
            <Link to="/">
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
            <Button variant="outline">
              <Pause className="mr-2 h-4 w-4" />
              Pause
            </Button>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
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
                  {campaign.sent} of {campaign.total} emails sent
                </span>
                <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <div>
                  <div className="text-2xl font-bold text-foreground">{campaign.sent}</div>
                  <div className="text-sm text-muted-foreground">Sent</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-lg bg-accent/10 border border-accent/20">
                <Clock className="h-8 w-8 text-accent" />
                <div>
                  <div className="text-2xl font-bold text-foreground">{campaign.pending}</div>
                  <div className="text-sm text-muted-foreground">Pending</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <XCircle className="h-8 w-8 text-destructive" />
                <div>
                  <div className="text-2xl font-bold text-foreground">{campaign.failed}</div>
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
                <span className="ml-2 font-medium text-foreground">{campaign.createdAt}</span>
              </div>
              <div>
                <span className="text-muted-foreground">CSV File:</span>
                <span className="ml-2 font-medium text-foreground">{campaign.csvFile}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Base Image:</span>
                <span className="ml-2 font-medium text-foreground">{campaign.baseImage}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Perspective Mode:</span>
                <span className="ml-2 font-medium text-foreground">
                  {campaign.perspectiveMode ? "Enabled" : "Disabled"}
                </span>
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
                {emails.map((email) => (
                  <TableRow key={email.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(email.status)}
                        <Badge className={getStatusColor(email.status)}>
                          {email.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{email.company}</TableCell>
                    <TableCell>{email.contact}</TableCell>
                    <TableCell className="text-muted-foreground">{email.email}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {email.sentAt || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default CampaignDetail;
