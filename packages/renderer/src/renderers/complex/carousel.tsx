import { ComponentRegistry } from '../../registry';
import { 
  Carousel, 
  CarouselContent, 
  CarouselItem, 
  CarouselPrevious, 
  CarouselNext 
} from '@object-ui/ui';
import { renderChildren } from '../../utils';

ComponentRegistry.register('carousel', 
  ({ schema, className, ...props }) => (
    <Carousel 
      opts={schema.opts} 
      orientation={schema.orientation || 'horizontal'}
      className={className} 
      {...props}
    >
      <CarouselContent>
        {schema.items?.map((item: any, index: number) => (
          <CarouselItem key={index} className={schema.itemClassName}>
             {renderChildren(item)}
          </CarouselItem>
        ))}
      </CarouselContent>
      {schema.showArrows && (
        <>
            <CarouselPrevious />
            <CarouselNext />
        </>
      )}
    </Carousel>
  ),
  {
    label: 'Carousel',
    inputs: [
      { name: 'orientation', type: 'enum', enum: ['horizontal', 'vertical'], defaultValue: 'horizontal', label: 'Orientation' },
      { name: 'showArrows', type: 'boolean', label: 'Show Arrows', defaultValue: true },
      { 
        name: 'items', 
        type: 'array', 
        label: 'Items',
        description: 'Array of content schemas'
      },
      { name: 'itemClassName', type: 'string', label: 'Item CSS Class' },
      { name: 'className', type: 'string', label: 'Container CSS Class' }
    ]
  }
);
