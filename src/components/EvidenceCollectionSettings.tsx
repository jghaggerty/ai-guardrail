import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Eye, EyeOff, Key, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';

type StorageType = 's3' | 'splunk' | 'elk';

interface EvidenceCollectionConfig {
  id?: string;
  storage_type: StorageType;
  is_enabled: boolean;
  configuration: Record<string, unknown>;
  last_tested_at: string | null;
}

const STORAGE_TYPES: { value: StorageType; label: string }[] = [
  { value: 's3', label: 'Amazon S3' },
  { value: 'splunk', label: 'Splunk' },
  { value: 'elk', label: 'ELK Stack (Elasticsearch)' },
];

// Validation functions
const validateUrl = (url: string): string | null => {
  if (!url.trim()) return 'URL is required';
  try {
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return 'URL must use http:// or https://';
    }
    return null;
  } catch {
    return 'Please enter a valid URL (e.g., https://example.com:8089)';
  }
};

const validateBucketName = (bucketName: string): string | null => {
  if (!bucketName.trim()) return 'Bucket name is required';
  // S3 bucket name rules: 3-63 characters, lowercase, numbers, hyphens, dots
  const bucketNameRegex = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
  if (!bucketNameRegex.test(bucketName)) {
    return 'Bucket name must be 3-63 characters, lowercase, and can contain letters, numbers, hyphens, and dots';
  }
  if (bucketName.includes('..') || bucketName.startsWith('.') || bucketName.endsWith('.')) {
    return 'Bucket name cannot contain consecutive dots or start/end with a dot';
  }
  return null;
};

const validateAwsRegion = (region: string): string | null => {
  if (!region.trim()) return 'Region is required';
  // AWS region format: us-east-1, eu-west-1, etc.
  const regionRegex = /^[a-z]{2}-[a-z]+-\d+$/;
  if (!regionRegex.test(region)) {
    return 'Please enter a valid AWS region (e.g., us-east-1, eu-west-1)';
  }
  return null;
};

const validateIamRoleArn = (arn: string): string | null => {
  if (!arn.trim()) return null; // Optional field
  // IAM role ARN format: arn:aws:iam::123456789012:role/RoleName
  const arnRegex = /^arn:aws:iam::\d{12}:role\/[\w+=,.@-]+$/;
  if (!arnRegex.test(arn)) {
    return 'Please enter a valid IAM role ARN (e.g., arn:aws:iam::123456789012:role/RoleName)';
  }
  return null;
};

const validateIndexName = (indexName: string): string | null => {
  if (!indexName.trim()) return 'Index name is required';
  // Index names: lowercase, alphanumeric, hyphens, underscores
  const indexRegex = /^[a-z0-9_-]+$/;
  if (!indexRegex.test(indexName)) {
    return 'Index name must contain only lowercase letters, numbers, hyphens, and underscores';
  }
  if (indexName.length > 255) {
    return 'Index name must be 255 characters or less';
  }
  return null;
};

const validateAccessKey = (accessKey: string): string | null => {
  if (!accessKey.trim()) return 'Access key is required';
  // AWS access keys start with AKIA and are 20 characters
  if (accessKey.length !== 20) {
    return 'Access key must be 20 characters';
  }
  if (!accessKey.startsWith('AKIA')) {
    return 'Access key must start with AKIA';
  }
  return null;
};

