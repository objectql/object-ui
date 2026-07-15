// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Guards the package-namespace resolution that feeds the authoring dialogs
 * (framework#2694). `parsePackages` must expose each package's object-name
 * namespace — an explicit `manifest.namespace` wins, otherwise it is
 * back-derived from the id via the spec-owned `deriveNamespaceFromPackageId`
 * (the SAME rule the kernel enforces at publish, so authoring surfaces prefix
 * object names before publish would reject them). No re-implemented rule here.
 */
import { describe, expect, it } from 'vitest';
import { parsePackages, prefixObjectName } from './packages-io';

function wrap(packages: Array<Record<string, unknown>>) {
  return { data: { packages } };
}

describe('parsePackages — namespace resolution', () => {
  it('back-derives the namespace from the package id when none is declared', () => {
    const [pkg] = parsePackages(wrap([{ manifest: { id: 'com.example.leave', name: 'Leave' } }]));
    expect(pkg.namespace).toBe('leave');
  });

  it('keeps an explicitly declared namespace over the id-derived one', () => {
    const [pkg] = parsePackages(
      wrap([{ manifest: { id: 'com.acme.hot-crm', name: 'HotCRM', namespace: 'crm' } }]),
    );
    expect(pkg.namespace).toBe('crm');
  });

  it('sanitizes the derived namespace to the spec shape', () => {
    // `deriveNamespaceFromPackageId` lowercases + sanitizes the last segment.
    const [pkg] = parsePackages(wrap([{ manifest: { id: 'com.acme.HR-Tickets', name: 'HR' } }]));
    expect(pkg.namespace).toBe('hr_tickets');
  });

  it('is null when the id yields nothing derivable', () => {
    const [pkg] = parsePackages(wrap([{ manifest: { id: '...', name: 'Weird' } }]));
    expect(pkg.namespace).toBeNull();
  });

  it('ignores a blank declared namespace and falls back to the derived value', () => {
    const [pkg] = parsePackages(
      wrap([{ manifest: { id: 'com.example.leave', name: 'Leave', namespace: '' } }]),
    );
    expect(pkg.namespace).toBe('leave');
  });
});

describe('prefixObjectName', () => {
  it('prepends the namespace to a prefix-less name', () => {
    expect(prefixObjectName('ticket', 'hr')).toBe('hr_ticket');
  });

  it('leaves an already-compliant name untouched (no double prefix)', () => {
    expect(prefixObjectName('hr_ticket', 'hr')).toBe('hr_ticket');
  });

  it('leaves an exempt sys_* name untouched', () => {
    expect(prefixObjectName('sys_user', 'hr')).toBe('sys_user');
  });

  it('passes the name through when there is no namespace', () => {
    expect(prefixObjectName('ticket', null)).toBe('ticket');
    expect(prefixObjectName('ticket', '')).toBe('ticket');
  });
});
