import StudioClient from '@/components/StudioClient';

export default function StudioPage({ params }: { params: { id: string } }) {
  return <StudioClient id={params.id} />;
}
