import { blog } from '@/.source/server';
import Link from 'next/link';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { Logo } from '../components/Logo';

export default function BlogIndex() {
  const posts = [...blog].sort(
    (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
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
          {posts.map((post: any) => {
            const slug = post.info.path.replace(/\.mdx?$/, '');
            return (
              <Link
                key={slug}
                href={`/blog/${slug}`}
                className="flex flex-col gap-2 border p-6 rounded-lg hover:bg-fd-accent/50 transition-colors"
              >
                <h2 className="text-2xl font-bold">{post.title}</h2>
                <div className="flex gap-2 text-sm text-fd-muted-foreground">
                  <time>{new Date(post.date).toLocaleDateString()}</time>
                  {post.author && <span>• {post.author}</span>}
                </div>
                {post.description && (
                  <p className="text-fd-muted-foreground">{post.description}</p>
                )}
              </Link>
            );
          })}
        </div>
      </main>
    </HomeLayout>
  );
}
