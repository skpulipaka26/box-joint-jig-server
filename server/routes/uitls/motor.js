import admin from 'firebase-admin';
import pigpio from 'pigpio';

import {
    calculateAllSteps,
    DIRECTIONS,
    getMotorSteps,
    rewind as _rewind,
    turnClockWise,
    turnCounterClockWise,
    controllerStatus,
    tunControllerOff
} from './stepper';

export async function getSteps(bladeThickness, fingerWidth, tolerance, offset, workPieceWidth) {
    const steps = calculateAllSteps(bladeThickness, fingerWidth, tolerance, offset, workPieceWidth);
    console.log({ allSteps: steps });
    const cutListCollection = admin.firestore().collection('cutList');
    await cutListCollection.doc('motorSteps').set({ steps });
    await cutListCollection.doc('currentCutIndex').set({ index: 0 });
    return steps;
}

export async function spin() {
    const status = controllerStatus();
    if (!status) {
        console.log('controller not on');
        return 'controller not on';
    }
    const cutListCollection = admin.firestore().collection('cutList');
    const { steps } = (await cutListCollection.doc('motorSteps').get()).data() || {};
    const { index } = (await cutListCollection.doc('currentCutIndex').get()).data() || {};
    if (steps[index]) {
        console.log({ steps: steps[index] })
        turnCounterClockWise(steps[index]);
        await cutListCollection.doc('currentCutIndex').set({ index: index + 1 });
        return 'done spinning';
    } else {
        console.log('no step found');
        return 'no step found - create them';
    }
}

export async function rewind() {
    const cutListCollection = admin.firestore().collection('cutList');
    const { steps } = (await cutListCollection.doc('motorSteps').get()).data() || {};
    const { index } = (await cutListCollection.doc('currentCutIndex').get()).data() || {};
    const stepsTaken = steps.filter((_, i) => i < index).reduce((a, b) => a + b, 0);
    console.log({ stepsTaken });
    const status = controllerStatus();
    if (!status) {
        console.log('controller not on');
        return 'controller not on';
    }
    _rewind(stepsTaken);
    await cutListCollection.doc('motorSteps').set({ steps: [] });
    await cutListCollection.doc('currentCutIndex').set({ index: 0 });
    tunControllerOff();
    return 'welcome home';
}

export async function nudge(direction, travel) {
    const status = controllerStatus();
    if (!status) {
        console.log('controller not on');
        return 'controller not on';
    }
    const cutListCollection = admin.firestore().collection('cutList');
    const { index } = (await cutListCollection.doc('currentCutIndex').get()).data() || {};
    // only allow nudging when the cut is not in progress
    if (index && index > 0) {
        return 'cannot nudge now - in progress';
    }
    const motorSteps = getMotorSteps(travel);
    if (direction === DIRECTIONS.CLOCKWISE) {
        turnClockWise(motorSteps);
    } else {
        turnCounterClockWise(motorSteps);
    }
    return `nudged ${direction}`;
}

const Gpio = pigpio.Gpio;

const goButton = new Gpio(4, {
    mode: Gpio.INPUT,
    pullUpDown: Gpio.PUD_UP,
    alert: true
});

const leftNudgeButton = new Gpio(5, {
    mode: Gpio.INPUT,
    pullUpDown: Gpio.PUD_UP,
    alert: true
});

const rightNudgeButton = new Gpio(6, {
    mode: Gpio.INPUT,
    pullUpDown: Gpio.PUD_UP,
    alert: true
});

const resetButton = new Gpio(3, {
    mode: Gpio.INPUT,
    pullUpDown: Gpio.PUD_UP,
    alert: true
});

const BUTTON_NAMES = {
    GO_BUTTON: 'GO_BUTTON',
    LEFT_BUTTON: 'LEFT_BUTTON',
    RIGHT_BUTTON: 'RIGHT_BUTTON',
    RESET_BUTTON: 'RESET_BUTTON'
}

const allButtons = [
    {
        name: BUTTON_NAMES.GO_BUTTON,
        value: goButton
    },
    {
        name: BUTTON_NAMES.LEFT_BUTTON,
        value: leftNudgeButton
    },
    {
        name: BUTTON_NAMES.RIGHT_BUTTON,
        value: rightNudgeButton
    },
    {
        name: BUTTON_NAMES.RESET_BUTTON,
        value: resetButton
    },
];

allButtons.forEach(({ value, name }) => {
    // Level must be stable for 10 ms before an alert event is emitted.
    value.glitchFilter(10000);

    value.on('alert', async (level) => {
        if (level === 0) {
            console.log(`${name} pressed`);
            switch (name) {
                case BUTTON_NAMES.GO_BUTTON: {
                    await spin();
                    break;
                }
                case BUTTON_NAMES.LEFT_BUTTON: {
                    await nudge(DIRECTIONS.CLOCKWISE, 1 / 64);
                    break;
                }
                case BUTTON_NAMES.RIGHT_BUTTON: {
                    await nudge(DIRECTIONS.COUNTER_CLOCKWISE, 1 / 64);
                    break;
                }
                case BUTTON_NAMES.RESET_BUTTON: {
                    await rewind();
                    break;
                }
                default: {
                    break;
                }
            }
        }
    });
});


