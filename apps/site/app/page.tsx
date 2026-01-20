import Link from 'next/link';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { Logo } from './components/Logo';

export default function HomePage() {
  return (
    <HomeLayout
      nav={{
        title: <Logo />,
        url: '/',
      }}
      githubUrl="https://github.com/objectstack-ai/objectui"
      links={[
        {
          text: 'Documentation',
          url: '/docs',
          active: 'nested-url',
        },
        {
          text: 'Blog',
          url: '/blog',
          active: 'nested-url',
        },
      ]}
    >
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-fd-background via-fd-background to-fd-muted/20 px-6 py-24 sm:py-32 lg:px-8">
        <div className="relative mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-8 inline-flex items-center rounded-full border border-fd-primary/20 bg-fd-primary/10 px-4 py-1.5 text-sm font-medium text-fd-primary">
              ✨ The Universal Schema-Driven UI Engine
            </div>
            <h1 className="mb-6 text-5xl font-bold tracking-tight text-fd-foreground sm:text-7xl">
              From JSON to
              <span className="bg-gradient-to-r from-fd-primary to-fd-accent bg-clip-text text-transparent"> World-Class UI </span>
              in Minutes
            </h1>
            <p className="mb-10 text-lg leading-8 text-fd-muted-foreground">
              Build beautiful, production-ready interfaces without writing React code. 
              Just define your UI in JSON and let ObjectUI handle the rest with Tailwind CSS and Shadcn UI.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/docs"
                className="inline-flex items-center justify-center rounded-lg bg-fd-primary px-8 py-3.5 text-base font-semibold text-fd-primary-foreground shadow-lg transition-all hover:bg-fd-primary/90 hover:shadow-xl"
              >
                Get Started
                <svg className="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <a
                href="https://github.com/objectstack-ai/objectui"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-lg border-2 border-fd-border bg-fd-background px-8 py-3.5 text-base font-semibold text-fd-foreground transition-all hover:bg-fd-accent/50"
              >
                <svg className="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                View on GitHub
              </a>
            </div>
          </div>

          {/* Code Preview */}
          <div className="mx-auto mt-16 max-w-4xl">
            <div className="relative rounded-2xl bg-fd-card p-8 shadow-2xl ring-1 ring-fd-border">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-3 w-3 rounded-full bg-red-500"></div>
                <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                <div className="h-3 w-3 rounded-full bg-green-500"></div>
              </div>
              <pre className="overflow-x-auto text-sm text-fd-muted-foreground">
                <code>{`{
  "type": "page",
  "title": "Dashboard",
  "body": {
    "type": "grid",
    "columns": 3,
    "items": [
      {
        "type": "card",
        "title": "Total Users",
        "value": "\${stats.users}"
      },
      {
        "type": "card",
        "title": "Revenue",
        "value": "\${stats.revenue}"
      },
      {
        "type": "card",
        "title": "Orders",
        "value": "\${stats.orders}"
      }
    ]
  }
}`}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 sm:py-32 bg-fd-muted/30">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-fd-foreground sm:text-4xl">
              Why Choose ObjectUI?
            </h2>
            <p className="mt-4 text-lg text-fd-muted-foreground">
              Stop writing repetitive UI code. Build faster with better results.
            </p>
          </div>
          
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <div className="relative rounded-2xl border border-fd-border bg-fd-card p-8 shadow-sm transition-all hover:shadow-lg">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-fd-primary/10 text-fd-primary">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="mb-2 text-xl font-semibold text-fd-foreground">
                Blazing Fast
              </h3>
              <p className="text-fd-muted-foreground">
                3x faster page loads and 6x smaller bundle sizes compared to traditional low-code platforms. Built on React 18+ with automatic optimizations.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="relative rounded-2xl border border-fd-border bg-fd-card p-8 shadow-sm transition-all hover:shadow-lg">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-fd-accent/10 text-fd-accent">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </div>
              <h3 className="mb-2 text-xl font-semibold text-fd-foreground">
                Beautiful by Default
              </h3>
              <p className="text-fd-muted-foreground">
                Professional designs using Tailwind CSS and Shadcn UI. Light/dark theme support, fully customizable, and WCAG 2.1 AA accessible.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="relative rounded-2xl border border-fd-border bg-fd-card p-8 shadow-sm transition-all hover:shadow-lg">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-fd-primary/10 text-fd-primary">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <h3 className="mb-2 text-xl font-semibold text-fd-foreground">
                Developer Friendly
              </h3>
              <p className="text-fd-muted-foreground">
                TypeScript-first with complete type definitions. Zero learning curve if you know React. Works with existing tools and workflows.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="relative rounded-2xl border border-fd-border bg-fd-card p-8 shadow-sm transition-all hover:shadow-lg">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-fd-accent/10 text-fd-accent">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="mb-2 text-xl font-semibold text-fd-foreground">
                Production Ready
              </h3>
              <p className="text-fd-muted-foreground">
                85%+ test coverage, enterprise security built-in, comprehensive documentation, and active development support.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="relative rounded-2xl border border-fd-border bg-fd-card p-8 shadow-sm transition-all hover:shadow-lg">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-fd-primary/10 text-fd-primary">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
              </div>
              <h3 className="mb-2 text-xl font-semibold text-fd-foreground">
                Modular Architecture
              </h3>
              <p className="text-fd-muted-foreground">
                Tree-shakable packages, lazy-loaded plugins, and support for Server Components. Only load what you need.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="relative rounded-2xl border border-fd-border bg-fd-card p-8 shadow-sm transition-all hover:shadow-lg">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-fd-accent/10 text-fd-accent">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <h3 className="mb-2 text-xl font-semibold text-fd-foreground">
                Backend Agnostic
              </h3>
              <p className="text-fd-muted-foreground">
                Works with any backend through universal DataSource interface. REST, GraphQL, Firebase, or custom adapters.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-gradient-to-r from-fd-primary to-fd-accent py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 text-center text-fd-primary-foreground">
            <div>
              <div className="text-5xl font-bold mb-2">60+</div>
              <div className="text-xl opacity-90">Components</div>
            </div>
            <div>
              <div className="text-5xl font-bold mb-2">85%+</div>
              <div className="text-xl opacity-90">Test Coverage</div>
            </div>
            <div>
              <div className="text-5xl font-bold mb-2">50KB</div>
              <div className="text-xl opacity-90">Bundle Size</div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-24 sm:py-32 bg-fd-muted/30">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-fd-foreground sm:text-4xl">
              What Can You Build?
            </h2>
            <p className="mt-4 text-lg text-fd-muted-foreground">
              From admin panels to dashboards, ObjectUI handles it all
            </p>
          </div>
          
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: "📊", title: "Dashboards", desc: "Data visualization and analytics" },
              { icon: "⚙️", title: "Admin Panels", desc: "Complete CRUD interfaces" },
              { icon: "📝", title: "Forms", desc: "Complex multi-step forms" },
              { icon: "📄", title: "CMS", desc: "Content management systems" },
              { icon: "🔧", title: "Internal Tools", desc: "Business applications" },
              { icon: "🎨", title: "Prototypes", desc: "Rapid UI prototyping" }
            ].map((useCase) => (
              <div key={useCase.title} className="rounded-xl border border-fd-border bg-fd-card p-6">
                <div className="text-4xl mb-3">{useCase.icon}</div>
                <h3 className="text-lg font-semibold text-fd-foreground mb-1">
                  {useCase.title}
                </h3>
                <p className="text-fd-muted-foreground text-sm">
                  {useCase.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-fd-primary to-fd-accent px-8 py-16 text-center shadow-2xl sm:px-16">
            <div className="relative z-10">
              <h2 className="text-3xl font-bold tracking-tight text-fd-primary-foreground sm:text-4xl">
                Ready to Build Something Amazing?
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-fd-primary-foreground/90">
                Join developers who are building faster with ObjectUI. Get started in minutes with our comprehensive documentation.
              </p>
              <div className="mt-10 flex items-center justify-center gap-4">
                <Link
                  href="/docs"
                  className="rounded-lg bg-fd-background px-8 py-3.5 text-base font-semibold text-fd-foreground shadow-lg transition-all hover:bg-fd-background/90"
                >
                  Get Started Now
                </Link>
                <a
                  href="https://github.com/objectstack-ai/objectui"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border-2 border-fd-primary-foreground bg-transparent px-8 py-3.5 text-base font-semibold text-fd-primary-foreground transition-all hover:bg-fd-primary-foreground hover:text-fd-primary"
                >
                  Star on GitHub
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-fd-border">
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
          <p className="text-center text-sm text-fd-muted-foreground">
            Built with ❤️ by the{' '}
            <a href="https://github.com/objectstack-ai" className="font-medium hover:text-fd-foreground">
              ObjectStack Team
            </a>
          </p>
        </div>
      </footer>
    </HomeLayout>
  );
}
