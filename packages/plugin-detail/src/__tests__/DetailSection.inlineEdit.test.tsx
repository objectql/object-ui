/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DetailSection } from '../DetailSection';
import type { DetailViewSection } from '@object-ui/types';

/**
 * Regression: in inline-edit mode a reference field (lookup / master_detail /
 * user) whose value arrived `$expand`-ed as a record object used to fall
 * through to a generic <input> and render `String({...})` → "[object Object]".
 * It must now render the lookup picker (no raw object leak) and never surface
 * the "[object Object]" string in any editable input.
 */
describe('DetailSection inline-edit reference fields', () => {
  const objectSchema = {
    fields: {
      project: { type: 'master_detail', reference_to: 'projects' },
      factory: { type: 'lookup', reference_to: 'factories' },
      title: { type: 'text' },
    },
  };

  const section: DetailViewSection = {
    fields: [
      { name: 'project', label: '所属项目' },
      { name: 'factory', label: '制作工厂' },
      { name: 'title', label: '标题' },
    ],
  } as DetailViewSection;

  // Values as the server returns them with $expand: nested record objects.
  const data = {
    project: { _id: 'p1', name: 'Apollo' },
    factory: { id: 'f9', name: 'Shenzhen Plant' },
    title: 'Hello',
  };

  it('never renders "[object Object]" for expanded reference values in edit mode', () => {
    render(
      <DetailSection
        section={section}
        data={data}
        objectSchema={objectSchema}
        isEditing
      />,
    );
    expect(screen.queryByText(/\[object Object\]/)).toBeNull();
    expect(screen.queryByDisplayValue(/\[object Object\]/)).toBeNull();
  });

  it('renders an editable text input for plain text fields', () => {
    render(
      <DetailSection
        section={section}
        data={data}
        objectSchema={objectSchema}
        isEditing
      />,
    );
    // The plain text field keeps its string value in an editable input.
    expect(screen.getByDisplayValue('Hello')).toBeInTheDocument();
  });
});
