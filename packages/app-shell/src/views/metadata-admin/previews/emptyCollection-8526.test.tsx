// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * The empty-COLLECTION sentences under `metadata-admin/previews/` render the
 * shared `EmptyDescription` — used alone, outside any `Empty` container — in
 * place of a hand-rolled muted `div` (objectui#8526). Two of those files used
 * to declare a file-local component literally named `Empty`, which shadowed
 * the shared family in the one place a maintainer would reach for it.
 *
 * What each pin proves, per site:
 *
 *   1. the empty branch renders the family's block-level text slot
 *      (`data-slot="empty-description"`) carrying the site's own sentence, and
 *      not `EmptyValue` (a field-VALUE placeholder whose `aria-label` says
 *      "No value" — false about a collection);
 *   2. the populated branch renders its rows and NO `empty-description` at
 *      all — the assertion that refuses the caricature "EmptyDescription
 *      rendered unconditionally, populated collections included".
 *
 * ⚠️ Navigation vs. assertion. Every harness reaches a site's body slot
 * through a title its container owns (a `Section` heading, a rail label, a
 * panel header), never through anything the empty state renders. A pin that
 * navigated by `data-slot="empty-description"` would die on any caricature
 * that erases the description, and read as a strong refusal while measuring
 * nothing (objectui#8504, objectui#8520). The harness-kill leg — rename a
 * title the harness navigates by — fails with "Unable to find an element",
 * textually distinct from the assertion failures the other legs produce.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, cleanup, fireEvent } from '@testing-library/react';

// `ScreenPreview` reads both providers at its top level (`useAdapter()` /
// `useMetadata()`), exactly as `ScreenPreview.test.tsx` mocks them.
vi.mock('../../../providers/AdapterProvider', () => ({
  useAdapter: () => ({ fake: 'adapter' }),
}));
vi.mock('../../../providers/MetadataProvider', () => ({
  useMetadata: () => ({ objects: [] }),
}));
// `DatasourcePreview` mounts the live external panel next to the rail; stubbed
// the same way `DatasourcePreview.test.tsx` stubs it.
vi.mock('../external/ExternalDatasourcePanel', () => ({
  ExternalDatasourcePanel: () => <div data-testid="mock-external-panel" />,
}));

import { AgentPreview } from './AgentPreview';
import { ToolPreview } from './ToolPreview';
import { SkillPreview } from './SkillPreview';
import { DatasourcePreview } from './DatasourcePreview';
import { ActionPreview } from './ActionPreview';
import { EmailTemplatePreview } from './EmailTemplatePreview';
import { FlowPreview } from './FlowPreview';
import { FlowRunsPanel } from './FlowRunsPanel';
import { FlowSimulatorPanel } from './FlowSimulatorPanel';
import { JobPreview } from './JobPreview';
import { TranslationPreview } from './TranslationPreview';
import { ScreenPreview } from './ScreenPreview';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ED = '[data-slot="empty-description"]';
const EV = '[data-slot="empty-value"]';

/**
 * Self-inclusive query: several sites return the empty state AS the body
 * element itself, and `Element.querySelector` never matches the element it is
 * called on — the naive descendant query sat green through a measured
 * caricature on objectui#8520.
 */
function self(el: Element, selector: string): Element | null {
  return el.matches(selector) ? el : el.querySelector(selector);
}

/**
 * The body slot of a `Section` / `RailBlock` / rail-header block, reached by
 * the block's TITLE. Every such block in this directory renders
 * `<div><div.header>…{title}…</div>{children}</div>`: the title is either the
 * header's own text (a `div`) or a `span` inside it.
 */
function bodyByTitle(title: string | RegExp, root: HTMLElement = document.body): HTMLElement {
  const titleEl = within(root).getByText(title);
  const header = titleEl.tagName === 'SPAN' ? titleEl.parentElement! : titleEl;
  const block = header.parentElement!;
  const body = block.children[1] as HTMLElement | undefined;
  expect(body, `body slot under "${String(title)}"`).toBeTruthy();
  return body!;
}

/** The empty branch: the family's text slot, with this site's sentence, and no EmptyValue. */
function expectEmptyState(body: HTMLElement, sentence: string) {
  const slot = self(body, ED);
  expect(slot, 'the shared EmptyDescription slot').toBeTruthy();
  expect((slot!.textContent ?? '').trim()).toBe(sentence);
  expect(self(body, EV)).toBeNull();
}

/** The populated branch: no empty-description anywhere under this body — the caricature refuser. */
function expectPopulated(body: HTMLElement, sentence: string) {
  expect(self(body, ED)).toBeNull();
  // queryAllByText, not queryByText: the latter throws on MULTIPLE matches.
  expect(within(body).queryAllByText(sentence)).toHaveLength(0);
}

// ───────────────────────────── AgentPreview ─────────────────────────────

const AGENT = {
  name: 'sales_copilot',
  label: 'Sales Copilot',
  model: { provider: 'openai', model: 'gpt-4o' },
  instructions: 'Be kind.',
  skills: ['summarize_account'],
  planning: { maxIterations: 8 },
};

function renderAgent(draft: Record<string, unknown>) {
  return render(<AgentPreview type="agent" name="sales_copilot" draft={draft} />);
}

describe('AgentPreview — the three hand-rolled empties and the local `Empty` they went through', () => {
  const NO_PROMPT = 'No system prompt set yet.';
  const NO_SKILLS = 'No skills attached — this agent can reach no tools.';
  const DEFAULTS = 'Defaults in use.';

  /** The side rail has no heading of its own: reached as the grid column next to the one holding "Instructions". */
  function rail(): HTMLElement {
    const instructions = bodyByTitle('Instructions');
    const grid = instructions.closest('.grid') as HTMLElement | null;
    expect(grid, 'the preview grid').toBeTruthy();
    return grid!.children[1] as HTMLElement;
  }

  it('Instructions: an empty prompt is the shared empty-description slot', () => {
    renderAgent({ ...AGENT, instructions: '' });
    expectEmptyState(bodyByTitle('Instructions'), NO_PROMPT);
  });

  it('Instructions: a set prompt renders the pre and no empty-description', () => {
    renderAgent(AGENT);
    const body = bodyByTitle('Instructions');
    expect(within(body).getByText('Be kind.')).toBeTruthy();
    expectPopulated(body, NO_PROMPT);
  });

  it('Skills: an empty chip list is the shared empty-description slot', () => {
    renderAgent({ ...AGENT, skills: [] });
    expectEmptyState(bodyByTitle('Skills'), NO_SKILLS);
  });

  it('Skills: an attached skill renders its chip and no empty-description', () => {
    renderAgent(AGENT);
    const body = bodyByTitle('Skills');
    expect(within(body).getByText('summarize_account')).toBeTruthy();
    expectPopulated(body, NO_SKILLS);
  });

  it('side rail: no planning / memory / guardrails / permissions is the shared empty-description slot', () => {
    renderAgent({ ...AGENT, planning: undefined });
    expectEmptyState(rail(), DEFAULTS);
  });

  it('side rail: a planning block renders its rows and no empty-description', () => {
    renderAgent(AGENT);
    const body = rail();
    expect(within(body).getByText('Planning')).toBeTruthy();
    expect(within(body).getByText('maxIterations')).toBeTruthy();
    expectPopulated(body, DEFAULTS);
  });

  it('a fully populated agent renders no empty-description anywhere', () => {
    const { container } = renderAgent(AGENT);
    expect(container.querySelectorAll(ED)).toHaveLength(0);
  });
});

// ───────────────────────────── ToolPreview ─────────────────────────────

describe('ToolPreview — the empty parameter set and the local `Empty` it went through', () => {
  const SENTENCE = 'This tool takes no input parameters.';
  const TOOL = { name: 'ping', description: 'Pings.', parameters: { type: 'object', properties: {} } };

  it('no parameters is the shared empty-description slot', () => {
    render(<ToolPreview type="tool" name="ping" draft={TOOL} />);
    expectEmptyState(bodyByTitle('Input Parameters'), SENTENCE);
  });

  it('a declared parameter renders the table and no empty-description', () => {
    render(
      <ToolPreview
        type="tool"
        name="ping"
        draft={{ ...TOOL, parameters: { type: 'object', properties: { host: { type: 'string' } }, required: ['host'] } }}
      />,
    );
    const body = bodyByTitle('Input Parameters');
    expect(within(body).getByText('host')).toBeTruthy();
    expectPopulated(body, SENTENCE);
  });
});

// ───────────────────────────── SkillPreview ─────────────────────────────

describe('SkillPreview — the empty tool whitelist', () => {
  const SENTENCE = 'No tools whitelisted.';
  const SKILL = { name: 'draft_email', instructions: 'Draft it.', tools: [] as string[] };

  it('no tools is the shared empty-description slot', () => {
    render(<SkillPreview type="skill" name="draft_email" draft={SKILL} />);
    expectEmptyState(bodyByTitle('Tools (0)'), SENTENCE);
  });

  it('a whitelisted tool renders its chip and no empty-description', () => {
    render(<SkillPreview type="skill" name="draft_email" draft={{ ...SKILL, tools: ['send_email'] }} />);
    const body = bodyByTitle('Tools (1)');
    expect(within(body).getByText('send_email')).toBeTruthy();
    expectPopulated(body, SENTENCE);
  });
});

// ───────────────────────────── DatasourcePreview ─────────────────────────────

describe('DatasourcePreview — the empty connection config', () => {
  const SENTENCE = 'No config keys set.';
  const DS = { name: 'warehouse', driver: 'postgres', config: {} };

  it('no config keys is the shared empty-description slot', () => {
    render(<DatasourcePreview type="datasource" name="warehouse" draft={DS} />);
    expectEmptyState(bodyByTitle('Connection'), SENTENCE);
  });

  it('a config key renders the table and no empty-description', () => {
    render(<DatasourcePreview type="datasource" name="warehouse" draft={{ ...DS, config: { host: 'db.local' } }} />);
    const body = bodyByTitle('Connection');
    expect(within(body).getByText('host')).toBeTruthy();
    expectPopulated(body, SENTENCE);
  });
});

// ───────────────────────────── ActionPreview ─────────────────────────────

describe('ActionPreview — a result dialog with no fields', () => {
  const SENTENCE = 'Renders full JSON response.';
  const ACTION = { name: 'rotate_secret', label: 'Rotate secret', resultDialog: { title: 'Rotated', fields: [] } };

  it('no result fields is the shared empty-description slot', () => {
    render(<ActionPreview type="action" name="rotate_secret" draft={ACTION} />);
    expectEmptyState(bodyByTitle('Result Dialog'), SENTENCE);
  });

  it('a result field renders its row and no empty-description', () => {
    render(
      <ActionPreview
        type="action"
        name="rotate_secret"
        draft={{ ...ACTION, resultDialog: { title: 'Rotated', fields: [{ path: 'secret', label: 'New secret' }] } }}
      />,
    );
    const body = bodyByTitle('Result Dialog');
    expect(within(body).getByText('New secret')).toBeTruthy();
    expectPopulated(body, SENTENCE);
  });
});

// ───────────────────────────── EmailTemplatePreview ─────────────────────────────

describe('EmailTemplatePreview — a template with no placeholders', () => {
  // The sentence carries a <code> child, so it is matched on the slot's text.
  const SENTENCE = 'No {{var}} placeholders found.';

  it('no placeholders is the shared empty-description slot', () => {
    render(<EmailTemplatePreview type="email_template" name="welcome" draft={{ subject: 'Welcome', bodyText: 'Hello there.' }} />);
    expectEmptyState(bodyByTitle('Variables'), SENTENCE);
  });

  it('a detected placeholder renders its input and no empty-description', () => {
    render(<EmailTemplatePreview type="email_template" name="welcome" draft={{ subject: 'Welcome {{name}}', bodyText: 'Hello there.' }} />);
    const body = bodyByTitle('Variables');
    expect(within(body).getByText('name')).toBeTruthy();
    expectPopulated(body, SENTENCE);
  });
});

// ───────────────────────────── FlowPreview ─────────────────────────────

describe('FlowPreview — the variables rail with no declared variables', () => {
  const SENTENCE = 'No variables declared.';
  const FLOW = {
    name: 'ping_flow',
    nodes: [
      { id: 's', type: 'start' },
      { id: 'e', type: 'end' },
    ],
    edges: [{ source: 's', target: 'e' }],
    variables: [] as Array<Record<string, unknown>>,
  };

  /** The canvas palette fetches the action catalogue; a 404 is its normal offline answer. */
  function stubCatalogue() {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })));
  }

  /** The rail header is a `div` reading "Variables"; the toggle button reads the same word. */
  function railBody(): HTMLElement {
    fireEvent.click(screen.getByTitle('Show variables panel'));
    const header = screen.getAllByText('Variables').find((el) => el.tagName === 'DIV');
    expect(header, 'the variables rail header').toBeTruthy();
    const body = header!.parentElement!.children[1] as HTMLElement;
    expect(body).toBeTruthy();
    return body;
  }

  it('no variables is the shared empty-description slot', () => {
    stubCatalogue();
    render(<FlowPreview type="flow" name="ping_flow" draft={FLOW} />);
    expectEmptyState(railBody(), SENTENCE);
  });

  it('a declared variable renders its row and no empty-description', () => {
    stubCatalogue();
    render(<FlowPreview type="flow" name="ping_flow" draft={{ ...FLOW, variables: [{ name: 'amount', type: 'number' }] }} />);
    const body = railBody();
    expect(within(body).getByText('amount')).toBeTruthy();
    expectPopulated(body, SENTENCE);
  });
});

