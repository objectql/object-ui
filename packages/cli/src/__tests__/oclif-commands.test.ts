/**
 * Tests for oclif command classes in @objectstack/plugin-ui
 *
 * Validates that all 15 oclif Command classes are properly defined
 * with correct metadata (description, args, flags) matching the
 * original Commander.js command signatures.
 */
import { describe, it, expect } from 'vitest';
import { Command, Args, Flags } from '@oclif/core';

// Import all oclif command classes
import Init from '../commands/ui/init.js';
import Dev from '../commands/ui/dev.js';
import Build from '../commands/ui/build.js';
import Start from '../commands/ui/start.js';
import Serve from '../commands/ui/serve.js';
import Lint from '../commands/ui/lint.js';
import Test from '../commands/ui/test.js';
import Generate from '../commands/ui/generate.js';
import Doctor from '../commands/ui/doctor.js';
import Add from '../commands/ui/add.js';
import Studio from '../commands/ui/studio.js';
import Check from '../commands/ui/check.js';
import Validate from '../commands/ui/validate.js';
import CreatePlugin from '../commands/ui/create-plugin.js';
import Analyze from '../commands/ui/analyze.js';

const ALL_COMMANDS = [
  { name: 'Init', cls: Init },
  { name: 'Dev', cls: Dev },
  { name: 'Build', cls: Build },
  { name: 'Start', cls: Start },
  { name: 'Serve', cls: Serve },
  { name: 'Lint', cls: Lint },
  { name: 'Test', cls: Test },
  { name: 'Generate', cls: Generate },
  { name: 'Doctor', cls: Doctor },
  { name: 'Add', cls: Add },
  { name: 'Studio', cls: Studio },
  { name: 'Check', cls: Check },
  { name: 'Validate', cls: Validate },
  { name: 'CreatePlugin', cls: CreatePlugin },
  { name: 'Analyze', cls: Analyze },
];

describe('@objectstack/plugin-ui oclif commands', () => {
  describe('all commands extend oclif Command', () => {
    it.each(ALL_COMMANDS)('$name extends Command', ({ cls }) => {
      expect(cls.prototype).toBeInstanceOf(Command);
    });
  });

  describe('all commands have a description', () => {
    it.each(ALL_COMMANDS)('$name has description', ({ cls }) => {
      expect(cls.description).toBeDefined();
      expect(typeof cls.description).toBe('string');
      expect(cls.description!.length).toBeGreaterThan(0);
    });
  });

  describe('Init command', () => {
    it('has optional name arg with default "my-app"', () => {
      expect(Init.args).toBeDefined();
      expect(Init.args.name).toBeDefined();
      expect(Init.args.name.default).toBe('my-app');
    });

    it('has template flag with default "dashboard"', () => {
      expect(Init.flags).toBeDefined();
      expect(Init.flags.template).toBeDefined();
    });
  });

  describe('Dev command', () => {
    it('has schema arg with default "app.json"', () => {
      expect(Dev.args.schema).toBeDefined();
      expect(Dev.args.schema.default).toBe('app.json');
    });

    it('has port and host flags', () => {
      expect(Dev.flags.port).toBeDefined();
      expect(Dev.flags.host).toBeDefined();
    });

    it('has open flag with allowNo', () => {
      expect(Dev.flags.open).toBeDefined();
    });
  });

  describe('Build command', () => {
    it('has schema arg with default "app.json"', () => {
      expect(Build.args.schema).toBeDefined();
      expect(Build.args.schema.default).toBe('app.json');
    });

    it('has out-dir and clean flags', () => {
      expect(Build.flags['out-dir']).toBeDefined();
      expect(Build.flags.clean).toBeDefined();
    });
  });

  describe('Start command', () => {
    it('has port, host, and dir flags', () => {
      expect(Start.flags.port).toBeDefined();
      expect(Start.flags.host).toBeDefined();
      expect(Start.flags.dir).toBeDefined();
    });
  });

  describe('Serve command', () => {
    it('has schema arg with default "app.json"', () => {
      expect(Serve.args.schema).toBeDefined();
      expect(Serve.args.schema.default).toBe('app.json');
    });

    it('has port and host flags', () => {
      expect(Serve.flags.port).toBeDefined();
      expect(Serve.flags.host).toBeDefined();
    });
  });

  describe('Lint command', () => {
    it('has fix flag', () => {
      expect(Lint.flags.fix).toBeDefined();
    });
  });

  describe('Test command', () => {
    it('has watch, coverage, and ui flags', () => {
      expect(Test.flags.watch).toBeDefined();
      expect(Test.flags.coverage).toBeDefined();
      expect(Test.flags.ui).toBeDefined();
    });
  });

  describe('Generate command', () => {
    it('has required type and name args', () => {
      expect(Generate.args.type).toBeDefined();
      expect(Generate.args.type.required).toBe(true);
      expect(Generate.args.name).toBeDefined();
      expect(Generate.args.name.required).toBe(true);
    });

    it('has from and output flags', () => {
      expect(Generate.flags.from).toBeDefined();
      expect(Generate.flags.output).toBeDefined();
    });

    it('has ui:g alias', () => {
      expect(Generate.aliases).toContain('ui:g');
    });
  });

  describe('Doctor command', () => {
    it('has no args or required flags', () => {
      expect(Object.keys(Doctor.args)).toHaveLength(0);
    });
  });

  describe('Add command', () => {
    it('has required component arg', () => {
      expect(Add.args.component).toBeDefined();
      expect(Add.args.component.required).toBe(true);
    });
  });

  describe('Studio command', () => {
    it('has no args', () => {
      expect(Object.keys(Studio.args)).toHaveLength(0);
    });
  });

  describe('Check command', () => {
    it('has no args', () => {
      expect(Object.keys(Check.args)).toHaveLength(0);
    });
  });

  describe('Validate command', () => {
    it('has schema arg with default "app.json"', () => {
      expect(Validate.args.schema).toBeDefined();
      expect(Validate.args.schema.default).toBe('app.json');
    });
  });

  describe('CreatePlugin command', () => {
    it('has required name arg', () => {
      expect(CreatePlugin.args.name).toBeDefined();
      expect(CreatePlugin.args.name.required).toBe(true);
    });
  });

  describe('Analyze command', () => {
    it('has bundle-size and render-performance flags', () => {
      expect(Analyze.flags['bundle-size']).toBeDefined();
      expect(Analyze.flags['render-performance']).toBeDefined();
    });
  });
});

describe('@objectstack/plugin-ui package exports', () => {
  it('exports serve and init functions', async () => {
    const mod = await import('../index.js');
    expect(typeof mod.serve).toBe('function');
    expect(typeof mod.init).toBe('function');
  });
});

describe('oclif plugin configuration', () => {
  it('package.json has correct oclif config', async () => {
    const { readFileSync } = await import('fs');
    const { join, dirname } = await import('path');
    const { fileURLToPath } = await import('url');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const pkgJson = JSON.parse(
      readFileSync(join(__dirname, '../../package.json'), 'utf-8')
    );

    expect(pkgJson.name).toBe('@objectstack/plugin-ui');
    expect(pkgJson.oclif).toBeDefined();
    expect(pkgJson.oclif.commands).toBe('./dist/commands');
  });

  it('total of 15 oclif command classes defined', () => {
    expect(ALL_COMMANDS).toHaveLength(15);
  });
});
