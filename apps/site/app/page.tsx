import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">Object UI</h1>
        <p className="mb-8 text-xl text-muted-foreground">
          A Universal, Schema-Driven UI Engine built on React, Tailwind, and Shadcn UI.
        </p>
        <Link
          href="/docs"
          className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Get Started
        </Link>
      </div>
    </main>
  );
}
