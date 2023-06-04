import cors from 'cors';

import express, { Application, Request, Response } from 'express';
import router from './router.js';

export const app: Application = express();
app.use(cors({ origin: true }));


app.use(express.json())
app.use(express.raw({ type: 'application/vnd.custom-type' }));
app.use(express.text({ type: 'text/html' }));
app.use(express.urlencoded({ extended: true }))
app.use(express.static('public'));
app.use(router);

app.get('/', (req: Request, res: Response) => {
    res.send('Bem vindo ao microblog!!')
});

app.use(function (req: Request, res: Response, next: Function) {
    res.status(404).send('Sorry cant find that!');
});
