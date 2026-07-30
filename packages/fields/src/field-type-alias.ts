/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Map field type to form component type
 * 
 * @param fieldType - The ObjectQL field type identifier to convert
 * (for example: `"text"`, `"number"`, `"date"`, `"lookup"`).
 * @returns The normalized form field type string used in the form schema
 * (for example: `"input"`, `"textarea"`, `"date-picker"`, `"select"`).
 */
export function mapFieldTypeToFormType(fieldType: string): string {
  const typeMap: Record<string, string> = {
    // Text-based fields
    text: 'field:text',
    textarea: 'field:textarea',
    markdown: 'field:markdown', // Markdown editor (fallback to textarea)
    html: 'field:html', // Rich text editor (fallback to textarea)
    richtext: 'field:richtext', // WYSIWYG rich-text editor
    secret: 'field:password', // encrypted-at-rest value — mask input like a password

    // Numeric fields
    number: 'field:number',
    currency: 'field:currency',
    percent: 'field:percent',
    slider: 'field:slider',
    progress: 'field:slider', // bounded 0..100 progress — edit via slider
    rating: 'field:rating',

    // Date/Time fields
    date: 'field:date',
    datetime: 'field:datetime',
    time: 'field:time',

    // Boolean
    boolean: 'field:boolean',
    toggle: 'field:boolean', // toggle is a boolean rendered as a switch

    // Selection fields
    select: 'field:select',
    multiselect: 'field:multiselect',
    radio: 'field:radio',
    checkboxes: 'field:checkboxes',
    tags: 'field:tags',
    lookup: 'field:lookup',
    master_detail: 'field:master_detail',
    tree: 'field:lookup', // hierarchical reference — pick the parent via a lookup
    // `user` is a lookup specialized to sys_user; `owner` mirrors it (record
    // ownership). Both render via the UserField person-picker (delegates to the
    // lookup picker). Without these they would fall through to `field:text`.
    user: 'field:user',
    owner: 'field:owner',

    // Contact fields
    email: 'field:email',
    phone: 'field:phone',
    url: 'field:url',

    // File / media fields
    file: 'field:file',
    image: 'field:image',
    avatar: 'field:avatar',
    video: 'field:file', // uploads as a file
    audio: 'field:file', // uploads as a file
    signature: 'field:signature',

    // Special / enhanced fields
    password: 'field:password',
    location: 'field:location', // Location/map field (fallback to input)
    geolocation: 'field:geolocation',
    address: 'field:address',
    color: 'field:color',
    code: 'field:code',
    json: 'field:code', // JSON edited in the code editor
    qrcode: 'field:qrcode',
    vector: 'field:vector',

    // Embedded structured values (stored as JSON on the row)
    object: 'field:object',
    composite: 'field:object', // embedded object
    record: 'field:object', // name-keyed map
    repeater: 'field:grid', // embedded array of rows

    // Auto-generated/computed fields (typically read-only)
    formula: 'field:formula',
    summary: 'field:summary',
    // `@objectstack/spec` spells this `autonumber`; the widget map key is
    // `auto_number`. Map both spellings so a spec-typed field/param doesn't
    // fall through to the plain text input.
    autonumber: 'field:auto_number',
    auto_number: 'field:auto_number',
  };

  return typeMap[fieldType] || 'field:text';
}
