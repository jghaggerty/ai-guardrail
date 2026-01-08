import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Stale evaluation threshold: evaluations with no heartbeat for this duration are considered stuck
const STALE_THRESHOLD_MINUTES = 10
// Maximum resume attempts before marking as permanently failed
const MAX_RESUME_ATTEMPTS = 3

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Verify scheduler secret to prevent unauthorized calls
  const authSecret = req.headers.get('x-scheduler-secret')
  const expectedSecret = Deno.env.get('SCHEDULER_SECRET')
  if (!authSecret || !expectedSecret || authSecret !== expectedSecret) {
    console.warn('Unauthorized cleanup-stale-evaluations call attempt')
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.log('Stale evaluations cleanup started at:', new Date().toISOString())

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Use service role to bypass RLS for cleanup tasks
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Calculate the cutoff time for stale checkpoints (no heartbeat recently)
    const checkpointCutoffTime = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000).toISOString()

    // Find evaluations that have stale checkpoints (haven't had a heartbeat recently)
    const { data: staleCheckpoints, error: checkpointError } = await supabase
      .from('evaluation_checkpoints')
      .select('evaluation_id, current_heuristic_index, last_heartbeat_at')
      .lt('last_heartbeat_at', checkpointCutoffTime)

    if (checkpointError) {
      console.error('Error fetching stale checkpoints:', checkpointError)
    }

    const resumedIds: string[] = []
    const failedIds: string[] = []
    const errors: string[] = []

    // Process stale checkpoints - attempt to resume
    if (staleCheckpoints && staleCheckpoints.length > 0) {
      console.log(`Found ${staleCheckpoints.length} stale checkpoints to process`)

      for (const checkpoint of staleCheckpoints) {
        try {
          // Get the evaluation details
          const { data: evaluation, error: evalError } = await supabase
            .from('evaluations')
            .select('id, status, ai_system_name, heuristic_types, iteration_count, team_id, user_id')
            .eq('id', checkpoint.evaluation_id)
            .maybeSingle()

          if (evalError || !evaluation) {
            console.warn(`Could not find evaluation ${checkpoint.evaluation_id}:`, evalError)
            continue
          }

          // Skip if evaluation is already completed or failed
          if (evaluation.status === 'completed' || evaluation.status === 'failed') {
            // Clean up orphaned checkpoint
            await supabase
              .from('evaluation_checkpoints')
              .delete()
              .eq('evaluation_id', checkpoint.evaluation_id)
            console.log(`Cleaned up orphaned checkpoint for ${evaluation.status} evaluation ${checkpoint.evaluation_id}`)
            continue
          }

          // Get resume attempt count from progress record
          const { data: progressRecord } = await supabase
            .from('evaluation_progress')
            .select('message')
            .eq('evaluation_id', checkpoint.evaluation_id)
            .maybeSingle()

          // Parse resume attempts from message (format: "Resume attempt X/Y")
          let resumeAttempts = 0
          if (progressRecord?.message?.startsWith('Resume attempt')) {
            const match = progressRecord.message.match(/Resume attempt (\d+)/)
            if (match) {
              resumeAttempts = parseInt(match[1], 10)
            }
          }

          if (resumeAttempts >= MAX_RESUME_ATTEMPTS) {
            // Too many resume attempts, mark as failed
            console.log(`Evaluation ${checkpoint.evaluation_id} exceeded max resume attempts (${MAX_RESUME_ATTEMPTS}), marking as failed`)
            
            await supabase
              .from('evaluations')
              .update({
                status: 'failed',
                completed_at: new Date().toISOString(),
              })
              .eq('id', checkpoint.evaluation_id)

            await supabase
              .from('evaluation_progress')
              .update({
                current_phase: 'failed',
                message: `Analysis failed after ${MAX_RESUME_ATTEMPTS} resume attempts`,
                progress_percent: 0,
              })
              .eq('evaluation_id', checkpoint.evaluation_id)

            // Clean up checkpoint
            await supabase
              .from('evaluation_checkpoints')
              .delete()
              .eq('evaluation_id', checkpoint.evaluation_id)

            failedIds.push(checkpoint.evaluation_id)
            continue
          }

          // Attempt to resume the evaluation by calling the evaluate function
          console.log(`Attempting to resume evaluation ${checkpoint.evaluation_id} (attempt ${resumeAttempts + 1}/${MAX_RESUME_ATTEMPTS})`)
          
          // Update progress to show resume attempt
          await supabase
            .from('evaluation_progress')
            .update({
              current_phase: 'resuming',
              message: `Resume attempt ${resumeAttempts + 1}/${MAX_RESUME_ATTEMPTS}...`,
            })
            .eq('evaluation_id', checkpoint.evaluation_id)

          // Update checkpoint heartbeat to prevent immediate re-processing
          await supabase
            .from('evaluation_checkpoints')
            .update({ last_heartbeat_at: new Date().toISOString() })
            .eq('evaluation_id', checkpoint.evaluation_id)

          // Call the evaluate function to resume
          const evaluateUrl = `${supabaseUrl}/functions/v1/evaluate`
          const response = await fetch(evaluateUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              evaluation_id: checkpoint.evaluation_id,
              ai_system_name: evaluation.ai_system_name,
              heuristic_types: evaluation.heuristic_types,
              iteration_count: evaluation.iteration_count,
              resume: true, // Indicate this is a resume attempt
            }),
          })

          if (response.ok) {
            resumedIds.push(checkpoint.evaluation_id)
            console.log(`Successfully triggered resume for evaluation ${checkpoint.evaluation_id}`)
          } else {
            const errorText = await response.text()
            console.error(`Failed to resume evaluation ${checkpoint.evaluation_id}:`, errorText)
            errors.push(`${checkpoint.evaluation_id}: Resume failed - ${errorText}`)
          }

        } catch (err) {
          console.error(`Error processing checkpoint ${checkpoint.evaluation_id}:`, err)
          errors.push(`${checkpoint.evaluation_id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
      }
    }

    // Also handle evaluations that are stuck without checkpoints (truly stale)
    const staleThreshold = new Date(Date.now() - 30 * 60 * 1000).toISOString() // 30 minutes for no-checkpoint evaluations
    
    const { data: staleEvaluations, error: fetchError } = await supabase
      .from('evaluations')
      .select('id, status, created_at, ai_system_name')
      .in('status', ['running', 'pending'])
      .lt('created_at', staleThreshold)

    if (fetchError) {
      console.error('Error fetching stale evaluations:', fetchError)
    }

    if (staleEvaluations && staleEvaluations.length > 0) {
      console.log(`Found ${staleEvaluations.length} old stale evaluations without checkpoints`)
      
      for (const evaluation of staleEvaluations) {
        // Check if this evaluation has a checkpoint (already processed above)
        const { data: checkpoint } = await supabase
          .from('evaluation_checkpoints')
          .select('evaluation_id')
          .eq('evaluation_id', evaluation.id)
          .maybeSingle()

        if (checkpoint) {
          // Has checkpoint, skip (already handled above)
          continue
        }

        // Check if there's been recent progress update
        const { data: progressRecord } = await supabase
          .from('evaluation_progress')
          .select('updated_at')
          .eq('evaluation_id', evaluation.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (progressRecord?.updated_at) {
          const lastUpdate = new Date(progressRecord.updated_at)
          const now = new Date()
          const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60)
          
          if (minutesSinceUpdate < 30) {
            console.log(`Evaluation ${evaluation.id} has recent progress, skipping`)
            continue
          }
        }

        // No checkpoint and no recent progress - mark as failed
        await supabase
          .from('evaluations')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', evaluation.id)

        await supabase
          .from('evaluation_progress')
          .update({
            current_phase: 'failed',
            message: 'Analysis timed out - no checkpoint available for resume',
            progress_percent: 0,
          })
          .eq('evaluation_id', evaluation.id)

        failedIds.push(evaluation.id)
        console.log(`Cleaned up stale evaluation without checkpoint: ${evaluation.id} (${evaluation.ai_system_name})`)
      }
    }

    const result = {
      message: 'Stale evaluations cleanup completed',
      resumed: resumedIds.length,
      resumedIds,
      failed: failedIds.length,
      failedIds,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
      checkpointThresholdMinutes: STALE_THRESHOLD_MINUTES,
      maxResumeAttempts: MAX_RESUME_ATTEMPTS,
    }

    console.log('Cleanup result:', JSON.stringify(result))

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Stale evaluations cleanup error:', error)
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})