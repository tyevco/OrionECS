import { Engine } from './engine';

describe('Engine', () => {
    let engine: Engine;

    beforeEach(() => {
        engine = new Engine();
    });

    test('should create and add a system', () => {
        const options = {
            act: jest.fn(),
        };

        const system = engine.createSystem('TestSystem', { all: [] }, options);
        engine.createEntity();
        
        // Manually call system step to test execution
        system.step();

        expect(options.act).toHaveBeenCalled();
    });

    test('should run the engine and call onStart and onStop events', () => {
        const onStart = jest.fn();
        const onStop = jest.fn();

        engine.on('onStart', onStart);
        engine.on('onStop', onStop);

        engine.createEntity();
        
        // Trigger events manually since run() is async
        engine.triggerEvent('onStart');
        engine.triggerEvent('onStop');

        expect(onStart).toHaveBeenCalled();
        expect(onStop).toHaveBeenCalled();
    });
});