export function EvidenceCollectionSettings() {
  const { user } = useAuth();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [config, setConfig] = useState<EvidenceCollectionConfig | null>(null);

  // Form state
  const [isEnabled, setIsEnabled] = useState(false);
  const [storageType, setStorageType] = useState<StorageType>('s3');

  // S3 configuration state
  const [s3Config, setS3Config] = useState({
    bucketName: '',
    region: '',
    accessKey: '',
    secretKey: '',
    iamRoleArn: '',
  });
  const [showSecretKey, setShowSecretKey] = useState(false);

  // Splunk configuration state
  const [splunkConfig, setSplunkConfig] = useState({
    endpoint: '',
    authType: 'token' as 'token' | 'username-password',
    token: '',
    username: '',
    password: '',
    index: '',
  });
  const [showSplunkPassword, setShowSplunkPassword] = useState(false);

  // ELK configuration state
  const [elkConfig, setElkConfig] = useState({
    endpoint: '',
    authType: 'api-key' as 'api-key' | 'username-password',
    apiKey: '',
    username: '',
    password: '',
    index: '',
  });
  const [showElkPassword, setShowElkPassword] = useState(false);

  // Validation errors state
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Connection failure tracking
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [lastFailureTime, setLastFailureTime] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      if (!user) return;

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('team_id')
          .eq('id', user.id)
          .single();

        if (profile?.team_id) {
          setTeamId(profile.team_id);

          // Fetch evidence collection configuration
          const { data: evidenceConfig } = await supabase
            .from('evidence_collection_configs')
            .select('*')
            .eq('team_id', profile.team_id)
            .single();

          if (evidenceConfig) {
            setConfig(evidenceConfig as EvidenceCollectionConfig);
            setIsEnabled(evidenceConfig.is_enabled);
            setStorageType(evidenceConfig.storage_type);
            
            // Reset failure tracking when loading existing config
            // (failures are tracked per session, not persisted)
            setConsecutiveFailures(0);
            setLastFailureTime(null);
            
            // Reset failure tracking when loading existing config
            // (failures are tracked per session, not persisted)
            setConsecutiveFailures(0);
            setLastFailureTime(null);

            // Load storage-specific configuration if available
            if (evidenceConfig.configuration) {
              const storageConfig = evidenceConfig.configuration as Record<string, unknown>;
              
              if (evidenceConfig.storage_type === 's3') {
                setS3Config({
                  bucketName: (storageConfig.bucketName as string) || '',
                  region: (storageConfig.region as string) || '',
                  accessKey: (storageConfig.accessKey as string) || '',
                  secretKey: (storageConfig.secretKey as string) || '',
                  iamRoleArn: (storageConfig.iamRoleArn as string) || '',
                });
              } else if (evidenceConfig.storage_type === 'splunk') {
                setSplunkConfig({
                  endpoint: (storageConfig.endpoint as string) || '',
                  authType: (storageConfig.authType as 'token' | 'username-password') || 'token',
                  token: (storageConfig.token as string) || '',
                  username: (storageConfig.username as string) || '',
                  password: (storageConfig.password as string) || '',
                  index: (storageConfig.index as string) || '',
                });
              } else if (evidenceConfig.storage_type === 'elk') {
                setElkConfig({
                  endpoint: (storageConfig.endpoint as string) || '',
                  authType: (storageConfig.authType as 'api-key' | 'username-password') || 'api-key',
                  apiKey: (storageConfig.apiKey as string) || '',
                  username: (storageConfig.username as string) || '',
                  password: (storageConfig.password as string) || '',
                  index: (storageConfig.index as string) || '',
                });
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching evidence collection config:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [user]);

  // Check if configuration is incomplete
  const isConfigurationIncomplete = (): { incomplete: boolean; warnings: string[] } => {
    const warnings: string[] = [];

    if (!isEnabled) {
      return { incomplete: false, warnings: [] };
    }

    // Check if storage type is selected
    if (!storageType) {
      warnings.push('Please select a storage type');
      return { incomplete: true, warnings };
    }

    // Check for missing required fields based on storage type
    if (storageType === 's3') {
      if (!s3Config.bucketName.trim()) warnings.push('S3 bucket name is required');
      if (!s3Config.region.trim()) warnings.push('AWS region is required');
      if (!s3Config.accessKey.trim()) warnings.push('Access key ID is required');
      if (!s3Config.secretKey.trim()) warnings.push('Secret access key is required');
    } else if (storageType === 'splunk') {
      if (!splunkConfig.endpoint.trim()) warnings.push('Splunk endpoint URL is required');
      if (!splunkConfig.index.trim()) warnings.push('Splunk index name is required');
      if (splunkConfig.authType === 'token' && !splunkConfig.token.trim()) {
        warnings.push('Splunk authentication token is required');
      } else if (splunkConfig.authType === 'username-password') {
        if (!splunkConfig.username.trim()) warnings.push('Splunk username is required');
        if (!splunkConfig.password.trim()) warnings.push('Splunk password is required');
      }
    } else if (storageType === 'elk') {
      if (!elkConfig.endpoint.trim()) warnings.push('Elasticsearch endpoint URL is required');
      if (!elkConfig.index.trim()) warnings.push('Elasticsearch index name is required');
      if (elkConfig.authType === 'api-key' && !elkConfig.apiKey.trim()) {
        warnings.push('Elasticsearch API key is required');
      } else if (elkConfig.authType === 'username-password') {
        if (!elkConfig.username.trim()) warnings.push('Elasticsearch username is required');
        if (!elkConfig.password.trim()) warnings.push('Elasticsearch password is required');
      }
    }

    // Check for validation errors
    if (Object.keys(errors).length > 0) {
      warnings.push('Please fix validation errors in the form');
    }

    return { incomplete: warnings.length > 0, warnings };
  };

  // Validation function
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!isEnabled) {
      setErrors({});
      return true; // No validation needed if disabled
    }

    if (storageType === 's3') {
      const bucketError = validateBucketName(s3Config.bucketName);
      if (bucketError) newErrors['s3-bucketName'] = bucketError;

      const regionError = validateAwsRegion(s3Config.region);
      if (regionError) newErrors['s3-region'] = regionError;

      const accessKeyError = validateAccessKey(s3Config.accessKey);
      if (accessKeyError) newErrors['s3-accessKey'] = accessKeyError;

      if (!s3Config.secretKey.trim()) {
        newErrors['s3-secretKey'] = 'Secret key is required';
      }

      const iamRoleError = validateIamRoleArn(s3Config.iamRoleArn);
      if (iamRoleError) newErrors['s3-iamRoleArn'] = iamRoleError;
    } else if (storageType === 'splunk') {
      const endpointError = validateUrl(splunkConfig.endpoint);
      if (endpointError) newErrors['splunk-endpoint'] = endpointError;

      const indexError = validateIndexName(splunkConfig.index);
      if (indexError) newErrors['splunk-index'] = indexError;

      if (splunkConfig.authType === 'token') {
        if (!splunkConfig.token.trim()) {
          newErrors['splunk-token'] = 'Token is required';
        }
      } else {
        if (!splunkConfig.username.trim()) {
          newErrors['splunk-username'] = 'Username is required';
        }
        if (!splunkConfig.password.trim()) {
          newErrors['splunk-password'] = 'Password is required';
        }
      }
    } else if (storageType === 'elk') {
      const endpointError = validateUrl(elkConfig.endpoint);
      if (endpointError) newErrors['elk-endpoint'] = endpointError;

      const indexError = validateIndexName(elkConfig.index);
      if (indexError) newErrors['elk-index'] = indexError;

      if (elkConfig.authType === 'api-key') {
        if (!elkConfig.apiKey.trim()) {
          newErrors['elk-apiKey'] = 'API key is required';
        }
      } else {
        if (!elkConfig.username.trim()) {
          newErrors['elk-username'] = 'Username is required';
        }
        if (!elkConfig.password.trim()) {
          newErrors['elk-password'] = 'Password is required';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!teamId || !user) return;

    // Validate form before saving
    if (!validateForm()) {
      toast.error('Please fix validation errors before saving');
      return;
    }

    setSaving(true);
    try {
      // Build configuration object based on storage type
      let configuration: Record<string, unknown> = {};
      
      if (storageType === 's3') {
        configuration = {
          bucketName: s3Config.bucketName,
          region: s3Config.region,
          accessKey: s3Config.accessKey,
          secretKey: s3Config.secretKey,
          iamRoleArn: s3Config.iamRoleArn || undefined,
        };
      } else if (storageType === 'splunk') {
        configuration = {
          endpoint: splunkConfig.endpoint,
          authType: splunkConfig.authType,
          index: splunkConfig.index,
          ...(splunkConfig.authType === 'token'
            ? { token: splunkConfig.token }
            : {
                username: splunkConfig.username,
                password: splunkConfig.password,
              }),
        };
      } else if (storageType === 'elk') {
        configuration = {
          endpoint: elkConfig.endpoint,
          authType: elkConfig.authType,
          index: elkConfig.index,
          ...(elkConfig.authType === 'api-key'
            ? { apiKey: elkConfig.apiKey }
            : {
                username: elkConfig.username,
                password: elkConfig.password,
              }),
        };
      }

      const configData = {
        team_id: teamId,
        storage_type: storageType,
        is_enabled: isEnabled,
        configuration,
        updated_at: new Date().toISOString(),
      };

      if (config?.id) {
        // Update existing config
        const { error } = await supabase
          .from('evidence_collection_configs')
          .update(configData)
          .eq('id', config.id);

        if (error) throw error;
        setErrors({}); // Clear errors on successful save
        toast.success('Evidence collection configuration updated');
      } else {
        // Create new config
        const { data, error } = await supabase
          .from('evidence_collection_configs')
          .insert(configData)
          .select()
          .single();

        if (error) throw error;
        setConfig(data as EvidenceCollectionConfig);
        setErrors({}); // Clear errors on successful save
        toast.success('Evidence collection configuration saved');
      }
    } catch (error) {
      console.error('Error saving evidence collection config:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!config?.id || !isEnabled) {
      toast.error('Please save your configuration before testing');
      return;
    }

    setTestingConnection(true);
    try {
      const response = await supabase.functions.invoke('test-evidence-connection', {
        body: { configId: config.id }
      });

      if (response.error) throw response.error;

      const result = response.data;
      if (result.success) {
        toast.success('Connection test successful!');

        // Reset failure tracking on success
        setConsecutiveFailures(0);
        setLastFailureTime(null);

        // Update last_tested_at in local state and database
        const updatedConfig = {
          ...config,
          last_tested_at: new Date().toISOString(),
        };
        setConfig(updatedConfig);

        // Update in database
        await supabase
          .from('evidence_collection_configs')
          .update({ last_tested_at: new Date().toISOString() })
          .eq('id', config.id);
      } else {
        // Connection test failed - track failures
        const failureCount = consecutiveFailures + 1;
        setConsecutiveFailures(failureCount);
        setLastFailureTime(new Date().toISOString());
        
        const errorMsg = result.message || 'Unknown error';
        toast.error(`Connection test failed: ${errorMsg}`, {
          description: 'Please check your configuration and credentials.',
        });
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to test connection';
      
      // Track failures
      const failureCount = consecutiveFailures + 1;
      setConsecutiveFailures(failureCount);
      setLastFailureTime(new Date().toISOString());
      
      toast.error(`Connection test failed: ${errorMessage}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleDisableCollectorMode = async () => {
    if (!config?.id || !teamId) return;

    try {
      const { error } = await supabase
        .from('evidence_collection_configs')
        .update({ 
          is_enabled: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', config.id);

      if (error) throw error;

      setIsEnabled(false);
      setConsecutiveFailures(0);
      setLastFailureTime(null);
      toast.success('Collector mode has been disabled due to persistent connection failures');
    } catch (error) {
      console.error('Error disabling collector mode:', error);
      toast.error('Failed to disable collector mode');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evidence Collection Configuration</CardTitle>
        <CardDescription>
          Configure customer-side evidence storage for evaluation runs. When enabled, raw prompts and outputs
          will be stored in your storage system instead of BiasLens.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg border border-border">
          <div className="space-y-0.5 flex-1">
            <div className="flex items-center gap-2">
              <Label htmlFor="collector-mode" className="text-base font-semibold">
                Collector Mode
              </Label>
              {isEnabled && isConfigurationIncomplete().incomplete && (
                <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Incomplete
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Enable to store evidence in your own storage system
            </p>
          </div>
          <Switch
            id="collector-mode"
            checked={isEnabled}
            onCheckedChange={setIsEnabled}
          />
        </div>

        {/* Warning Indicator - Show when enabled but not properly configured */}
        {isEnabled && (() => {
          const { incomplete, warnings } = isConfigurationIncomplete();
          
          // Show persistent failure warning if there are 3+ consecutive failures
          if (consecutiveFailures >= 3 && config?.id) {
            return (
              <Alert variant="destructive" className="border-red-500 bg-red-50 dark:bg-red-950/20">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <AlertTitle className="text-red-900 dark:text-red-100">Persistent Connection Failures</AlertTitle>
                <AlertDescription className="text-red-800 dark:text-red-200">
                  <p className="mb-3">
                    Connection test has failed {consecutiveFailures} time{consecutiveFailures > 1 ? 's' : ''} in a row.
                    {lastFailureTime && (
                      <span className="block text-xs mt-1">
                        Last failure: {new Date(lastFailureTime).toLocaleString()}
                      </span>
                    )}
                  </p>
                  <p className="mb-3">
                    This may indicate a configuration issue, network problem, or authentication failure. 
                    Please verify your credentials and network connectivity.
                  </p>
                  <div className="flex items-center gap-2 mt-4">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDisableCollectorMode}
                    >
                      Disable Collector Mode
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setConsecutiveFailures(0);
                        setLastFailureTime(null);
                      }}
                    >
                      Dismiss Warning
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            );
          }
          
          if (!incomplete && config?.id && !config.last_tested_at) {
            // Show warning if config is saved but not tested
            return (
              <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                <AlertTitle className="text-amber-900 dark:text-amber-100">Configuration Not Tested</AlertTitle>
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  Your configuration is saved but hasn't been tested. Click "Test Connection" to verify connectivity before running evaluations.
                </AlertDescription>
              </Alert>
            );
          }
          if (incomplete) {
            return (
              <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                <AlertTitle className="text-amber-900 dark:text-amber-100">Configuration Incomplete</AlertTitle>
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    {warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                  <p className="mt-2">Please complete all required fields to enable evidence collection.</p>
                </AlertDescription>
              </Alert>
            );
          }
          return null;
        })()}

        {/* Storage Type Selector - Only show when enabled */}
        {isEnabled && (
          <div className="space-y-2">
            <Label htmlFor="storage-type">Storage Type</Label>
            <Select
              value={storageType}
              onValueChange={(value) => {
                const newType = value as StorageType;
                setStorageType(newType);
                // Clear errors when switching storage types
                setErrors({});
                // Reset configs when switching storage types
                if (newType !== 's3') {
                  setS3Config({
                    bucketName: '',
                    region: '',
                    accessKey: '',
                    secretKey: '',
                    iamRoleArn: '',
                  });
                }
                if (newType !== 'splunk') {
                  setSplunkConfig({
                    endpoint: '',
                    authType: 'token',
                    token: '',
                    username: '',
                    password: '',
                    index: '',
                  });
                }
                if (newType !== 'elk') {
                  setElkConfig({
                    endpoint: '',
                    authType: 'api-key',
                    apiKey: '',
                    username: '',
                    password: '',
                    index: '',
                  });
                }
              }}
            >
              <SelectTrigger id="storage-type">
                <SelectValue placeholder="Select storage type" />
              </SelectTrigger>
              <SelectContent>
                {STORAGE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose the storage system where evidence will be stored
            </p>
          </div>
        )}

        {/* S3 Configuration Form */}
        {isEnabled && storageType === 's3' && (
          <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm font-medium">S3 Configuration</Label>
            </div>

            <div className="space-y-4">
              {/* Bucket Name */}
              <div className="space-y-2">
                <Label htmlFor="s3-bucket-name">Bucket Name *</Label>
                <Input
                  id="s3-bucket-name"
                  placeholder="my-evidence-bucket"
                  value={s3Config.bucketName}
                  onChange={(e) => {
                    setS3Config(prev => ({ ...prev, bucketName: e.target.value }));
                    // Clear error when user types
                    if (errors['s3-bucketName']) {
                      setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors['s3-bucketName'];
                        return newErrors;
                      });
                    }
                  }}
                  onBlur={() => {
                    const error = validateBucketName(s3Config.bucketName);
                    if (error) {
                      setErrors(prev => ({ ...prev, 's3-bucketName': error }));
                    } else {
                      setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors['s3-bucketName'];
                        return newErrors;
                      });
                    }
                  }}
                  className={errors['s3-bucketName'] ? 'border-destructive' : ''}
                />
                {errors['s3-bucketName'] && (
                  <p className="text-xs text-destructive">{errors['s3-bucketName']}</p>
                )}
                {!errors['s3-bucketName'] && (
                  <p className="text-xs text-muted-foreground">
                    The S3 bucket where evidence will be stored
                  </p>
                )}
              </div>

              {/* Region */}
              <div className="space-y-2">
                <Label htmlFor="s3-region">Region *</Label>
                <Input
                  id="s3-region"
                  placeholder="us-east-1"
                  value={s3Config.region}
                  onChange={(e) => {
                    setS3Config(prev => ({ ...prev, region: e.target.value }));
                    if (errors['s3-region']) {
                      setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors['s3-region'];
                        return newErrors;
                      });
                    }
                  }}
                  onBlur={() => {
                    const error = validateAwsRegion(s3Config.region);
                    if (error) {
                      setErrors(prev => ({ ...prev, 's3-region': error }));
                    } else {
                      setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors['s3-region'];
                        return newErrors;
                      });
                    }
                  }}
                  className={errors['s3-region'] ? 'border-destructive' : ''}
                />
                {errors['s3-region'] && (
                  <p className="text-xs text-destructive">{errors['s3-region']}</p>
                )}
                {!errors['s3-region'] && (
                  <p className="text-xs text-muted-foreground">
                    AWS region where the bucket is located (e.g., us-east-1, eu-west-1)
                  </p>
                )}
              </div>

              {/* Access Key */}
              <div className="space-y-2">
                <Label htmlFor="s3-access-key">Access Key ID *</Label>
                <Input
                  id="s3-access-key"
                  placeholder="AKIAIOSFODNN7EXAMPLE"
                  value={s3Config.accessKey}
                  onChange={(e) => {
                    setS3Config(prev => ({ ...prev, accessKey: e.target.value }));
                    if (errors['s3-accessKey']) {
                      setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors['s3-accessKey'];
                        return newErrors;
                      });
                    }
                  }}
                  onBlur={() => {
                    const error = validateAccessKey(s3Config.accessKey);
                    if (error) {
                      setErrors(prev => ({ ...prev, 's3-accessKey': error }));
                    } else {
                      setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors['s3-accessKey'];
                        return newErrors;
                      });
                    }
                  }}
                  className={errors['s3-accessKey'] ? 'border-destructive' : ''}
                />
                {errors['s3-accessKey'] && (
                  <p className="text-xs text-destructive">{errors['s3-accessKey']}</p>
                )}
                {!errors['s3-accessKey'] && (
                  <p className="text-xs text-muted-foreground">
                    AWS access key ID with permissions to write to the bucket
                  </p>
                )}
              </div>

              {/* Secret Key */}
              <div className="space-y-2">
                <Label htmlFor="s3-secret-key" className="flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Secret Access Key *
                </Label>
                <div className="relative">
                  <Input
                    id="s3-secret-key"
                    type={showSecretKey ? 'text' : 'password'}
                    placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                    value={s3Config.secretKey}
                    onChange={(e) => {
                      setS3Config(prev => ({ ...prev, secretKey: e.target.value }));
                      if (errors['s3-secretKey']) {
                        setErrors(prev => {
                          const newErrors = { ...prev };
                          delete newErrors['s3-secretKey'];
                          return newErrors;
                        });
                      }
                    }}
                    onBlur={() => {
                      if (!s3Config.secretKey.trim()) {
                        setErrors(prev => ({ ...prev, 's3-secretKey': 'Secret key is required' }));
                      } else {
                        setErrors(prev => {
                          const newErrors = { ...prev };
                          delete newErrors['s3-secretKey'];
                          return newErrors;
                        });
                      }
                    }}
                    className={`pr-10 ${errors['s3-secretKey'] ? 'border-destructive' : ''}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowSecretKey(!showSecretKey)}
                  >
                    {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                {errors['s3-secretKey'] && (
                  <p className="text-xs text-destructive">{errors['s3-secretKey']}</p>
                )}
                {!errors['s3-secretKey'] && (
                  <p className="text-xs text-muted-foreground">
                    AWS secret access key (will be encrypted before storage)
                  </p>
                )}
              </div>

              {/* IAM Role ARN (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="s3-iam-role">IAM Role ARN (Optional)</Label>
                <Input
                  id="s3-iam-role"
                  placeholder="arn:aws:iam::123456789012:role/EvidenceCollectionRole"
                  value={s3Config.iamRoleArn}
                  onChange={(e) => {
                    setS3Config(prev => ({ ...prev, iamRoleArn: e.target.value }));
                    if (errors['s3-iamRoleArn']) {
                      setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors['s3-iamRoleArn'];
                        return newErrors;
                      });
                    }
                  }}
                  onBlur={() => {
                    const error = validateIamRoleArn(s3Config.iamRoleArn);
                    if (error) {
                      setErrors(prev => ({ ...prev, 's3-iamRoleArn': error }));
                    } else {
                      setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors['s3-iamRoleArn'];
                        return newErrors;
                      });
                    }
                  }}
                  className={errors['s3-iamRoleArn'] ? 'border-destructive' : ''}
                />
                {errors['s3-iamRoleArn'] && (
                  <p className="text-xs text-destructive">{errors['s3-iamRoleArn']}</p>
                )}
                {!errors['s3-iamRoleArn'] && (
                  <p className="text-xs text-muted-foreground">
                    Optional IAM role ARN for role-based authentication instead of access keys
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Splunk Configuration Form */}
        {isEnabled && storageType === 'splunk' && (
          <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Splunk Configuration</Label>
            </div>

            <div className="space-y-4">
              {/* Endpoint URL */}
              <div className="space-y-2">
                <Label htmlFor="splunk-endpoint">Endpoint URL *</Label>
                <Input
                  id="splunk-endpoint"
                  type="url"
                  placeholder="https://splunk.example.com:8089"
                  value={splunkConfig.endpoint}
                  onChange={(e) => {
                    setSplunkConfig(prev => ({ ...prev, endpoint: e.target.value }));
                    if (errors['splunk-endpoint']) {
                      setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors['splunk-endpoint'];
                        return newErrors;
                      });
                    }
                  }}
                  onBlur={() => {
                    const error = validateUrl(splunkConfig.endpoint);
                    if (error) {
                      setErrors(prev => ({ ...prev, 'splunk-endpoint': error }));
                    } else {
                      setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors['splunk-endpoint'];
                        return newErrors;
                      });
                    }
                  }}
                  className={errors['splunk-endpoint'] ? 'border-destructive' : ''}
                />
                {errors['splunk-endpoint'] && (
                  <p className="text-xs text-destructive">{errors['splunk-endpoint']}</p>
                )}
                {!errors['splunk-endpoint'] && (
                  <p className="text-xs text-muted-foreground">
                    Splunk REST API endpoint URL (e.g., https://splunk.example.com:8089)
                  </p>
                )}
              </div>

              {/* Authentication Type */}
              <div className="space-y-2">
                <Label htmlFor="splunk-auth-type">Authentication Type *</Label>
                <Select
                  value={splunkConfig.authType}
                  onValueChange={(value) => setSplunkConfig(prev => ({ 
                    ...prev, 
                    authType: value as 'token' | 'username-password',
                    // Clear auth fields when switching types
                    token: '',
                    username: '',
                    password: '',
                  }))}
                >
                  <SelectTrigger id="splunk-auth-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="token">Token</SelectItem>
                    <SelectItem value="username-password">Username & Password</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose how to authenticate with Splunk
                </p>
              </div>

              {/* Token Authentication */}
              {splunkConfig.authType === 'token' && (
                <div className="space-y-2">
                  <Label htmlFor="splunk-token" className="flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    Authentication Token *
                  </Label>
                  <div className="relative">
                    <Input
                      id="splunk-token"
                      type={showSplunkPassword ? 'text' : 'password'}
                      placeholder="Enter Splunk authentication token"
                      value={splunkConfig.token}
                      onChange={(e) => {
                        setSplunkConfig(prev => ({ ...prev, token: e.target.value }));
                        if (errors['splunk-token']) {
                          setErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors['splunk-token'];
                            return newErrors;
                          });
                        }
                      }}
                      onBlur={() => {
                        if (!splunkConfig.token.trim()) {
                          setErrors(prev => ({ ...prev, 'splunk-token': 'Token is required' }));
                        } else {
                          setErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors['splunk-token'];
                            return newErrors;
                          });
                        }
                      }}
                      className={`pr-10 ${errors['splunk-token'] ? 'border-destructive' : ''}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowSplunkPassword(!showSplunkPassword)}
                    >
                      {showSplunkPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  {errors['splunk-token'] && (
                    <p className="text-xs text-destructive">{errors['splunk-token']}</p>
                  )}
                  {!errors['splunk-token'] && (
                    <p className="text-xs text-muted-foreground">
                      Splunk authentication token (will be encrypted before storage)
                    </p>
                  )}
                </div>
              )}

              {/* Username/Password Authentication */}
              {splunkConfig.authType === 'username-password' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="splunk-username">Username *</Label>
                    <Input
                      id="splunk-username"
                      placeholder="splunk_user"
                      value={splunkConfig.username}
                      onChange={(e) => {
                        setSplunkConfig(prev => ({ ...prev, username: e.target.value }));
                        if (errors['splunk-username']) {
                          setErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors['splunk-username'];
                            return newErrors;
                          });
                        }
                      }}
                      onBlur={() => {
                        if (!splunkConfig.username.trim()) {
                          setErrors(prev => ({ ...prev, 'splunk-username': 'Username is required' }));
                        } else {
                          setErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors['splunk-username'];
                            return newErrors;
                          });
                        }
                      }}
                      className={errors['splunk-username'] ? 'border-destructive' : ''}
                    />
                    {errors['splunk-username'] && (
                      <p className="text-xs text-destructive">{errors['splunk-username']}</p>
                    )}
                    {!errors['splunk-username'] && (
                      <p className="text-xs text-muted-foreground">
                        Splunk username with permissions to write to the index
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="splunk-password" className="flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      Password *
                    </Label>
                    <div className="relative">
                      <Input
                        id="splunk-password"
                        type={showSplunkPassword ? 'text' : 'password'}
                        placeholder="Enter Splunk password"
                        value={splunkConfig.password}
                        onChange={(e) => {
                          setSplunkConfig(prev => ({ ...prev, password: e.target.value }));
                          if (errors['splunk-password']) {
                            setErrors(prev => {
                              const newErrors = { ...prev };
                              delete newErrors['splunk-password'];
                              return newErrors;
                            });
                          }
                        }}
                        onBlur={() => {
                          if (!splunkConfig.password.trim()) {
                            setErrors(prev => ({ ...prev, 'splunk-password': 'Password is required' }));
                          } else {
                            setErrors(prev => {
                              const newErrors = { ...prev };
                              delete newErrors['splunk-password'];
                              return newErrors;
                            });
                          }
                        }}
                        className={`pr-10 ${errors['splunk-password'] ? 'border-destructive' : ''}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowSplunkPassword(!showSplunkPassword)}
                      >
                        {showSplunkPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                    {errors['splunk-password'] && (
                      <p className="text-xs text-destructive">{errors['splunk-password']}</p>
                    )}
                    {!errors['splunk-password'] && (
                      <p className="text-xs text-muted-foreground">
                        Splunk password (will be encrypted before storage)
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Index Name */}
              <div className="space-y-2">
                <Label htmlFor="splunk-index">Index Name *</Label>
                <Input
                  id="splunk-index"
                  placeholder="evidence_index"
                  value={splunkConfig.index}
                  onChange={(e) => {
                    setSplunkConfig(prev => ({ ...prev, index: e.target.value }));
                    if (errors['splunk-index']) {
                      setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors['splunk-index'];
                        return newErrors;
                      });
                    }
                  }}
                  onBlur={() => {
                    const error = validateIndexName(splunkConfig.index);
                    if (error) {
                      setErrors(prev => ({ ...prev, 'splunk-index': error }));
                    } else {
                      setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors['splunk-index'];
                        return newErrors;
                      });
                    }
                  }}
                  className={errors['splunk-index'] ? 'border-destructive' : ''}
                />
                {errors['splunk-index'] && (
                  <p className="text-xs text-destructive">{errors['splunk-index']}</p>
                )}
                {!errors['splunk-index'] && (
                  <p className="text-xs text-muted-foreground">
                    Splunk index where evidence will be stored
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ELK Configuration Form */}
        {isEnabled && storageType === 'elk' && (
          <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm font-medium">ELK Configuration</Label>
            </div>

            <div className="space-y-4">
              {/* Endpoint URL */}
              <div className="space-y-2">
                <Label htmlFor="elk-endpoint">Endpoint URL *</Label>
                <Input
                  id="elk-endpoint"
                  type="url"
                  placeholder="https://elasticsearch.example.com:9200"
                  value={elkConfig.endpoint}
                  onChange={(e) => {
                    setElkConfig(prev => ({ ...prev, endpoint: e.target.value }));
                    if (errors['elk-endpoint']) {
                      setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors['elk-endpoint'];
                        return newErrors;
                      });
                    }
                  }}
                  onBlur={() => {
                    const error = validateUrl(elkConfig.endpoint);
                    if (error) {
                      setErrors(prev => ({ ...prev, 'elk-endpoint': error }));
                    } else {
                      setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors['elk-endpoint'];
                        return newErrors;
                      });
                    }
                  }}
                  className={errors['elk-endpoint'] ? 'border-destructive' : ''}
                />
                {errors['elk-endpoint'] && (
                  <p className="text-xs text-destructive">{errors['elk-endpoint']}</p>
                )}
                {!errors['elk-endpoint'] && (
                  <p className="text-xs text-muted-foreground">
                    Elasticsearch endpoint URL (e.g., https://elasticsearch.example.com:9200)
                  </p>
                )}
              </div>

              {/* Authentication Type */}
              <div className="space-y-2">
                <Label htmlFor="elk-auth-type">Authentication Type *</Label>
                <Select
                  value={elkConfig.authType}
                  onValueChange={(value) => setElkConfig(prev => ({ 
                    ...prev, 
                    authType: value as 'api-key' | 'username-password',
                    // Clear auth fields when switching types
                    apiKey: '',
                    username: '',
                    password: '',
                  }))}
                >
                  <SelectTrigger id="elk-auth-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="api-key">API Key</SelectItem>
                    <SelectItem value="username-password">Username & Password</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose how to authenticate with Elasticsearch
                </p>
              </div>

              {/* API Key Authentication */}
              {elkConfig.authType === 'api-key' && (
                <div className="space-y-2">
                  <Label htmlFor="elk-api-key" className="flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    API Key *
                  </Label>
                  <div className="relative">
                    <Input
                      id="elk-api-key"
                      type={showElkPassword ? 'text' : 'password'}
                      placeholder="Enter Elasticsearch API key"
                      value={elkConfig.apiKey}
                      onChange={(e) => {
                        setElkConfig(prev => ({ ...prev, apiKey: e.target.value }));
                        if (errors['elk-apiKey']) {
                          setErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors['elk-apiKey'];
                            return newErrors;
                          });
                        }
                      }}
                      onBlur={() => {
                        if (!elkConfig.apiKey.trim()) {
                          setErrors(prev => ({ ...prev, 'elk-apiKey': 'API key is required' }));
                        } else {
                          setErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors['elk-apiKey'];
                            return newErrors;
                          });
                        }
                      }}
                      className={`pr-10 ${errors['elk-apiKey'] ? 'border-destructive' : ''}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowElkPassword(!showElkPassword)}
                    >
                      {showElkPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  {errors['elk-apiKey'] && (
                    <p className="text-xs text-destructive">{errors['elk-apiKey']}</p>
                  )}
                  {!errors['elk-apiKey'] && (
                    <p className="text-xs text-muted-foreground">
                      Elasticsearch API key (will be encrypted before storage)
                    </p>
                  )}
                </div>
              )}

              {/* Username/Password Authentication */}
              {elkConfig.authType === 'username-password' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="elk-username">Username *</Label>
                    <Input
                      id="elk-username"
                      placeholder="elastic"
                      value={elkConfig.username}
                      onChange={(e) => {
                        setElkConfig(prev => ({ ...prev, username: e.target.value }));
                        if (errors['elk-username']) {
                          setErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors['elk-username'];
                            return newErrors;
                          });
                        }
                      }}
                      onBlur={() => {
                        if (!elkConfig.username.trim()) {
                          setErrors(prev => ({ ...prev, 'elk-username': 'Username is required' }));
                        } else {
                          setErrors(prev => {
                            const newErrors = { ...prev };
                            delete newErrors['elk-username'];
                            return newErrors;
                          });
                        }
                      }}
                      className={errors['elk-username'] ? 'border-destructive' : ''}
                    />
                    {errors['elk-username'] && (
                      <p className="text-xs text-destructive">{errors['elk-username']}</p>
                    )}
                    {!errors['elk-username'] && (
                      <p className="text-xs text-muted-foreground">
                        Elasticsearch username with permissions to write to the index
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="elk-password" className="flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      Password *
                    </Label>
                    <div className="relative">
                      <Input
                        id="elk-password"
                        type={showElkPassword ? 'text' : 'password'}
                        placeholder="Enter Elasticsearch password"
                        value={elkConfig.password}
                        onChange={(e) => {
                          setElkConfig(prev => ({ ...prev, password: e.target.value }));
                          if (errors['elk-password']) {
                            setErrors(prev => {
                              const newErrors = { ...prev };
                              delete newErrors['elk-password'];
                              return newErrors;
                            });
                          }
                        }}
                        onBlur={() => {
                          if (!elkConfig.password.trim()) {
                            setErrors(prev => ({ ...prev, 'elk-password': 'Password is required' }));
                          } else {
                            setErrors(prev => {
                              const newErrors = { ...prev };
                              delete newErrors['elk-password'];
                              return newErrors;
                            });
                          }
                        }}
                        className={`pr-10 ${errors['elk-password'] ? 'border-destructive' : ''}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowElkPassword(!showElkPassword)}
                      >
                        {showElkPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                    {errors['elk-password'] && (
                      <p className="text-xs text-destructive">{errors['elk-password']}</p>
                    )}
                    {!errors['elk-password'] && (
                      <p className="text-xs text-muted-foreground">
                        Elasticsearch password (will be encrypted before storage)
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Index Name */}
              <div className="space-y-2">
                <Label htmlFor="elk-index">Index Name *</Label>
                <Input
                  id="elk-index"
                  placeholder="evidence-index"
                  value={elkConfig.index}
                  onChange={(e) => {
                    setElkConfig(prev => ({ ...prev, index: e.target.value }));
                    if (errors['elk-index']) {
                      setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors['elk-index'];
                        return newErrors;
                      });
                    }
                  }}
                  onBlur={() => {
                    const error = validateIndexName(elkConfig.index);
                    if (error) {
                      setErrors(prev => ({ ...prev, 'elk-index': error }));
                    } else {
                      setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors['elk-index'];
                        return newErrors;
                      });
                    }
                  }}
                  className={errors['elk-index'] ? 'border-destructive' : ''}
                />
                {errors['elk-index'] && (
                  <p className="text-xs text-destructive">{errors['elk-index']}</p>
                )}
                {!errors['elk-index'] && (
                  <p className="text-xs text-muted-foreground">
                    Elasticsearch index where evidence will be stored
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Connection Status Indicator */}
        {isEnabled && (
          <div className="p-4 rounded-lg border border-border bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {testingConnection ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <div>
                      <span className="text-sm font-semibold text-card-foreground">Testing Connection</span>
                      <p className="text-xs text-muted-foreground">Verifying connectivity to {storageType.toUpperCase()}...</p>
                    </div>
                  </>
                ) : config?.last_tested_at ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <div>
                      <span className="text-sm font-semibold text-card-foreground">Connected</span>
                      <p className="text-xs text-muted-foreground">
                        Last tested {new Date(config.last_tested_at).toLocaleDateString()} at {new Date(config.last_tested_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-amber-500" />
                    <div>
                      <span className="text-sm font-semibold text-card-foreground">Not Connected</span>
                      <p className="text-xs text-muted-foreground">
                        {config?.id 
                          ? 'Connection has not been tested. Click "Test Connection" to verify.'
                          : 'Save your configuration and test the connection to verify connectivity.'}
                      </p>
                    </div>
                  </>
                )}
              </div>
              {!testingConnection && (
                <Badge 
                  variant={config?.last_tested_at ? 'default' : 'destructive'}
                  className="flex items-center gap-1"
                >
                  {config?.last_tested_at ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      Connected
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3 h-3" />
                      Disconnected
                    </>
                  )}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-4">
          {/* Test Connection Button */}
          {isEnabled && config?.id && (
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={
                testingConnection || 
                saving ||
                !isEnabled || 
                !config?.id ||
                (storageType === 's3' && (!s3Config.bucketName || !s3Config.region || !s3Config.accessKey || !s3Config.secretKey)) ||
                (storageType === 'splunk' && (
                  !splunkConfig.endpoint || 
                  !splunkConfig.index ||
                  (splunkConfig.authType === 'token' && !splunkConfig.token) ||
                  (splunkConfig.authType === 'username-password' && (!splunkConfig.username || !splunkConfig.password))
                )) ||
                (storageType === 'elk' && (
                  !elkConfig.endpoint || 
                  !elkConfig.index ||
                  (elkConfig.authType === 'api-key' && !elkConfig.apiKey) ||
                  (elkConfig.authType === 'username-password' && (!elkConfig.username || !elkConfig.password))
                ))
              }
            >
              {testingConnection ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Wifi className="w-4 h-4 mr-2" />
                  Test Connection
                </>
              )}
            </Button>
          )}
          
          {/* Save Button */}
          <div className="flex-1 flex justify-end">
            <Button
              onClick={handleSave}
              disabled={
                saving || 
                (isEnabled && !storageType) ||
                Object.keys(errors).length > 0 ||
                (isEnabled && storageType === 's3' && (!s3Config.bucketName || !s3Config.region || !s3Config.accessKey || !s3Config.secretKey)) ||
                (isEnabled && storageType === 'splunk' && (
                  !splunkConfig.endpoint || 
                  !splunkConfig.index ||
                  (splunkConfig.authType === 'token' && !splunkConfig.token) ||
                  (splunkConfig.authType === 'username-password' && (!splunkConfig.username || !splunkConfig.password))
                )) ||
                (isEnabled && storageType === 'elk' && (
                  !elkConfig.endpoint || 
                  !elkConfig.index ||
                  (elkConfig.authType === 'api-key' && !elkConfig.apiKey) ||
                  (elkConfig.authType === 'username-password' && (!elkConfig.username || !elkConfig.password))
                ))
              }
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Configuration'
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
