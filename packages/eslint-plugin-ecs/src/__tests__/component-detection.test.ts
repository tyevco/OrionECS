import { RuleTester } from '@typescript-eslint/rule-tester';
import { dataOnlyComponents } from '../rules/data-only-components';

const ruleTester = new RuleTester();

/**
 * Tests for usage-based component detection.
 *
 * When detectFromUsage is enabled, the rule identifies components by tracking
 * calls to addComponent, createSystem, registerComponent, etc.
 */
ruleTester.run('data-only-components (detectFromUsage)', dataOnlyComponents, {
    valid: [
        // Class not used as a component - should not be flagged even with a method
        {
            code: `
        class NotAComponent {
          constructor(public x: number) {}
          doSomething() { return this.x * 2; }
        }
      `,
            options: [{ detectFromUsage: true, componentPattern: '^$' }],
        },
        // Data-only class used as a component
        {
            code: `
        class Foo {
          constructor(public x: number) {}
        }
        entity.addComponent(Foo, 1);
      `,
            options: [{ detectFromUsage: true, componentPattern: '^$' }],
        },
        // Component used in createSystem query
        {
            code: `
        class Bar {
          constructor(public value: string) {}
        }
        engine.createSystem('test', { all: [Bar] }, { act: () => {} });
      `,
            options: [{ detectFromUsage: true, componentPattern: '^$' }],
        },
    ],
    invalid: [
        // Class with method detected as component via addComponent
        {
            code: `
        class MyClass {
          constructor(public x: number) {}
          calculate() { return this.x * 2; }
        }
        entity.addComponent(MyClass, 1);
      `,
            options: [{ detectFromUsage: true, componentPattern: '^$' }],
            errors: [{ messageId: 'noMethodsInComponent' }],
        },
        // Class with method detected via createSystem query
        {
            code: `
        class QueryComp {
          constructor(public value: number) {}
          process() { return this.value; }
        }
        engine.createSystem('test', { all: [QueryComp] }, { act: () => {} });
      `,
            options: [{ detectFromUsage: true, componentPattern: '^$' }],
            errors: [{ messageId: 'noMethodsInComponent' }],
        },
        // Class detected via getComponent
        {
            code: `
        class GetComp {
          constructor(public data: string) {}
          transform() { return this.data.toUpperCase(); }
        }
        const comp = entity.getComponent(GetComp);
      `,
            options: [{ detectFromUsage: true, componentPattern: '^$' }],
            errors: [{ messageId: 'noMethodsInComponent' }],
        },
        // Class detected via hasComponent
        {
            code: `
        class HasComp {
          constructor(public flag: boolean) {}
          toggle() { this.flag = !this.flag; }
        }
        if (entity.hasComponent(HasComp)) {}
      `,
            options: [{ detectFromUsage: true, componentPattern: '^$' }],
            errors: [{ messageId: 'noMethodsInComponent' }],
        },
        // Class detected via registerComponent
        {
            code: `
        class RegisteredComp {
          constructor(public id: number) {}
          getId() { return this.id; }
        }
        engine.registerComponent(RegisteredComp);
      `,
            options: [{ detectFromUsage: true, componentPattern: '^$' }],
            errors: [{ messageId: 'noMethodsInComponent' }],
        },
        // Class detected via fluent query builder
        {
            code: `
        class FluentComp {
          constructor(public name: string) {}
          getName() { return this.name; }
        }
        engine.query().withAll(FluentComp).build();
      `,
            options: [{ detectFromUsage: true, componentPattern: '^$' }],
            errors: [{ messageId: 'noMethodsInComponent' }],
        },
        // Multiple components in query
        {
            code: `
        class CompA {
          constructor(public a: number) {}
          methodA() {}
        }
        class CompB {
          constructor(public b: number) {}
          methodB() {}
        }
        engine.createSystem('test', { all: [CompA], none: [CompB] }, {});
      `,
            options: [{ detectFromUsage: true, componentPattern: '^$' }],
            errors: [{ messageId: 'noMethodsInComponent' }, { messageId: 'noMethodsInComponent' }],
        },
        // Singleton component detection
        {
            code: `
        class SingletonComp {
          constructor(public value: number) {}
          getValue() { return this.value; }
        }
        engine.setSingleton(SingletonComp, 42);
      `,
            options: [{ detectFromUsage: true, componentPattern: '^$' }],
            errors: [{ messageId: 'noMethodsInComponent' }],
        },
    ],
});
