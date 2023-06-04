// import express from 'express';
import cors from 'cors';

// export const app = express();



// app.use(express.json());
// app.use(express.raw({ type: 'application/vnd.custom-type' }));
// app.use(express.text({ type: 'text/html' }));

// // Healthcheck endpoint
// app.get('/', (req, res) => {
//   res.status(200).send({ status: 'ok' });
// });

// const api = express.Router();

// api.get('/hello', (req, res) => {
//   res.status(200).send({ message: 'hello world' });
// });

// // Version the api
// app.use('/api/v1', api);

import express, { Application, Request, Response } from 'express';
import router from './router.js';

const app: Application = express();
app.use(cors({ origin: true }));

app.use(express.urlencoded({ extended: true }))
app.use(express.static('public'));
app.use(express.json())
app.use(router);

app.get('/', (req: Request, res: Response) => {
    res.send('Bem vindo ao microblog!!')
});

app.use(function (req: Request, res: Response, next: Function) {
    res.status(404).send('Sorry cant find that!');
});

app.listen(3000, () => {
    console.log('Servidor rodando na porta 3000');
});
