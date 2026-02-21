import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { ExerciseDesigner } from '@/components/ExerciseDesigner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Dumbbell, Settings, Zap, Loader2 } from 'lucide-react';
import type { CustomExerciseConfig } from '@/types/exercise-customization';
import { toast } from '@/components/ui/sonner';
import { useCreateCustomExerciseConfig, useCustomExerciseConfigs } from '@/hooks/useCustomExerciseConfigs';

type ExerciseType = 'squat' | 'heel_raise' | 'hamstring_curl';

const EXERCISE_OPTIONS = [
  {
    type: 'squat' as ExerciseType,
    name: 'Squat Analysis',
    description: 'Lower body strength with customizable depth and form parameters',
    icon: '🦵',
    features: ['Adjustable squat depth', 'Torso lean control', 'Knee tracking', 'Speed parameters']
  },
  {
    type: 'heel_raise' as ExerciseType,
    name: 'Heel Raise Analysis',
    description: 'Calf strengthening with configurable lift height and balance',
    icon: '⬆️',
    features: ['Custom lift height', 'Balance thresholds', 'Hold time control', 'Stability tracking']
  },
  {
    type: 'hamstring_curl' as ExerciseType,
    name: 'Hamstring Curl Analysis',
    description: 'Posterior chain development with flexible range of motion',
    icon: '🔄',
    features: ['Flexion angle range', 'Hip stability', 'Speed control', 'ROM requirements']
  },
];

export default function ExerciseDesignerPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const exerciseTypeParam = searchParams.get('type') as ExerciseType | null;
  
  const [selectedExerciseType, setSelectedExerciseType] = useState<ExerciseType | null>(
    exerciseTypeParam
  );
  const [showDesigner, setShowDesigner] = useState(!!exerciseTypeParam);

  const { data: customConfigs } = useCustomExerciseConfigs();
  const createCustomConfig = useCreateCustomExerciseConfig();

  const handleSaveConfig = async (config: CustomExerciseConfig) => {
    try {
      await createCustomConfig.mutateAsync(config);
      toast.success(`Exercise "${config.name}" saved successfully!`);
      navigate('/dashboard');
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Failed to save exercise configuration');
    }
  };

  const handleSelectExercise = (type: ExerciseType) => {
    setSelectedExerciseType(type);
    setShowDesigner(true);
    
    // Update URL
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('type', type);
    window.history.pushState({}, '', newUrl.toString());
  };

  const handleBackToSelection = () => {
    setShowDesigner(false);
    setSelectedExerciseType(null);
    
    // Clear URL params
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('type');
    window.history.pushState({}, '', newUrl.toString());
  };

  if (showDesigner && selectedExerciseType) {
    return (
      <DashboardLayout>
        <ExerciseDesigner
          exerciseType={selectedExerciseType}
          onSave={handleSaveConfig}
          onCancel={handleBackToSelection}
          isLoading={createCustomConfig.isPending}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/physio-dashboard')}
            className="text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="font-display text-3xl font-bold flex items-center gap-3">
              <Settings className="h-8 w-8 text-primary" />
              Exercise Designer
            </h1>
            <p className="text-muted-foreground mt-1">
              Create customized exercise configurations with adjustable thresholds
            </p>
          </div>
        </div>

        {/* Introduction card */}
        <Card className="mb-8 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Zap className="h-5 w-5" />
              Custom Exercise Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Design personalized exercise parameters for your patients. Adjust thresholds like squat depth, 
              heel raise height, and movement speed while seeing real-time visual feedback of how these 
              changes affect exercise validation.
            </p>
            <div className="flex flex-wrap gap-2">
              {['Real-time visualization', 'Adjustable thresholds', 'Form validation preview', 'Patient-specific adaptation'].map(feature => (
                <span key={feature} className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {feature}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Exercise type selection */}
        <div className="space-y-6">
          <h2 className="font-display text-xl font-semibold">Select Exercise to Customize</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {EXERCISE_OPTIONS.map((exercise) => (
              <Card 
                key={exercise.type}
                className="cursor-pointer hover:border-primary/50 transition-all group"
                onClick={() => handleSelectExercise(exercise.type)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{exercise.icon}</span>
                    <div>
                      <CardTitle className="text-base group-hover:text-primary transition-colors">
                        {exercise.name}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        {exercise.description}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Customizable Parameters:</p>
                    <div className="space-y-1">
                      {exercise.features.map((feature) => (
                        <div key={feature} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                          <span className="text-xs text-muted-foreground">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <Button 
                    className="w-full mt-4 bg-primary text-primary-foreground group-hover:bg-primary/90"
                    size="sm"
                  >
                    <Dumbbell className="h-3.5 w-3.5 mr-1" />
                    Customize Exercise
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Quick access section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Recent Configurations</CardTitle>
            <p className="text-sm text-muted-foreground">
              Quick access to recently created exercise configurations
            </p>
          </CardHeader>
          <CardContent>
            {customConfigs && customConfigs.length > 0 ? (
              <div className="space-y-3">
                {customConfigs.slice(0, 5).map((config) => (
                  <div key={config.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                    <div>
                      <p className="font-medium">{config.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {config.exercise_type} • {config.difficulty}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSelectExercise(config.exercise_type)}
                    >
                      Edit
                    </Button>
                  </div>
                ))}
                {customConfigs.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    And {customConfigs.length - 5} more configurations...
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  No custom configurations yet. Create your first one by selecting an exercise above.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}