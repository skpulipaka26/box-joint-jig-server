import pigpio from 'pigpio';
const Gpio = pigpio.Gpio;

const ENA = 22;
const DIR = 27;
const STEP = 17;

const MICRO_STEPS = 200;
const TPI = 16;

const enable = new Gpio(ENA, { mode: Gpio.OUTPUT });
const direction = new Gpio(DIR, { mode: Gpio.OUTPUT });
const step = new Gpio(STEP, { mode: Gpio.OUTPUT });

export const DIRECTIONS = {
    CLOCKWISE: 'CLOCKWISE',
    COUNTER_CLOCKWISE: 'COUNTER_CLOCKWISE',
};

export const DIRECTIONS_VALUES = {
    [DIRECTIONS.CLOCKWISE]: 1,
    [DIRECTIONS.COUNTER_CLOCKWISE]: 0
}

export function controllerStatus() {
    return enable.digitalRead();
}

export function tunControllerOn() {
    if (controllerStatus() === 0) {
        enable.digitalWrite(1);
    }
}

export function tunControllerOff() {
    if (controllerStatus() === 1) {
        enable.digitalWrite(0);
    }
}

export function spin(steps) {
    const maxPulses = 11000;
    try {
        const maxRequiredPulses = Math.min(maxPulses, (steps * 2));
        const requiredMotorSteps = maxRequiredPulses / 2;
        console.log({ steps, requiredMotorSteps });
        const outPin = STEP;
        const waveform = [];
        for (let x = 0; x < requiredMotorSteps; x++) {
            waveform.push({ gpioOn: outPin, gpioOff: 0, usDelay: 500 });
            waveform.push({ gpioOn: 0, gpioOff: outPin, usDelay: 500 });
        }
        pigpio.waveClear();
        pigpio.waveAddGeneric(waveform);
        const waveId = pigpio.waveCreate();
        if (waveId >= 0) {
            pigpio.waveTxSend(waveId, pigpio.WAVE_MODE_ONE_SHOT);
        }
        while (pigpio.waveTxBusy()) { }
        pigpio.waveDelete(waveId);
        if (steps > requiredMotorSteps) {
            spin(steps - requiredMotorSteps);
        }
    } catch (error) {
        console.log(error);
    }
}

export function turnClockWise(steps) {
    direction.digitalWrite(DIRECTIONS_VALUES.CLOCKWISE);
    spin(steps);
}

export function turnCounterClockWise(steps) {
    direction.digitalWrite(DIRECTIONS_VALUES.COUNTER_CLOCKWISE);
    spin(steps);
}

export function getRevolutions(travel) {
    return travel / (TPI ** -1);
}

export function getMotorSteps(travel) {
    const revolutions = getRevolutions(travel);
    // since we are using NEMA 17 1.8 Deg per step
    return MICRO_STEPS * revolutions;
}


export function calculateAllSteps(
    bladeThickness = 0.1010,
    fingerWidth = 1 / 4,
    tolerance = 0.005,
    offset = true,
    workPieceWidth = 1.5) {
    const steps = [];
    let totalLengthCovered = 0;

    // setup for the first cut
    steps.push(getMotorSteps(bladeThickness));

    if (offset) {
        // move by fingerwidth only once
        steps.push(getMotorSteps(fingerWidth));
    }

    function cutFingers() {
        let removedThickness = bladeThickness;
        const totalThicknessToBeRemoved = fingerWidth + tolerance;
        while (removedThickness < totalThicknessToBeRemoved) {
            const reqRemoveThickness = Math.min(bladeThickness, totalThicknessToBeRemoved - removedThickness);
            steps.push(getMotorSteps(reqRemoveThickness));
            removedThickness += reqRemoveThickness;
        }
        totalLengthCovered += removedThickness;
    }

    while (totalLengthCovered < workPieceWidth) {

        // if using a non-dado blade, cut the thickness of the finger
        cutFingers();

        // forward the carriage to the next position and make a cut at that point
        steps.push(getMotorSteps(fingerWidth + bladeThickness));
        totalLengthCovered += fingerWidth;
    }


    return steps;

}

export function rewind(steps) {
    console.log('Rewinding to home');
    turnClockWise(steps);
}

function exitHandler() {
    pigpio.terminate();
    console.log('Terminating hardware server');
    process.exit();
}

// gracefully exit the program

process.on('SIGINT', exitHandler);
process.on('exit', exitHandler)
process.on('SIGUSR1', exitHandler);
process.on('SIGUSR2', exitHandler);
process.on('uncaughtException', exitHandler);