import { useRef, useEffect, useCallback, useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, RotateCcw, Play, Pause, Loader2 } from 'lucide-react';
import type { 
  ExerciseThresholds, 
  CustomExerciseConfig, 
  ExerciseVisualizationData,
  ThresholdAdjustment 
} from '@/types/exercise-customization';

interface ExerciseDesignerProps {
  exerciseType: 'squat' | 'heel_raise' | 'hamstring_curl';
  initialConfig?: CustomExerciseConfig;
  onSave: (config: CustomExerciseConfig) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const DEFAULT_THRESHOLDS = {
  squat: {
    minDepthAngle: 80,
    maxDepthAngle: 110,
    torsoLeanMax: 30,
    kneeTrackingMax: 15,
    speedMin: 1.0,
    speedMax: 3.0,
  },
  heel_raise: {
    minHeelLift: 3,
    maxHeelLift: 8,
    balanceThreshold: 10,
    holdTimeMin: 0.5,
    speedControl: 1.5,
  },
  hamstring_curl: {
    minFlexionAngle: 45,
    maxFlexionAngle: 90,
    hipStabilityMax: 15,
    controlledSpeed: 2.0,
    rangeOfMotion: 80,
  },
};

export function ExerciseDesigner({ exerciseType, initialConfig, onSave, onCancel, isLoading = false }: ExerciseDesignerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [isPlaying, setIsPlaying] = useState(true);
  const [animationProgress, setAnimationProgress] = useState(0);
  
  const [config, setConfig] = useState<CustomExerciseConfig>(
    initialConfig || {
      id: '',
      exerciseType,
      name: `Custom ${exerciseType.replace('_', ' ')} Exercise`,
      description: '',
      thresholds: { [exerciseType]: DEFAULT_THRESHOLDS[exerciseType] },
      difficulty: 'beginner',
      createdBy: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  );

  const currentThresholds = config.thresholds[exerciseType] || DEFAULT_THRESHOLDS[exerciseType];

  // Animation loop for real-time visualization
  const animate = useCallback((timestamp: number) => {
    if (!isPlaying) return;
    
    const progress = (timestamp % 3000) / 3000; // 3-second cycle
    setAnimationProgress(progress);
    
    if (canvasRef.current) {
      drawExerciseVisualization(canvasRef.current, exerciseType, progress, currentThresholds);
    }
    
    animationRef.current = requestAnimationFrame(animate);
  }, [exerciseType, currentThresholds, isPlaying]);

  useEffect(() => {
    if (isPlaying) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate, isPlaying]);

  const getThresholdAdjustments = (): ThresholdAdjustment[] => {
    switch (exerciseType) {
      case 'squat':
        return [
          {
            parameter: 'minDepthAngle',
            value: currentThresholds.minDepthAngle || 80,
            min: 60,
            max: 120,
            step: 5,
            unit: '°',
            description: 'Minimum knee angle for valid squat depth'
          },
          {
            parameter: 'maxDepthAngle',
            value: currentThresholds.maxDepthAngle || 110,
            min: 80,
            max: 140,
            step: 5,
            unit: '°',
            description: 'Maximum knee angle (squat bottom position)'
          },
          {
            parameter: 'torsoLeanMax',
            value: currentThresholds.torsoLeanMax || 30,
            min: 10,
            max: 60,
            step: 5,
            unit: '°',
            description: 'Maximum forward torso lean allowed'
          },
          {
            parameter: 'kneeTrackingMax',
            value: currentThresholds.kneeTrackingMax || 15,
            min: 5,
            max: 30,
            step: 2,
            unit: '°',
            description: 'Maximum knee valgus/varus deviation'
          },
        ];
      case 'heel_raise':
        return [
          {
            parameter: 'minHeelLift',
            value: currentThresholds.minHeelLift || 3,
            min: 1,
            max: 10,
            step: 0.5,
            unit: 'cm',
            description: 'Minimum heel lift height required'
          },
          {
            parameter: 'maxHeelLift',
            value: currentThresholds.maxHeelLift || 8,
            min: 4,
            max: 15,
            step: 0.5,
            unit: 'cm',
            description: 'Maximum heel lift height'
          },
          {
            parameter: 'balanceThreshold',
            value: currentThresholds.balanceThreshold || 10,
            min: 5,
            max: 25,
            step: 2,
            unit: '°',
            description: 'Maximum side-to-side sway allowed'
          },
          {
            parameter: 'holdTimeMin',
            value: currentThresholds.holdTimeMin || 0.5,
            min: 0,
            max: 3,
            step: 0.1,
            unit: 's',
            description: 'Minimum hold time at peak position'
          },
        ];
      case 'hamstring_curl':
        return [
          {
            parameter: 'minFlexionAngle',
            value: currentThresholds.minFlexionAngle || 45,
            min: 30,
            max: 70,
            step: 5,
            unit: '°',
            description: 'Minimum knee flexion required'
          },
          {
            parameter: 'maxFlexionAngle',
            value: currentThresholds.maxFlexionAngle || 90,
            min: 60,
            max: 120,
            step: 5,
            unit: '°',
            description: 'Maximum knee flexion allowed'
          },
          {
            parameter: 'hipStabilityMax',
            value: currentThresholds.hipStabilityMax || 15,
            min: 5,
            max: 30,
            step: 2,
            unit: '°',
            description: 'Maximum hip movement during curl'
          },
          {
            parameter: 'rangeOfMotion',
            value: currentThresholds.rangeOfMotion || 80,
            min: 50,
            max: 100,
            step: 5,
            unit: '%',
            description: 'Required range of motion percentage'
          },
        ];
      default:
        return [];
    }
  };

  const updateThreshold = (parameter: string, value: number) => {
    setConfig(prev => ({
      ...prev,
      thresholds: {
        ...prev.thresholds,
        [exerciseType]: {
          ...prev.thresholds[exerciseType],
          [parameter]: value,
        },
      },
      updatedAt: new Date().toISOString(),
    }));
  };

  const resetToDefaults = () => {
    setConfig(prev => ({
      ...prev,
      thresholds: { [exerciseType]: DEFAULT_THRESHOLDS[exerciseType] },
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleSave = () => {
    if (!config.name.trim()) {
      alert('Please enter a name for the exercise configuration');
      return;
    }
    onSave({
      ...config,
      id: config.id || `custom_${exerciseType}_${Date.now()}`,
    });
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Exercise Designer</h1>
          <p className="text-muted-foreground">
            Customize {exerciseType.replace('_', ' ')} parameters and see real-time visualization
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsPlaying(!isPlaying)}>
            {isPlaying ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
            {isPlaying ? 'Pause' : 'Play'}
          </Button>
          <Button variant="outline" onClick={resetToDefaults}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            {isLoading ? 'Saving...' : 'Save Configuration'}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_400px] gap-6">
        {/* Canvas and visualization */}
        <div className="space-y-4">
          {/* Exercise info */}
          <Card>
            <CardHeader>
              <CardTitle>Exercise Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="exercise-name">Exercise Name</Label>
                  <Input
                    id="exercise-name"
                    value={config.name}
                    onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter exercise name"
                  />
                </div>
                <div>
                  <Label htmlFor="difficulty">Difficulty Level</Label>
                  <Select 
                    value={config.difficulty} 
                    onValueChange={(value: 'beginner' | 'intermediate' | 'advanced') => 
                      setConfig(prev => ({ ...prev, difficulty: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={config.description}
                  onChange={(e) => setConfig(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the exercise variation"
                />
              </div>
            </CardContent>
          </Card>

          {/* Visualization Canvas */}
          <Card>
            <CardHeader>
              <CardTitle>Real-time Visualization</CardTitle>
              <p className="text-sm text-muted-foreground">
                See how your threshold adjustments affect exercise validation
              </p>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={400}
                  className="w-full border border-border rounded-lg bg-secondary/10"
                />
                {/* Overlay controls */}
                <div className="absolute top-4 left-4 bg-black/60 rounded-lg p-2">
                  <p className="text-white text-sm font-mono">
                    Progress: {Math.round(animationProgress * 100)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Threshold controls */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Threshold Adjustments</CardTitle>
              <p className="text-sm text-muted-foreground">
                Adjust parameters to customize the exercise
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {getThresholdAdjustments().map((adjustment) => (
                <div key={adjustment.parameter} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">
                      {adjustment.parameter.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </Label>
                    <span className="text-sm font-mono text-primary">
                      {adjustment.value}{adjustment.unit}
                    </span>
                  </div>
                  <Slider
                    value={[adjustment.value]}
                    onValueChange={([value]) => updateThreshold(adjustment.parameter, value)}
                    min={adjustment.min}
                    max={adjustment.max}
                    step={adjustment.step}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    {adjustment.description}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Form validation preview */}
          <Card>
            <CardHeader>
              <CardTitle>Validation Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Beginner Range</span>
                  <span className="text-sm font-mono text-green-400">✓ Valid</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Intermediate Range</span>
                  <span className="text-sm font-mono text-green-400">✓ Valid</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Advanced Range</span>
                  <span className="text-sm font-mono text-yellow-400">⚠ Challenging</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Exercise preview stats */}
          <Card>
            <CardHeader>
              <CardTitle>Current Parameters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-xs font-mono">
                {Object.entries(currentThresholds).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-muted-foreground">{key}:</span>
                    <span className="text-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Canvas drawing function for exercise visualization
function drawExerciseVisualization(
  canvas: HTMLCanvasElement,
  exerciseType: 'squat' | 'heel_raise' | 'hamstring_curl',
  progress: number,
  thresholds: ExerciseThresholds
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  
  // Clear canvas
  ctx.clearRect(0, 0, width, height);
  
  // Background
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, width, height);
  
  // Grid
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += 50) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Exercise-specific visualization
  const centerX = width / 2;
  const centerY = height / 2;
  
  // Smooth animation easing
  const ease = (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const easeProgress = ease(progress < 0.5 ? progress * 2 : 2 - progress * 2);
  
  if (exerciseType === 'squat') {
    drawSquatVisualization(ctx, centerX, centerY, easeProgress, thresholds);
  } else if (exerciseType === 'heel_raise') {
    drawHeelRaiseVisualization(ctx, centerX, centerY, easeProgress, thresholds);
  } else if (exerciseType === 'hamstring_curl') {
    drawHamstringCurlVisualization(ctx, centerX, centerY, easeProgress, thresholds);
  }
  
  // Threshold indicators
  drawThresholdIndicators(ctx, exerciseType, thresholds, easeProgress);
}

function drawSquatVisualization(ctx: CanvasRenderingContext2D, cx: number, cy: number, progress: number, thresholds: ExerciseThresholds) {
  const legLength = 120;
  const thighLength = 60;
  const shinLength = 60;
  
  // Calculate squat depth based on thresholds
  const minAngle = thresholds.minDepthAngle || 80;
  const maxAngle = thresholds.maxDepthAngle || 110;
  const targetAngle = minAngle + (maxAngle - minAngle) * progress;
  
  // Convert angle to radians and calculate positions
  const kneeAngleRad = (targetAngle * Math.PI) / 180;
  const hipY = cy - 40;
  const kneeY = hipY + thighLength * Math.cos(kneeAngleRad);
  const kneeX = cx + thighLength * Math.sin(kneeAngleRad);
  const ankleY = kneeY + shinLength;
  const ankleX = kneeX;

  // Draw stick figure
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 4;
  
  // Body
  ctx.beginPath();
  ctx.moveTo(cx, cy - 100); // head
  ctx.lineTo(cx, hipY); // torso
  ctx.stroke();
  
  // Thighs
  ctx.beginPath();
  ctx.moveTo(cx, hipY);
  ctx.lineTo(kneeX, kneeY);
  ctx.stroke();
  
  // Shins
  ctx.beginPath();
  ctx.moveTo(kneeX, kneeY);
  ctx.lineTo(ankleX, ankleY);
  ctx.stroke();
  
  // Ground line
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, ankleY + 10);
  ctx.lineTo(ctx.canvas.width, ankleY + 10);
  ctx.stroke();
  
  // Joint markers
  ctx.fillStyle = '#fbbf24';
  [
    { x: cx, y: hipY }, // hip
    { x: kneeX, y: kneeY }, // knee
    { x: ankleX, y: ankleY }, // ankle
  ].forEach(joint => {
    ctx.beginPath();
    ctx.arc(joint.x, joint.y, 6, 0, Math.PI * 2);
    ctx.fill();
  });
  
  // Angle indicator
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(kneeX, kneeY, 30, 0, kneeAngleRad);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Angle text
  ctx.fillStyle = '#3b82f6';
  ctx.font = '14px monospace';
  ctx.fillText(`${Math.round(targetAngle)}°`, kneeX + 35, kneeY - 10);
}

function drawHeelRaiseVisualization(ctx: CanvasRenderingContext2D, cx: number, cy: number, progress: number, thresholds: ExerciseThresholds) {
  const legHeight = 100;
  const footLength = 40;
  
  // Calculate heel lift based on thresholds
  const minLift = thresholds.minHeelLift || 3;
  const maxLift = thresholds.maxHeelLift || 8;
  const currentLift = (minLift + (maxLift - minLift) * progress) * 3; // Scale for visualization
  
  const baseY = cy + 50;
  const ankleY = baseY - legHeight;
  const heelY = baseY - currentLift;
  const toeY = baseY;

  // Draw stick figure
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 4;
  
  // Leg
  ctx.beginPath();
  ctx.moveTo(cx, cy - 100);
  ctx.lineTo(cx, ankleY);
  ctx.stroke();
  
  // Foot
  ctx.beginPath();
  ctx.moveTo(cx - footLength/2, toeY);
  ctx.lineTo(cx, heelY);
  ctx.lineTo(cx + footLength/2, toeY);
  ctx.stroke();
  
  // Ground line
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, baseY + 10);
  ctx.lineTo(ctx.canvas.width, baseY + 10);
  ctx.stroke();
  
  // Lift indicator
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(cx + 50, baseY);
  ctx.lineTo(cx + 50, heelY);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Lift measurement
  ctx.fillStyle = '#f59e0b';
  ctx.font = '12px monospace';
  ctx.fillText(`${(currentLift / 3).toFixed(1)}cm`, cx + 55, (baseY + heelY) / 2);
}

function drawHamstringCurlVisualization(ctx: CanvasRenderingContext2D, cx: number, cy: number, progress: number, thresholds: ExerciseThresholds) {
  const thighLength = 70;
  const shinLength = 70;
  
  // Calculate knee flexion based on thresholds
  const minFlex = thresholds.minFlexionAngle || 45;
  const maxFlex = thresholds.maxFlexionAngle || 90;
  const currentFlex = minFlex + (maxFlex - minFlex) * progress;
  const flexRad = (currentFlex * Math.PI) / 180;
  
  const hipY = cy;
  const kneeY = hipY + thighLength;
  const ankleX = cx + shinLength * Math.sin(flexRad);
  const ankleY = kneeY - shinLength * Math.cos(flexRad);

  // Draw stick figure
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 4;
  
  // Body
  ctx.beginPath();
  ctx.moveTo(cx, cy - 80);
  ctx.lineTo(cx, hipY);
  ctx.stroke();
  
  // Thigh (vertical)
  ctx.beginPath();
  ctx.moveTo(cx, hipY);
  ctx.lineTo(cx, kneeY);
  ctx.stroke();
  
  // Shin (moving)
  ctx.beginPath();
  ctx.moveTo(cx, kneeY);
  ctx.lineTo(ankleX, ankleY);
  ctx.stroke();
  
  // Joint markers
  ctx.fillStyle = '#fbbf24';
  [
    { x: cx, y: hipY }, // hip
    { x: cx, y: kneeY }, // knee
    { x: ankleX, y: ankleY }, // ankle
  ].forEach(joint => {
    ctx.beginPath();
    ctx.arc(joint.x, joint.y, 5, 0, Math.PI * 2);
    ctx.fill();
  });
  
  // Flexion angle indicator
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(cx, kneeY, 25, -Math.PI/2, flexRad - Math.PI/2);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Angle text
  ctx.fillStyle = '#3b82f6';
  ctx.font = '14px monospace';
  ctx.fillText(`${Math.round(currentFlex)}°`, cx + 30, kneeY - 15);
}

function drawThresholdIndicators(
  ctx: CanvasRenderingContext2D, 
  exerciseType: string, 
  thresholds: ExerciseThresholds, 
  progress: number
) {
  // Draw threshold zones and indicators
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  
  // Legend background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(width - 150, 10, 140, 100);
  
  // Legend content
  ctx.fillStyle = '#22c55e';
  ctx.font = '12px sans-serif';
  ctx.fillText('Valid Range', width - 140, 30);
  
  ctx.fillStyle = '#f59e0b';
  ctx.fillText('Warning Zone', width - 140, 50);
  
  ctx.fillStyle = '#ef4444';
  ctx.fillText('Invalid Range', width - 140, 70);
  
  // Current status
  ctx.fillStyle = '#3b82f6';
  ctx.fillText(`Progress: ${Math.round(progress * 100)}%`, width - 140, 95);
}