import { blog } from '@/.source/server';
import { notFound } from 'next/navigation';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { Logo } from '../../components/Logo';
import defaultMdxComponents from 'fumadocs-ui/mdx';

export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = blog.find((post: any) => post.slug === slug);

  if (!post) notFound();

  const MDX = post.data.body;

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
      <article className="container mx-auto max-w-3xl px-6 py-12">
        <header className="mb-12 text-center">
          <div className="mb-4 text-sm text-fd-muted-foreground">
            <time>{new Date(post.data.date).toLocaleDateString()}</time>
            {post.data.author && <span> • {post.data.author}</span>}
          </div>
          <h1 className="text-4xl font-bold leading-tight md:text-5xl">
            {post.data.title}
          </h1>
          {post.data.description && (
            <p className="mt-6 text-xl text-fd-muted-foreground">
              {post.data.description}
            </p>
          )}
        </header>
        
        <div className="prose prose-zinc dark:prose-invert max-w-none">
          <MDX components={defaultMdxComponents} />
        </div>
      </article>
    </HomeLayout>
  );
}

export function generateStaticParams() {
  return blog.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ 
  params 
}: { 
  params: Promise<{ slug: string }> 
}) {
  const { slug } = await params;
  const post = blog.find((post) => post.slug === slug);
  if (!post) return;
  return {
    title: post.data.title,
    description: post.data.description,
  };
}