// ───────────────────────────── FlowRunsPanel ─────────────────────────────

describe('FlowRunsPanel — no runs, and a run with no step log', () => {
  const NO_RUNS = 'No runs yet.';
  const NO_STEPS = 'No step log recorded.';
  const RUN = {
    id: 'run_8526',
    status: 'completed',
    startedAt: '2026-09-08T10:00:00.000Z',
    durationMs: 12,
    trigger: { type: 'manual' },
    steps: [] as Array<Record<string, unknown>>,
  };

  function stubRuns(runs: unknown[]) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ success: true, data: { runs } }), { status: 200 })),
    );
  }

  it('an empty run list is the shared empty-description slot', async () => {
    stubRuns([]);
    render(<FlowRunsPanel flowName="ping_flow" />);
    await screen.findByText(NO_RUNS);
    expectEmptyState(bodyByTitle('Runs'), NO_RUNS);
  });

  it('a listed run renders its row and no empty-description at the list level', async () => {
    stubRuns([RUN]);
    render(<FlowRunsPanel flowName="ping_flow" />);
    await screen.findByRole('button', { expanded: false });
    expectPopulated(bodyByTitle('Runs'), NO_RUNS);
  });

  /** The expanded run body, reached by the run-id line it opens with. */
  async function expandedRunBody(): Promise<HTMLElement> {
    fireEvent.click(await screen.findByRole('button', { expanded: false }));
    const idLine = await screen.findByText(/^run run_8526/);
    return idLine.parentElement as HTMLElement;
  }

  it('a run with no step log is the shared empty-description slot', async () => {
    stubRuns([RUN]);
    render(<FlowRunsPanel flowName="ping_flow" />);
    expectEmptyState(await expandedRunBody(), NO_STEPS);
  });

  it('a run with steps renders them and no empty-description', async () => {
    // A node id distinct from its type label: `start`/`start` renders the same word twice.
    stubRuns([{ ...RUN, steps: [{ nodeId: 'fetch_orders', nodeType: 'http', status: 'success' }] }]);
    render(<FlowRunsPanel flowName="ping_flow" />);
    const body = await expandedRunBody();
    expect(within(body).getByText('fetch_orders')).toBeTruthy();
    expectPopulated(body, NO_STEPS);
  });
});

