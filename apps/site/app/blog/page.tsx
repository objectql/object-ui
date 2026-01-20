import { blog } from '@/.source/server';
import Link from 'next/link';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { Logo } from '../components/Logo';

export default function BlogIndex() {
  const posts = [...blog].sort(
    (a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime()
  );

  return (
    <HomeLayout 
      nav={{ title: <Logo />, url: '/' }}
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
      <main className="container mx-auto max-w-4xl px-6 py-12">
        <h1 className="mb-8 text-4xl font-bold">Latest Updates</h1>
        <div className="grid gap-6">
          {posts.map((post) => (
            <Link
              key={post.url}
              href={`/blog/${post.slug}`}
              className="flex flex-col gap-2 rounded-lg border p-6 transition-colors hover:bg-fd-accent/50"
            >
              <h2 className="text-2xl font-bold">{post.data.title}</h2>
              <div className="flex gap-2 text-sm text-fd-muted-foreground">
                <time>{new Date(post.data.date).toLocaleDateString()}</time>
                {post.data.author && <span>• {post.data.author}</span>}
              </div>
              {post.data.description && (
                <p className="text-fd-muted-foreground">{post.data.description}</p>
              )}
            </Link>
          ))}
        </div>
      </main>
    </HomeLayout>
  );
}
