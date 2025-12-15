import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

/**
 * Evidence Collection Settings Component
 * 
 * This component is a placeholder for the evidence collection configuration feature.
 * The actual implementation requires the evidence_collection_configs table to be created.
 */
export function EvidenceCollectionSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          Evidence Collection Settings
        </CardTitle>
        <CardDescription>
          Configure customer-side evidence storage for evaluation data
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8 text-muted-foreground">
          <p className="mb-2">Evidence collection configuration is not yet available.</p>
          <p className="text-sm">
            This feature requires additional database tables to be set up.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
