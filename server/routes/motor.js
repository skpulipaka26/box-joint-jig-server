import { Router } from 'express';
import { getSteps, spin, rewind, nudge } from './uitls/motor';
import { exec } from 'child_process';

exec('/opt/vc/bin/vcgencmd measure_temp', (error, stdout, stderr) => {
    if (error) {
        console.log(`error: ${error.message}`);
        return;
    }
    if (stderr) {
        console.log(`stderr: ${stderr}`);
        return;
    }
    return Number(stdout.split('=')[1].replace(`'C`, ''));
});

import {
    tunControllerOff,
    tunControllerOn,
    controllerStatus,
} from './uitls/stepper';

const router = Router();

router.get('/turnon', (_, res) => {
    tunControllerOn();
    res.send(`it's on`);
});

router.get('/turnoff', (_, res) => {
    tunControllerOff();
    res.send(`it's off`);
});

router.get('/status', (_, res) => {
    const status = controllerStatus();
    res.send({ status });
});

router.post('/getsteps', async (req, res) => {
    const { bladeThickness, fingerWidth, tolerance, offset, workPieceWidth } = req.body;
    const steps = await getSteps(bladeThickness, fingerWidth, tolerance, offset, workPieceWidth);
    res.send({ steps });
});

router.post('/spin', async (req, res) => {
    const result = await spin();
    res.send(result);
});

router.post('/rewind', async (req, res) => {
    const result = await rewind();
    res.send(result);
});

router.post('/nudge', async (req, res) => {
    const { direction, travel } = req.body;
    const result = await nudge(direction, travel);
    res.send(result);
});

export default router;