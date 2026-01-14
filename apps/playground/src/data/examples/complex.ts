import kanbanBoard from './complex/kanban-board.json';
import carouselGallery from './complex/carousel-gallery.json';
import timelineEvents from './complex/timeline-events.json';
import tableBasic from './complex/table-basic.json';

export const complex = {
  'kanban-board': JSON.stringify(kanbanBoard, null, 2),
  'carousel-gallery': JSON.stringify(carouselGallery, null, 2),
  'timeline-events': JSON.stringify(timelineEvents, null, 2),
  'table-basic': JSON.stringify(tableBasic, null, 2)
};