// ───────────────────────────── FlowSimulatorPanel ─────────────────────────────

describe('FlowSimulatorPanel — no scratch variables, and a run that set none', () => {
  const SCRATCH_HINT = 'Override or inject any variable (wins over inputs and mocks at start).';
  const NO_VARS = 'No variables set.';
  const FLOW = {
    nodes: [
      { id: 's', type: 'start' },
      { id: 'e', type: 'end' },
    ],
    edges: [{ source: 's', target: 'e' }],
  };

  /** The variable-watch header is a `div` reading "Variables". */
  function watchBody(): HTMLElement {
    const header = screen.getAllByText('Variables').find((el) => el.tagName === 'DIV');
    expect(header, 'the variable-watch header').toBeTruthy();
    return header!.parentElement!.children[1] as HTMLElement;
  }

  it('no scratch rows is the shared empty-description slot', () => {
    render(<FlowSimulatorPanel nodes={FLOW.nodes} edges={FLOW.edges} variables={[]} />);
    expectEmptyState(bodyByTitle('Set variables'), SCRATCH_HINT);
  });

  it('an added scratch row renders its inputs and no empty-description', () => {
    render(<FlowSimulatorPanel nodes={FLOW.nodes} edges={FLOW.edges} variables={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    const body = bodyByTitle('Set variables');
    expect(within(body).getAllByRole('textbox').length).toBeGreaterThan(0);
    expectPopulated(body, SCRATCH_HINT);
  });

  it('a run that set no variables is the shared empty-description slot', () => {
    render(<FlowSimulatorPanel nodes={FLOW.nodes} edges={FLOW.edges} variables={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /^run$/i }));
    expectEmptyState(watchBody(), NO_VARS);
  });

  it('a run seeded from a declared input renders the variable and no empty-description', () => {
    render(
      <FlowSimulatorPanel
        nodes={FLOW.nodes}
        edges={FLOW.edges}
        variables={[{ name: 'amount', type: 'number', isInput: true, defaultValue: 5 }]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^run$/i }));
    const body = watchBody();
    expect(within(body).getByText('amount')).toBeTruthy();
    expectPopulated(body, NO_VARS);
  });
});

