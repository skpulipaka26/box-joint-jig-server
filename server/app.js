import express, { json, urlencoded } from 'express';
import { join } from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import cors from 'cors';
import admin from 'firebase-admin';
import winston from 'winston';
import expressWinston from 'express-winston';
import firebaseConfig from '../firebase_config.json';

import indexRouter from './routes/index';
import motorRouter from './routes/motor';

const app = express();
app.use(cors());
app.use(logger('dev'));
app.use(json());
app.use(urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(join(__dirname, '../public')));

app.use(expressWinston.logger({
    transports: [
        new winston.transports.Console()
    ],
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.json()
    ),
    meta: true,
    expressFormat: true, 
    colorize: true,
}));

app.use('/', indexRouter);
app.use('/motor', motorRouter);


admin.initializeApp({
    credential: admin.credential.cert(firebaseConfig),
})

export default app;
