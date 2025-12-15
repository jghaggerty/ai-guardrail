import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ReproPackVerificationResult } from '@/lib/api';
import { CalendarClock, CheckCircle2, Download, FileJson, Hash, Link as LinkIcon, Package, ShieldAlert, ShieldCheck, ShieldHalf } from 'lucide-react';

interface ReproPackMetadataProps {
  reproPackId: string;
  reproPackHash?: string;
  signature?: string;
  signingAuthority?: string;
  createdAt?: Date;
  isDownloading?: boolean;
  isVerifying?: boolean;
  verificationResult?: ReproPackVerificationResult | null;
  onDownload: () => void;
  onVerify: () => void;
  evidenceReferenceId?: string;
  onCopyEvidence?: (id: string) => void;
}

export function ReproPackMetadata({
  reproPackId,
  reproPackHash,
  signature,
  signingAuthority,
  createdAt,
  isDownloading,
  isVerifying,
  verificationResult,
  onDownload,
  onVerify,
  evidenceReferenceId,
  onCopyEvidence,
}: ReproPackMetadataProps) {
  const truncatedSignature = signature ? `${signature.slice(0, 18)}…` : undefined;
  const evidenceId = verificationResult?.customerEvidenceId || evidenceReferenceId;
  const evidenceUrl = verificationResult?.evidenceUrl;

  return (
    <Card className="p-4 border-dashed border-primary/30 bg-primary/5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-card-foreground">Reproducibility Pack</h3>
            <Badge variant="outline" className="text-[10px]">{reproPackId}</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Content Hash</p>
                <p className="font-medium text-card-foreground">{reproPackHash || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ShieldHalf className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Signing Authority</p>
                <p className="font-medium text-card-foreground">{signingAuthority || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Signature</p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="font-medium text-card-foreground cursor-help">
                        {truncatedSignature || '—'}
                      </p>
                    </TooltipTrigger>
                    {signature && (
                      <TooltipContent>
                        <p className="font-mono text-xs max-w-xs break-all">{signature}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="font-medium text-card-foreground">
                  {createdAt ? createdAt.toLocaleString() : '—'}
                </p>
              </div>
            </div>
          </div>

          {verificationResult && (
            <div className="flex flex-col gap-2 p-3 bg-background border border-border rounded-md">
              <div className="flex items-center gap-2">
                {verificationResult.valid ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-destructive" />
                )}
                <p className="font-semibold text-card-foreground">
                  Signature {verificationResult.valid ? 'valid' : 'invalid'}
                </p>
                {verificationResult.signingAuthority && (
                  <Badge variant="outline" className="text-[10px]">
                    {verificationResult.signingAuthority}
                  </Badge>
                )}
              </div>
              {verificationResult.message && (
                <p className="text-xs text-muted-foreground">{verificationResult.message}</p>
              )}
              {evidenceId && (
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-primary" />
                  {evidenceUrl ? (
                    <a
                      href={evidenceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-primary underline"
                    >
                      Customer Evidence ID: {evidenceId}
                    </a>
                  ) : (
                    <Button
                      variant="link"
                      className="p-0 h-auto text-sm"
                      onClick={() => onCopyEvidence?.(evidenceId)}
                    >
                      Customer Evidence ID: {evidenceId}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 min-w-[180px]">
          <Button
            variant="outline"
            size="sm"
            className="justify-start"
            onClick={onDownload}
            disabled={isDownloading}
          >
            <FileJson className="w-4 h-4 mr-2" />
            {isDownloading ? 'Preparing JSON...' : 'Download JSON'}
          </Button>
          <Button
            size="sm"
            className="justify-start"
            onClick={onVerify}
            disabled={isVerifying}
          >
            <ShieldCheck className="w-4 h-4 mr-2" />
            {isVerifying ? 'Verifying...' : 'Verify Signature'}
          </Button>
          {!verificationResult && (
            <p className="text-xs text-muted-foreground">
              Verify the signing authority and surface a traceable evidence ID.
            </p>
          )}
          {verificationResult && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {verificationResult.valid ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-destructive" />
              )}
              <span>{verificationResult.valid ? 'Validated' : 'Validation failed'}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Download className="w-3 h-3" />
            <span>Re-run analysis using saved prompts and outputs.</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
