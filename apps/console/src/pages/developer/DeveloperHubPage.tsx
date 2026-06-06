/**
 * Developer Hub Page
 *
 * Entry point for developer-oriented tools migrated from the standalone
 * studio app: REST API console, flow test runs, and public form management.
 */

import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@object-ui/components';
import { Terminal, Workflow, FileText, Plug } from 'lucide-react';

interface HubCard {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
}

export function DeveloperHubPage() {
  const navigate = useNavigate();
  const { appName } = useParams();
  const basePath = appName ? `/apps/${appName}` : '';

  const cards: HubCard[] = [
    {
      title: 'Integrations & APIs',
      description: 'Your app as a REST API — base URL, endpoints, and connect samples',
      icon: Plug,
      href: `${basePath}/developer/integrations`,
    },
    {
      title: 'API Console',
      description: 'Inspect and exercise REST endpoints with auto-discovered services',
      icon: Terminal,
      href: `${basePath}/developer/api-console`,
    },
    {
      title: 'Flow Runs',
      description: 'Trigger flows with sample inputs and inspect recent run history',
      icon: Workflow,
      href: `${basePath}/developer/flow-runs`,
    },
    {
      title: 'Public Forms',
      description: 'Publish, share, and embed FormViews available to anonymous users',
      icon: FileText,
      href: `${basePath}/developer/public-forms`,
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Developer</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tools for building, debugging, and sharing ObjectStack apps
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.title}
              className="cursor-pointer transition-colors hover:bg-accent/50"
              onClick={() => navigate(card.href)}
              data-testid={`hub-card-${card.title.toLowerCase().replace(/\s+/g, '-')}`}
              role="link"
              tabIndex={0}
              aria-label={`${card.title}: ${card.description}`}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(card.href);
                }
              }}
            >
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-base">{card.title}</CardTitle>
                  <CardDescription className="text-xs">{card.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-0" />
            </Card>
          );
        })}
      </div>
    </div>
  );
}
