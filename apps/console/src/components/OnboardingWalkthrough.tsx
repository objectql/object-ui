/**
 * OnboardingWalkthrough
 *
 * A simple first-time user onboarding dialog that highlights key features
 * of the console. Dismissed state is persisted in localStorage so it only
 * shows once.
 * @module
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
} from '@object-ui/components';
import {
  Rocket,
  Search,
  Star,
  LayoutDashboard,
  ArrowRight,
  X,
} from 'lucide-react';

const STORAGE_KEY = 'objectui-onboarding-dismissed';

interface OnboardingStep {
  icon: React.ElementType;
  title: string;
  description: string;
}

const STEPS: OnboardingStep[] = [
  {
    icon: LayoutDashboard,
    title: 'Navigate Your Apps',
    description:
      'Use the sidebar to browse objects, dashboards, pages, and reports. Switch between apps using the dropdown in the sidebar header.',
  },
  {
    icon: Search,
    title: 'Quick Search',
    description:
      'Press ⌘K (or Ctrl+K) to open the command palette and quickly jump to any object, dashboard, or page.',
  },
  {
    icon: Star,
    title: 'Favorites & Recent',
    description:
      'Star frequently used items to pin them in the sidebar. Recently visited items also appear for quick access.',
  },
  {
    icon: Rocket,
    title: 'Keyboard Shortcuts',
    description:
      'Press ? to view all keyboard shortcuts. Use them to speed up your workflow with CRUD operations and navigation.',
  },
];

export function OnboardingWalkthrough() {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) {
        // Show after a short delay so the app is fully loaded
        const timer = setTimeout(() => setOpen(true), 800);
        return () => clearTimeout(timer);
      }
    } catch {
      // localStorage unavailable — skip onboarding
    }
  }, []);

  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // Silently ignore
    }
  };

  const next = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      dismiss();
    }
  };

  const step = STEPS[currentStep];
  const StepIcon = step.icon;
  const isLast = currentStep === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) dismiss(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              Welcome to ObjectUI
            </DialogTitle>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={dismiss}>
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
          <DialogDescription>
            Let&apos;s get you started with a quick tour.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <StepIcon className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">{step.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {step.description}
            </p>
          </div>
        </div>

        {/* Step indicator dots */}
        <div className="flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === currentStep ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
              onClick={() => setCurrentStep(i)}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" size="sm" onClick={dismiss}>
            Skip
          </Button>
          <Button size="sm" onClick={next}>
            {isLast ? 'Get Started' : 'Next'}
            {!isLast && <ArrowRight className="ml-1 h-4 w-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
