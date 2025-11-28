import { RuleTester } from '@typescript-eslint/rule-tester';
import { noNestedTransactions } from '../rules/no-nested-transactions';

const ruleTester = new RuleTester();

ruleTester.run('no-nested-transactions', noNestedTransactions, {
    valid: [
        // Single transaction
        {
            code: `
        engine.beginTransaction();
        engine.createEntity();
        engine.commitTransaction();
      `,
        },
        // Sequential transactions
        {
            code: `
        engine.beginTransaction();
        engine.createEntity();
        engine.commitTransaction();

        engine.beginTransaction();
        engine.createEntity();
        engine.commitTransaction();
      `,
        },
        // Transaction with rollback
        {
            code: `
        engine.beginTransaction();
        try {
          engine.createEntity();
          engine.commitTransaction();
        } catch (e) {
          engine.rollbackTransaction();
        }
      `,
        },
        // Transactions in different functions
        {
            code: `
        function createBatch1() {
          engine.beginTransaction();
          engine.createEntity();
          engine.commitTransaction();
        }

        function createBatch2() {
          engine.beginTransaction();
          engine.createEntity();
          engine.commitTransaction();
        }
      `,
        },
    ],
    invalid: [
        // Nested beginTransaction
        {
            code: `
        engine.beginTransaction();
        engine.beginTransaction();
        engine.commitTransaction();
        engine.commitTransaction();
      `,
            errors: [{ messageId: 'nestedTransaction' }],
        },
        // Multiple nested levels
        {
            code: `
        engine.beginTransaction();
        engine.beginTransaction();
        engine.beginTransaction();
        engine.commitTransaction();
        engine.commitTransaction();
        engine.commitTransaction();
      `,
            errors: [{ messageId: 'nestedTransaction' }, { messageId: 'nestedTransaction' }],
        },
        // Nested in conditional (still bad if reachable)
        {
            code: `
        engine.beginTransaction();
        if (condition) {
          engine.beginTransaction();
        }
        engine.commitTransaction();
      `,
            errors: [{ messageId: 'nestedTransaction' }],
        },
    ],
});
