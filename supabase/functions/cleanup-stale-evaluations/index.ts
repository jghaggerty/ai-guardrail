import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Stale evaluation threshold: evaluations running for more than this duration are considered stuck
const STALE_THRESHOLD_MINUTES = 30

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

    // Calculate the cutoff time for stale evaluations
    const cutoffTime = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000).toISOString()

    // Find evaluations that have been 'running' or 'pending' for too long
    const { data: staleEvaluations, error: fetchError } = await supabase
      .from('evaluations')
      .select('id, status, created_at, ai_system_name')
      .in('status', ['running', 'pending'])
      .lt('created_at', cutoffTime)

    if (fetchError) {
      console.error('Error fetching stale evaluations:', fetchError)
      throw fetchError
    }

    if (!staleEvaluations || staleEvaluations.length === 0) {
      console.log('No stale evaluations found')
      return new Response(JSON.stringify({ 
        message: 'No stale evaluations found',
        cleaned: 0,
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Found ${staleEvaluations.length} stale evaluations to clean up`)

    const cleanedIds: string[] = []
    const errors: string[] = []

    for (const evaluation of staleEvaluations) {
      try {
        // Check if there's been recent progress update
        const { data: progressRecord, error: progressError } = await supabase
          .from('evaluation_progress')
          .select('updated_at')
          .eq('evaluation_id', evaluation.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (progressError) {
          console.warn(`Error fetching progress for ${evaluation.id}:`, progressError)
        }

        // If there's been a recent progress update (within threshold), skip
        if (progressRecord?.updated_at) {
          const lastUpdate = new Date(progressRecord.updated_at)
          const now = new Date()
          const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60)
          
          if (minutesSinceUpdate < STALE_THRESHOLD_MINUTES) {
            console.log(`Evaluation ${evaluation.id} has recent progress, skipping`)
            continue
          }
        }

        // Mark the evaluation as failed
        const { error: updateError } = await supabase
          .from('evaluations')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', evaluation.id)

        if (updateError) {
          console.error(`Error updating evaluation ${evaluation.id}:`, updateError)
          errors.push(`${evaluation.id}: ${updateError.message}`)
          continue
        }

        // Update progress record to show timeout
        await supabase
          .from('evaluation_progress')
          .update({
            current_phase: 'failed',
            message: `Analysis timed out after ${STALE_THRESHOLD_MINUTES} minutes of inactivity`,
            progress_percent: 0,
          })
          .eq('evaluation_id', evaluation.id)

        cleanedIds.push(evaluation.id)
        console.log(`Cleaned up stale evaluation: ${evaluation.id} (${evaluation.ai_system_name})`)

      } catch (err) {
        console.error(`Error cleaning up evaluation ${evaluation.id}:`, err)
        errors.push(`${evaluation.id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    const result = {
      message: 'Stale evaluations cleanup completed',
      found: staleEvaluations.length,
      cleaned: cleanedIds.length,
      cleanedIds,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
      thresholdMinutes: STALE_THRESHOLD_MINUTES,
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