// ───────────────────────────── JobPreview ─────────────────────────────

describe('JobPreview — a job with no schedule keys', () => {
  const SENTENCE = 'No schedule set — runs only when triggered manually.';
  const JOB = { name: 'nightly_cleanup', handler: 'jobs.cleanup' };

  it('no schedule is the shared empty-description slot', () => {
    render(<JobPreview type="job" name="nightly_cleanup" draft={JOB} />);
    expectEmptyState(bodyByTitle('Schedule'), SENTENCE);
  });

  it('a cron schedule renders its line and no empty-description', () => {
    render(<JobPreview type="job" name="nightly_cleanup" draft={{ ...JOB, schedule: { type: 'cron', expression: '0 0 * * *' } }} />);
    const body = bodyByTitle('Schedule');
    expect(within(body).getByText('0 0 * * *')).toBeTruthy();
    expectPopulated(body, SENTENCE);
  });
});

// ───────────────────────────── TranslationPreview ─────────────────────────────

describe('TranslationPreview — a category with no keys', () => {
  const SENTENCE = 'empty';
  const BUNDLE = { locale: 'en', data: { messages: { hello: 'Hello' }, objects: {} } };

  /** The category card, reached by its label; its body is the card's second child. */
  function objectsCard(): HTMLElement {
    const label = screen.getAllByText('Objects').find((el) => el.closest('.rounded.border'));
    expect(label, 'the Objects category card label').toBeTruthy();
    const card = label!.closest('.rounded.border') as HTMLElement;
    return card.children[1] as HTMLElement;
  }

  it('an empty category is the shared empty-description slot', () => {
    render(<TranslationPreview type="translation" name="en" draft={BUNDLE} />);
    expectEmptyState(objectsCard(), SENTENCE);
  });

  it('a populated category renders its sample and no empty-description', () => {
    render(
      <TranslationPreview
        type="translation"
        name="en"
        draft={{ ...BUNDLE, data: { ...BUNDLE.data, objects: { account: { label: 'Account' } } } }}
      />,
    );
    const body = objectsCard();
    expect(within(body).getByText('account')).toBeTruthy();
    expectPopulated(body, SENTENCE);
  });
});

// ───────────────────────────── ScreenPreview ─────────────────────────────

describe('ScreenPreview — a screen with nothing configured', () => {
  const SENTENCE = 'Add a title, description, fields, or an object form to preview this screen.';

  it('an unconfigured screen is the shared empty-description slot, at the body scale', () => {
    render(<ScreenPreview node={{ id: 's1', config: {} }} />);
    const body = bodyByTitle('Preview');
    expectEmptyState(body, SENTENCE);
    // The deliberate outlier: this sentence stands in for the screen body,
    // whose description renders at text-sm — not for a text-xs rail row.
    expect(self(body, ED)!.className).toContain('text-sm');
  });

  it('a titled screen renders its heading and no empty-description', () => {
    render(<ScreenPreview node={{ id: 's1', config: { title: 'Step one' } }} />);
    const body = bodyByTitle('Preview');
    expect(within(body).getByText('Step one')).toBeTruthy();
    expectPopulated(body, SENTENCE);
  });
});
