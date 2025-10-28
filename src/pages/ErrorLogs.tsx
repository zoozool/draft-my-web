import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, RefreshCw, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  function_name?: string;
}

const ErrorLogs = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [edgeLogs, setEdgeLogs] = useState<LogEntry[]>([]);
  const [authLogs, setAuthLogs] = useState<LogEntry[]>([]);
  const [dbLogs, setDbLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchLogs();
    }
  }, [user]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // Fetch client logs
      const { data: clientData, error: clientError } = await supabase.functions.invoke("get-logs", {
        body: { logType: "client" }
      });

      const parsedClientLogs: LogEntry[] = [];
      if (!clientError && clientData?.logs) {
        parsedClientLogs.push(...clientData.logs.map((log: any) => ({
          id: log.id || Math.random().toString(),
          timestamp: new Date(log.timestamp / 1000).toLocaleString(),
          level: log.level || "info",
          message: log.event_message || log.message || "No message",
          function_name: log.function_id || "Unknown"
        })));
      }

      // Fetch edge function logs
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke("get-logs", {
        body: { logType: "edge" }
      });

      if (!edgeError && edgeData?.logs) {
        const parsedEdgeLogs = edgeData.logs.map((log: any) => ({
          id: log.id || Math.random().toString(),
          timestamp: new Date(log.timestamp / 1000).toLocaleString(),
          level: log.level || "info",
          message: log.event_message || log.message || "No message",
          function_name: log.function_id || "Unknown"
        }));
        setEdgeLogs([...parsedClientLogs, ...parsedEdgeLogs]);
      } else {
        setEdgeLogs(parsedClientLogs);
      }

      // Fetch auth logs
      const { data: authData, error: authError } = await supabase.functions.invoke("get-logs", {
        body: { logType: "auth" }
      });

      if (!authError && authData?.logs) {
        const parsedAuthLogs = authData.logs.map((log: any) => ({
          id: log.id || Math.random().toString(),
          timestamp: new Date(log.timestamp / 1000).toLocaleString(),
          level: log.level || "info",
          message: log.msg || log.event_message || "No message",
        }));
        setAuthLogs(parsedAuthLogs);
      }

      // Fetch database logs
      const { data: dbData, error: dbError } = await supabase.functions.invoke("get-logs", {
        body: { logType: "db" }
      });

      if (!dbError && dbData?.logs) {
        const parsedDbLogs = dbData.logs.map((log: any) => ({
          id: log.id || Math.random().toString(),
          timestamp: new Date(log.timestamp / 1000).toLocaleString(),
          level: log.error_severity || log.level || "info",
          message: log.event_message || log.message || "No message",
        }));
        setDbLogs(parsedDbLogs);
      }

    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch logs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getLevelColor = (level: string) => {
    const lowerLevel = level.toLowerCase();
    if (lowerLevel.includes("error") || lowerLevel === "error") return "destructive";
    if (lowerLevel.includes("warn") || lowerLevel === "warning") return "default";
    return "secondary";
  };

  const renderLogsTable = (logs: LogEntry[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[180px]">Timestamp</TableHead>
          <TableHead className="w-[100px]">Level</TableHead>
          <TableHead>Message</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.length === 0 ? (
          <TableRow>
            <TableCell colSpan={3} className="text-center text-muted-foreground">
              No logs found
            </TableCell>
          </TableRow>
        ) : (
          logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell className="font-mono text-xs">{log.timestamp}</TableCell>
              <TableCell>
                <Badge variant={getLevelColor(log.level)}>{log.level}</Badge>
              </TableCell>
              <TableCell className="font-mono text-xs break-all">
                {log.message.length > 200 ? `${log.message.substring(0, 200)}...` : log.message}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => navigate("/settings")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Settings
          </Button>
        </div>
        <Button onClick={fetchLogs} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh Logs
        </Button>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <AlertCircle className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">Error Logs</h1>
          <p className="text-muted-foreground">View application logs and errors</p>
        </div>
      </div>

      <Tabs defaultValue="client" className="space-y-4">
        <TabsList>
          <TabsTrigger value="client">Client Errors</TabsTrigger>
          <TabsTrigger value="edge">Edge Functions</TabsTrigger>
          <TabsTrigger value="auth">Authentication</TabsTrigger>
          <TabsTrigger value="db">Database</TabsTrigger>
        </TabsList>

        <TabsContent value="client">
          <Card>
            <CardHeader>
              <CardTitle>Client Error Logs</CardTitle>
            </CardHeader>
            <CardContent>
              {renderLogsTable(edgeLogs)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="edge">
          <Card>
            <CardHeader>
              <CardTitle>Edge Function Logs</CardTitle>
            </CardHeader>
            <CardContent>
              {renderLogsTable(edgeLogs)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auth">
          <Card>
            <CardHeader>
              <CardTitle>Authentication Logs</CardTitle>
            </CardHeader>
            <CardContent>
              {renderLogsTable(authLogs)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="db">
          <Card>
            <CardHeader>
              <CardTitle>Database Logs</CardTitle>
            </CardHeader>
            <CardContent>
              {renderLogsTable(dbLogs)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ErrorLogs;
