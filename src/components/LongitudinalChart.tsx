import { BaselineData } from '@/types/bias';
import { Card } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart } from 'recharts';
import { format } from 'date-fns';

interface LongitudinalChartProps {
  data: BaselineData[];
  currentScore: number;
}

export const LongitudinalChart = ({ data, currentScore }: LongitudinalChartProps) => {
  const chartData = data.map(d => ({
    date: format(d.timestamp, 'MMM d'),
    score: d.score,
    zone: d.zone
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border p-3 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-card-foreground">{data.date}</p>
          <p className="text-sm text-muted-foreground">
            Score: <span className="font-semibold text-card-foreground">{data.score.toFixed(1)}</span>
          </p>
          <p className="text-xs mt-1">
            Zone: <span className={`font-semibold ${
              data.zone === 'green' ? 'text-success' : 
              data.zone === 'yellow' ? 'text-warning' : 
              'text-danger'
            }`}>{data.zone.toUpperCase()}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-card-foreground mb-2">
          Longitudinal Performance Tracking
        </h3>
        <p className="text-sm text-muted-foreground">
          30-day behavioral baseline with statistical zones
        </p>
      </div>
      
      <div className="mb-4 flex gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-success"></div>
          <span className="text-muted-foreground">Green Zone (75-100): Acceptable</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-warning"></div>
          <span className="text-muted-foreground">Yellow Zone (60-74): Caution</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-danger"></div>
          <span className="text-muted-foreground">Red Zone (&lt;60): Action Required</span>
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="date" 
              stroke="hsl(var(--muted-foreground))"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              domain={[0, 100]}
              stroke="hsl(var(--muted-foreground))"
              style={{ fontSize: '12px' }}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Zone reference lines */}
            <ReferenceLine 
              y={75} 
              stroke="hsl(var(--success))" 
              strokeDasharray="3 3"
              label={{ value: 'Green Zone', fill: 'hsl(var(--success))', fontSize: 12 }}
            />
            <ReferenceLine 
              y={60} 
              stroke="hsl(var(--warning))" 
              strokeDasharray="3 3"
              label={{ value: 'Yellow Zone', fill: 'hsl(var(--warning))', fontSize: 12 }}
            />
            
            <Area 
              type="monotone" 
              dataKey="score" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              fill="url(#scoreGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-6 p-4 bg-diagnostic-bg rounded-lg border border-diagnostic-border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-card-foreground">Current Status</p>
            <p className="text-2xl font-bold text-card-foreground mt-1">{currentScore.toFixed(1)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Zone Classification</p>
            <p className={`text-lg font-semibold mt-1 ${
              currentScore >= 75 ? 'text-success' :
              currentScore >= 60 ? 'text-warning' :
              'text-danger'
            }`}>
              {currentScore >= 75 ? 'GREEN' : currentScore >= 60 ? 'YELLOW' : 'RED'}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
};
