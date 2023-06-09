import express, { Application, Router, Request, Response } from "express";

import {
    insertPostagem, retrievePostagem, retrieveAllPostagens, curtirPostagem
    , deletePostagem, retrieveAllComentariostoPostagem, retrieveComentario,
    insertComentario, deleteComentario, insertUsuario, realizaLogin, retrieveUsuario
} from './consultas_bd.js'

const app: Application = express();
const router: Router = express.Router();

app.use(express.json());

router.get('/', (req: Request, res: Response) => {
    res.send('Bem vindo ao microblog!!')
});

router.post('/usuarios', insertUsuario);
router.post('/login', realizaLogin);
router.get('/usuarios/:id', retrieveUsuario);
router.get('/posts', retrieveAllPostagens);
router.get('/posts/:id', retrievePostagem);
router.post('/posts', insertPostagem);
router.delete('/posts/:id', deletePostagem);
router.patch('/posts/:id/like', curtirPostagem);
router.post('/posts/:id/like', curtirPostagem)
router.post('/posts/:id/comentarios', insertComentario);
router.get('/posts/:id/comentarios', retrieveAllComentariostoPostagem);
router.get('/posts/:id/comentarios/:id_comentario', retrieveComentario);
router.delete('/posts/:id/comentarios/:id_comentario', deleteComentario);

export default router;