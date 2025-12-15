import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ReproPackVerificationResult } from '@/lib/api';
import { CalendarClock, CheckCircle2, Download, FileJson, Hash, Link as LinkIcon, Package, ShieldAlert, ShieldCheck, ShieldHalf, UploadCloud } from 'lucide-react';

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
  onUploadVerify?: () => void;
  evidenceReferenceId?: string;
  uploadedPackName?: string | null;
  verificationSource?: 'stored' | 'uploaded' | null;
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
  onUploadVerify,
  evidenceReferenceId,
  uploadedPackName,
  verificationSource,
  onCopyEvidence,
}: ReproPackMetadataProps) {
  const truncatedSignature = signature ? `${signature.slice(0, 18)}…` : undefined;
  const evidenceId = verificationResult?.customerEvidenceId || evidenceReferenceId;
  const evidenceUrl = verificationResult?.evidenceUrl;
  const verificationOrigin = verificationResult?.verificationSource ?? verificationSource ?? null;
  type ReplayInstructions = {
    test_suite?: {
      cases?: Array<{ id: string; heuristic_type?: string; version?: string }>;
      iterations?: number;
      iterations_run?: number;
    };
    model?: {
      provider?: string;
      model_name?: string;
      sampling_parameters?: Record<string, unknown>;
      determinism?: { mode?: string; seed?: number; achieved_level?: string };
    };
    detector?: { version?: string; heuristics?: string[] };
    evidence?: { reference_id?: string; storage_type?: string; link_hint?: string };
    metrics?: { confidence_intervals?: { overall_score?: [number, number]; heuristics?: Record<string, unknown> } };
  };

  const replayInstructions = verificationResult?.replayInstructions as ReplayInstructions | undefined;
  const iterationsRun = replayInstructions?.test_suite?.iterations_run;
  const determinism = replayInstructions?.model?.determinism;
  const overallConfidenceInterval = Array.isArray(replayInstructions?.metrics?.confidence_intervals?.overall_score)
    ? replayInstructions?.metrics?.confidence_intervals?.overall_score
    : undefined;

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
            <div className="flex flex-col gap-3 p-3 bg-background border border-border rounded-md">
              <div className="flex items-center gap-2 flex-wrap">
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
                {verificationOrigin && (
                  <Badge variant="secondary" className="text-[10px]">
                    {verificationOrigin === 'uploaded' ? 'Uploaded pack' : 'Stored pack'}
                  </Badge>
                )}
                {uploadedPackName && verificationOrigin === 'uploaded' && (
                  <Badge variant="outline" className="text-[10px]">
                    {uploadedPackName}
                  </Badge>
                )}
              </div>
              {verificationResult.message && (
                <p className="text-xs text-muted-foreground">{verificationResult.message}</p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck className={`w-4 h-4 ${verificationResult.signatureValid === false ? 'text-destructive' : 'text-green-600'}`} />
                  <span className="text-muted-foreground">
                    Signature {verificationResult.signatureValid === false ? 'mismatch' : 'validated'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Hash className={`w-4 h-4 ${verificationResult.hashMatches === false ? 'text-destructive' : 'text-primary'}`} />
                  <span className="text-muted-foreground">
                    Hash {verificationResult.hashMatches === false ? 'mismatch' : 'aligned'}
                  </span>
                </div>
              </div>

              {(verificationResult.computedHash || verificationResult.expectedHash) && (
                <div className="space-y-1 text-[10px] text-muted-foreground">
                  {verificationResult.expectedHash && (
                    <p className="font-mono break-all">Expected: {verificationResult.expectedHash}</p>
                  )}
                  {verificationResult.computedHash && (
                    <p className="font-mono break-all">Computed: {verificationResult.computedHash}</p>
                  )}
                </div>
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

              {replayInstructions && (
                <div className="rounded-md border border-dashed border-primary/30 bg-primary/5 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
                    <Package className="w-4 h-4 text-primary" />
                    Replay instructions embedded
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    {replayInstructions.detector?.version && (
                      <Badge variant="outline" className="text-[10px]">
                        Detector {replayInstructions.detector.version}
                      </Badge>
                    )}
                    {typeof replayInstructions.test_suite?.iterations === 'number' && (
                      <Badge variant="outline" className="text-[10px]">
                        {replayInstructions.test_suite.iterations} iterations
                      </Badge>
                    )}
                    {typeof iterationsRun === 'number' && (
                      <Badge variant="outline" className="text-[10px]">
                        {iterationsRun} iterations run
                      </Badge>
                    )}
                    {replayInstructions.model?.model_name && (
                      <Badge variant="outline" className="text-[10px]">
                        Model {replayInstructions.model.model_name}
                      </Badge>
                    )}
                    {determinism?.mode && (
                      <Badge variant="outline" className="text-[10px]">
                        Determinism: {determinism.mode}
                      </Badge>
                    )}
                    {typeof determinism?.seed === 'number' && (
                      <Badge variant="outline" className="text-[10px]">
                        Seed {determinism.seed}
                      </Badge>
                    )}
                    {determinism?.achieved_level && (
                      <Badge variant="outline" className="text-[10px]">
                        Achieved {determinism.achieved_level}
                      </Badge>
                    )}
                  </div>
                  {replayInstructions.test_suite?.cases && (
                    <p className="text-xs text-muted-foreground">
                      Test cases: {replayInstructions.test_suite.cases.map(tc => tc.id).join(', ')}
                    </p>
                  )}
                  {replayInstructions.model?.sampling_parameters && (
                    <p className="text-[11px] text-muted-foreground">
                      Sampling: {Object.entries(replayInstructions.model.sampling_parameters)
                        .map(([key, value]) => `${key}=${value}`)
                        .join(', ')}
                    </p>
                  )}
                  {overallConfidenceInterval && (
                    <p className="text-[11px] text-muted-foreground">
                      CI (overall score): {overallConfidenceInterval.map(value => `${value}`).join(' – ')}
                    </p>
                  )}
                  {replayInstructions.evidence?.reference_id && (
                    <p className="text-[11px] text-muted-foreground">
                      Evidence link: {replayInstructions.evidence.reference_id} ({replayInstructions.evidence.storage_type || 'unknown storage'})
                    </p>
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
          <Button
            variant="secondary"
            size="sm"
            className="justify-start"
            onClick={() => onUploadVerify?.()}
            disabled={isVerifying}
          >
            <UploadCloud className="w-4 h-4 mr-2" />
            Upload & Verify
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
