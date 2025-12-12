import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LLMConfig {
  id: string
  team_id: string
  display_name: string
  provider: string
  model_name: string
  schedule_frequency: string
  is_connected: boolean
}

interface LastEvaluation {
  llm_config_id: string
  last_run: string
}

// Determine if an evaluation is due based on schedule frequency
function isEvaluationDue(lastRun: Date | null, frequency: string): boolean {
  if (!lastRun) return true // Never run before
  
  const now = new Date()
  const diffMs = now.getTime() - lastRun.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)
  const diffDays = diffHours / 24
  
  switch (frequency) {
    case 'daily':
      return diffHours >= 24
    case 'weekly':
      return diffDays >= 7
    case 'monthly':
      return diffDays >= 30
    default:
      return false // 'manual' or unknown
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  console.log('Scheduled evaluations check started at:', new Date().toISOString())

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Use service role to bypass RLS for scheduled tasks
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch all LLM configurations with non-manual schedules that are connected
    const { data: configs, error: configError } = await supabase
      .from('llm_configurations')
      .select('id, team_id, display_name, provider, model_name, schedule_frequency, is_connected')
      .neq('schedule_frequency', 'manual')
      .eq('is_connected', true)

    if (configError) {
      console.error('Error fetching LLM configurations:', configError)
      throw configError
    }

    if (!configs || configs.length === 0) {
      console.log('No scheduled LLM configurations found')
      return new Response(JSON.stringify({ 
        message: 'No scheduled configurations found',
        triggered: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Found ${configs.length} scheduled LLM configurations`)

    // Get the last completed evaluation for each config
    const configIds = configs.map(c => c.id)
    const { data: lastEvaluations, error: evalError } = await supabase
      .from('evaluations')
      .select('ai_system_name, completed_at')
      .in('ai_system_name', configs.map(c => c.display_name))
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })

    if (evalError) {
      console.error('Error fetching last evaluations:', evalError)
    }

    // Build a map of last run times by display name
    const lastRunMap = new Map<string, Date>()
    if (lastEvaluations) {
      for (const evalRecord of lastEvaluations) {
        if (!lastRunMap.has(evalRecord.ai_system_name) && evalRecord.completed_at) {
          lastRunMap.set(evalRecord.ai_system_name, new Date(evalRecord.completed_at))
        }
      }
    }
    // Check each config and trigger evaluation if due
    const triggeredEvaluations: string[] = []
    const errors: string[] = []

    for (const config of configs as LLMConfig[]) {
      const lastRun = lastRunMap.get(config.display_name) || null
      const isDue = isEvaluationDue(lastRun, config.schedule_frequency)

      console.log(`Config "${config.display_name}": frequency=${config.schedule_frequency}, lastRun=${lastRun?.toISOString() || 'never'}, isDue=${isDue}`)

      if (isDue) {
        try {
          // Get evaluation settings for the team
          const { data: settings } = await supabase
            .from('evaluation_settings')
            .select('selected_heuristics, sample_size')
            .eq('team_id', config.team_id)
            .single()

          const heuristicTypes = settings?.selected_heuristics || ['anchoring', 'loss_aversion', 'confirmation_bias']
          const iterationCount = settings?.sample_size || 100

          // Create a new evaluation record
          const { data: evaluation, error: createError } = await supabase
            .from('evaluations')
            .insert({
              ai_system_name: config.display_name,
              heuristic_types: heuristicTypes,
              iteration_count: iterationCount,
              status: 'pending',
              team_id: config.team_id,
              user_id: null // Scheduled run, no specific user
            })
            .select()
            .single()

          if (createError) {
            console.error(`Error creating evaluation for ${config.display_name}:`, createError)
            errors.push(`${config.display_name}: ${createError.message}`)
            continue
          }

          console.log(`Created evaluation ${evaluation.id} for ${config.display_name}`)

          // Trigger the evaluate function via HTTP call
          const evaluateUrl = `${supabaseUrl}/functions/v1/evaluate`
          const evaluateResponse = await fetch(evaluateUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              evaluation_id: evaluation.id,
              ai_system_name: config.display_name,
              heuristic_types: heuristicTypes,
              iteration_count: iterationCount,
              llm_config_id: config.id,
              scheduled: true
            })
          })

          if (!evaluateResponse.ok) {
            const errorText = await evaluateResponse.text()
            console.error(`Evaluate function failed for ${config.display_name}:`, errorText)
            errors.push(`${config.display_name}: Evaluate function failed`)
          } else {
            triggeredEvaluations.push(config.display_name)
            console.log(`Successfully triggered evaluation for ${config.display_name}`)
          }

        } catch (err) {
          console.error(`Error triggering evaluation for ${config.display_name}:`, err)
          errors.push(`${config.display_name}: ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
      }
    }

    const result = {
      message: 'Scheduled evaluations check completed',
      checked: configs.length,
      triggered: triggeredEvaluations.length,
      triggeredModels: triggeredEvaluations,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString()
    }

    console.log('Scheduled evaluations result:', JSON.stringify(result))

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Scheduled evaluations error:', error)
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
